import mongoose from "mongoose";

export const connectDB = async() => {
    try{
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("connected to DB")
    }
    catch (error) {
    console.error("DB Connection Failed:", error.message);
    process.exit(1);
    }
}

export const testDb = mongoose.connection.useDb("test");
export const sampleDb = mongoose.connection.useDb("sample_mflix");