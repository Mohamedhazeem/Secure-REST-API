import Redis from "ioredis";

const isTest = process.env.NODE_ENV === "test";

function createRedisClient() {
    const client = new Redis(process.env.REDIS_DB_URI, {
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

export const redisClient = isTest
    ? {
        call: () => Promise.reject(
            new Error("Redis is disabled in test mode; rate limiting uses MemoryStore")
        ),
    }
    : createRedisClient();