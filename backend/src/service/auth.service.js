import { ACCESS_TOKEN,ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN, REFRESH_TOKEN_MAX_AGE } from "../configs/constants.js";
import { redisClient } from "../configs/redis.js";
import { generateAccessToken, generateRefreshToken } from "../utils/generateToken.js";

export const createAuthSession = async(res,user)=>{
    if(!user) return res.status(401).json({messsage: "user not found"});

    const access_token = generateAccessToken({sub: user._id});
    const refresh_token = generateRefreshToken({sub: user._id, jti: crypto.randomUUID()});

    await redisClient.set(
        `auth:refresh:${user._id}`,
        refresh_token,
        "EX",
        REFRESH_TOKEN_MAX_AGE
    )

     res.cookie(ACCESS_TOKEN, access_token,{
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: ACCESS_TOKEN_MAX_AGE
        });
    res.cookie(REFRESH_TOKEN, refresh_token,{
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: REFRESH_TOKEN_MAX_AGE
        });
}