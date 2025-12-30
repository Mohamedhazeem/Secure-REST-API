import jwt from "jsonwebtoken";
import { ACCESS_TOKEN, REFRESH_TOKEN, ACCESS_TOKEN_MAX_AGE,
    ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_MAX_AGE, REFRESH_TOKEN_EXPIRES_IN}
     from "../configs/constants.js";

export const generateAccessToken = (payload)=>{
    return jwt.sign(payload, process.env.JWT_AUTH_KEY, 
        {
            algorithm: "HS256", 
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            issuer: "secure-web-api",
            audience: "secure-web-client"
        });
}
export const generateRefreshToken = (payload)=>{
    return jwt.sign(payload,process.env.JWT_REFRESH_KEY, 
        {
            algorithm: "HS256", 
            expiresIn: REFRESH_TOKEN_EXPIRES_IN,
            issuer: "secure-web-api",
            audience: "secure-web-client"
        });
}

export const verifyAccessToken = (token)=>{
    return jwt.verify(token,process.env.JWT_AUTH_KEY);
}

export const verifyRefreshToken = (token)=>{
    return jwt.verify(token,process.env.JWT_REFRESH_KEY);
}