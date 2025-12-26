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