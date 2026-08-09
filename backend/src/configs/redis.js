import Redis from "ioredis";
import { config } from "./config.js";

const isTest = config.nodeEnv === "test";

function createRedisClient() {
    const client = new Redis(config.redisUri, {
        retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            console.log(`Redis reconnect attempt #${times}`);
            return delay;
        },
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });

    client.on("connect", () => console.log("Connected"));
    client.on("ready", () => console.log("Ready to use"));
    client.on("reconnecting", () => console.log("Reconnecting..."));
    client.on("close", () => console.log("Connection closed"));
    client.on("end", () => console.log("Connection ended"));
    client.on("error", (error)=>{console.log(error)});

    return client;
}

function createMemoryClient() {
  const store = new Map();
  const ttlTimers = new Map();

  const clearTtl = (key) => {
    const timer = ttlTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      ttlTimers.delete(key);
    }
  };

  return {
    set(key, value, mode, ttl) {
      store.set(key, value);
      clearTtl(key);
      if (mode === "EX" && typeof ttl === "number") {
        const timer = setTimeout(() => store.delete(key), ttl * 1000);
        ttlTimers.set(key, timer);
      }
      return Promise.resolve("OK");
    },
    get(key) {
      return Promise.resolve(store.has(key) ? store.get(key) : null);
    },
    del(...keys) {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count += 1;
        clearTtl(key);
      }
      return Promise.resolve(count);
    },
    call(...args) {
      const [command, key, value, mode, ttl] = args;
      switch (command?.toUpperCase()) {
        case "SET":
          return this.set(key, value, mode, ttl);
        case "GET":
          return this.get(key);
        case "DEL":
          return this.del(key);
        default:
          return Promise.resolve(null);
      }
    },
  };
}

export const redisClient = isTest ? createMemoryClient() : createRedisClient();