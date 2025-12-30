import { ACCESS_TOKEN } from "../configs/constants.js"
import User from "../models/user.model.js"
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../utils/generateToken.js";
import { redisClient } from "../configs/redis.js";

export const authMiddleWare = async(req,res,next) =>{

    const token = req.cookies[ACCESS_TOKEN];
    if (!token)
        return res.status(401).json({ message: "Unauthorized" });

    const blacklisted = await redisClient.get(`auth:blacklist:${token}`);
    if (blacklisted)
        return res.status(401).json({ message: "Token revoked" });
        
    try {

        const decoded = verifyAccessToken(token);

        const user =  await User.findById(decoded.sub).select("-password"); // here i exclude password
        // to include add keys like .select(_id name email) with spaces
        if(!user){
            return res.status(400).json({message:"user not found"});
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
    
}