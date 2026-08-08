import mongoose from "mongoose";
import { BASE_URI } from "./constants.js";

if (!BASE_URI) {
    console.error("🛑 MONGODB_URI is missing from environment variables!");
    process.exit(1);
}

const mongooseOptions = {
  // true in development, false in production
  autoIndex: process.env.NODE_ENV !== 'production' 
};

// Helper function to create clean connection instances
const makeConnection = (uri, dbName) => {
    const db = mongoose.createConnection(uri, {
        dbName: dbName,
        ...mongooseOptions
        // Optional configuration tweaks for modern Mongoose setups can go here
    });
    db.on("connected", () => console.log(`💾 Connected to database: ${dbName}`));
    db.on("error", (err) => {
        console.error(`🛑 Database [${dbName}] error:`, err);
        // Optional: process.exit(1) if you want the app to crash on initial connection loss
    });

    return db;
};

// Connections are initiated immediately upon file evaluation
export const testDb = makeConnection(BASE_URI, "test");
export const sampleDb = makeConnection(BASE_URI, "sample_mflix");

