import { ACCESS_TOKEN, REFRESH_TOKEN } from "../configs/constants.js";
import { redisClient } from "../configs/redis.js";
import User from "../models/user.model.js"
import { createAuthSession } from "../service/auth.service.js";
import { generateAccessToken } from "../utils/generateToken.js";
import jwt from "jsonwebtoken";
export const loginUser = async(req,res)=>{
    try {
        const{email,password} = req.body;
        if(!email || !password) return res.status(400).json({message: "email or password not entered"});

        const user = await User.findOne({email});
        if(!user) return res.status(400).json({message: "user not found"});

        const isPasswordMatch = await user.comparePassword(password);
        if(!isPasswordMatch)  return res.status(400).json({message: "invalid credentials!"});

        await createAuthSession(res,user);

        return res.status(200).json({message:"user loged in successfully", user:{
            id: user._id,
            email: user.email,
            username: user.username
        }})
    } catch (error) {
        res.status(500).json({message: `internal server error ${error.message || error}`});
    }   
}
export const logoutUser = async (req, res) => {
    const token = req.cookies[ACCESS_TOKEN];
    if (token) {
        const decoded = jwt.decode(token);
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);

        await redisClient.set(
        `auth:blacklist:${token}`,
        "true",
        "EX",
        ttl
        );
    }

    const refresh = req.cookies.refreshToken;
    if (refresh) {
        const decoded = jwt.decode(refresh);
        await redis.del(`auth:refresh:${decoded.sub}`);
    }

    res .clearCookie(ACCESS_TOKEN)
        .clearCookie(REFRESH_TOKEN)
        .json({ message: "Logged out" });
};
export const registerUser = async(req, res) =>{
    try {
        const {username, email,password} = req.body;

        if(username == null || email == null || password == null){
            return res.status(400).json({message: "All field are needed"});
        }
       const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
        return res.status(400).json({ message: "Email already exists" });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
        return res.status(400).json({ message: "Username already exists" });
        }

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password
        })
        await createAuthSession({ res,user });
        return res.status(201).json({message: "user created",user: {id: user.id, username, email}});
    } catch (error) {
        res.status(500).json({message: error.message});
    }
}
export const deleteUser = async(req,res)=>{
    try {
        const user = await User.findByIdAndDelete(req.user._id);
        res .clearCookie(ACCESS_TOKEN)
            .clearCookie(REFRESH_TOKEN)
            .json({ message: "Deleted" });
        return res.status(200).json({message: "deleted succesful"});

    } catch (error) {
        res.status(500).json({message: {error}});        
    }
}