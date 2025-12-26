import jwt from "jsonwebtoken";
import { AUTH_TOKEN } from "../configs/constants.js";

export const generateToken = (res, userId)=>{
    const token = jwt.sign({userId}, process.env.JWT_SECRET_KEY, {algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN});

    res.cookie(AUTH_TOKEN, token,{
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 3 * 60 * 1000
    });

    return token;
}