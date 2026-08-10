import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;

export async function setup() {
    mongod = await MongoMemoryServer.create({
        instance: {
            args: ["--wiredTigerCacheSizeGB", "0.25"],
        },
    });
    process.env.MONGODB_URI = mongod.getUri();
}

export async function teardown() {
    await mongod?.stop();
}
