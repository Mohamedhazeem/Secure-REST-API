import jwt from "jsonwebtoken";
import { ACCESS_TOKEN, REFRESH_TOKEN, ACCESS_TOKEN_MAX_AGE,
    ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_MAX_AGE, REFRESH_TOKEN_EXPIRES_IN}
     from "../configs/constants.js";
import { config } from "../configs/config.js";

export const generateAccessToken = (payload)=>{
    return jwt.sign(payload, config.jwtAuthKey, 
        {
            algorithm: "HS256", 
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            issuer: "secure-web-api",
            audience: "secure-web-client"
        });
}
export const generateRefreshToken = (payload)=>{
    return jwt.sign(payload, config.jwtRefreshKey, 
        {
            algorithm: "HS256", 
            expiresIn: REFRESH_TOKEN_EXPIRES_IN,
            issuer: "secure-web-api",
            audience: "secure-web-client"
        });
}

export const verifyAccessToken = (token)=>{
    return jwt.verify(token, config.jwtAuthKey);
}

export const verifyRefreshToken = (token)=>{
    return jwt.verify(token, config.jwtRefreshKey);
}