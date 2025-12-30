import { ACCESS_TOKEN, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN } from "../configs/constants.js";
import { redisClient } from "../configs/redis.js";
import { generateAccessToken, verifyRefreshToken } from "../utils/generateToken.js";

export const refreshTokenController = async (req, res) => {
  const token = req.cookies[REFRESH_TOKEN];
  if (!token) return res.sendStatus(401);

  try {
    const payload = verifyRefreshToken(token);

    const stored = await redisClient.get(
      `auth:refresh:${payload.sub}`
    );
    if(stored == null) return res.sendStatus(401);
    if (stored !== token) {
      await redisClient.del(`auth:refresh:${payload.sub}`);
      console.log("1");
      return res.status(403);
    }

    const newAccessToken = generateAccessToken({ sub: payload.sub });

    res.cookie(ACCESS_TOKEN, newAccessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    return res.status(200).json({ message: "Token refreshed" });
  } catch {
    console.log("2");
    return res.sendStatus(403);
  }
};
