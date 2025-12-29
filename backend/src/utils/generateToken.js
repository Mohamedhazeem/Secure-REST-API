import jwt from "jsonwebtoken";
import { ACCESS_TOKEN, REFRESH_TOKEN, ACCESS_TOKEN_MAX_AGE,
    ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_MAX_AGE, REFRESH_TOKEN_EXPIRES_IN}
     from "../configs/constants.js";

export const generateAccessToken = (res, userId)=>{
    const token = await jwt.sign({userId}, process.env.JWT_AUTH_KEY, {algorithm: "HS256", expiresIn: ACCESS_TOKEN_EXPIRES_IN});

    res.cookie(ACCESS_TOKEN, token,{
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: ACCESS_TOKEN_MAX_AGE
    });

    return token;
}
export const generateRefreshToken = (res,userId)=>{
    const token = await jwt.sign({userId},process.env.JWT_REFRESH_KEY, {algorithm: "HS256", expiresIn: REFRESH_TOKEN_EXPIRES_IN})

    res.cookie(REFRESH_TOKEN, token,{
        httpOnly:true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: REFRESH_TOKEN_MAX_AGE  
    })
}

export const verifyAccessToken = (req)=>{
    return await jwt.verify(req.cookies[ACCESS_TOKEN],process.env.JWT_AUTH_KEY);
}

export const verifyRefreshToken = (req)=>{
    return await jwt.verify(req.cookies[REFRESH_TOKEN],process.env.JWT_REFRESH_KEY);
}