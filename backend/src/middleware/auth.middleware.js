import { ACCESS_TOKEN } from "../configs/constants.js"
import User from "../models/user.model.js"
import jwt from "jsonwebtoken";

export const authMiddleWare = async(req,res,next) =>{

    try {
        const token = req.cookies[ACCESS_TOKEN];

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.user =  await User.findById(decoded.userId).select("-password"); // here i exclude password
    // to include add keys like .select(_id name email) with spaces
    if(!req.user){
        return res.status(400).json({message:"user not found"});
    }
    next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
    
}