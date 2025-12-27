import Redis from "ioredis";
import dotenv from "dotenv"

dotenv.config();

export const redisClient = new Redis(process.env.REDIS_DB_URI, {
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        console.log(`🔁 Redis reconnect attempt #${times}`);
        return delay;
    },
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
});

redisClient.on("connect", () => console.log("Connected"));
redisClient.on("ready", () => console.log("Ready to use"));
redisClient.on("reconnecting", () => console.log("Reconnecting..."));
redisClient.on("close", () => console.log("Connection closed"));
redisClient.on("end", () => console.log("Connection ended"));
redisClient.on("error", (error)=>{console.log(error)});