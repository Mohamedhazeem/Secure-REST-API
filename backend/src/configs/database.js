import mongoose from "mongoose";
import { BASE_URI } from "./constants.js";

const isTest = process.env.NODE_ENV === "test";

if (!isTest && !BASE_URI) {
    console.error("🛑 MONGODB_URI is missing from environment variables!");
    process.exit(1);
}

const mongooseOptions = {
  autoIndex: process.env.NODE_ENV !== 'production'
};

/**
 * Explicitly build every registered model's indexes (T090, deploy safety).
 *
 * In production `autoIndex` is disabled (it blocks connection startup and is
 * unsafe on a live cluster), so the unique indexes that guard correctness -
 * notably the notification `dedupeKey` index and the comment
 * `{ authorId, idempotencyKey }` partial unique index - would otherwise never
 * be created. This runs once at boot, regardless of `autoIndex`, so those
 * guarantees hold in every environment. Must run after the connection is
 * established and after all models are compiled.
 * @returns {Promise<void>}
 */
export const ensureIndexes = async () => {
  await mongoose.connection.asPromise();
  const names = mongoose.modelNames();
  await Promise.all(names.map((name) => mongoose.model(name).createIndexes()));
};

const makeConnection = (uri, dbName) => {
    const db = mongoose.createConnection(uri, {
        dbName: dbName,
        ...mongooseOptions
    });
    db.on("connected", () => console.log(`💾 Connected to database: ${dbName}`));
    db.on("error", (err) => {
        console.error(`🛑 Database [${dbName}] error:`, err);
    });

    return db;
};

if (BASE_URI) {
    mongoose.connect(BASE_URI, { dbName: "test", ...mongooseOptions }).catch((err) => {
        console.error("🛑 Primary database connection error:", err);
    });
    mongoose.connection.on("connected", () => console.log("💾 Connected to database: test"));
}

export const testDb = mongoose.connection;

export const getTestDb = () => testDb;

export const closeConnections = async () => {
    const connections = [testDb].filter(Boolean);
    await Promise.all(
        connections.map((conn) =>
            conn.readyState !== 0 ? conn.close() : Promise.resolve()
        )
    );
};

