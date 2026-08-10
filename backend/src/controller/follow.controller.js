import * as followService from "../service/follow.service.js";
import { sendSuccess } from "../utils/response.js";

export const followUser = async (req, res, next) => {
    try {
        const follow = await followService.followUser({
            followerId: req.user._id,
            followingId: req.params.id,
        });
        return sendSuccess(res, 201, { follow });
    } catch (err) {
        next(err);
    }
};

export const unfollowUser = async (req, res, next) => {
    try {
        await followService.unfollowUser({
            followerId: req.user._id,
            followingId: req.params.id,
        });
        return sendSuccess(res, 200, { message: "Unfollowed successfully" });
    } catch (err) {
        next(err);
    }
};
