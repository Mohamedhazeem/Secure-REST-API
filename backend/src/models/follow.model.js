import mongoose from "mongoose";
import User from "./user.model.js";

/**
 * Follow entity (US4, FR-025).
 *
 * A directed subscription: `followerId` follows `followingId`. The compound
 * unique index enforces at most one follow per pair atomically (FR-025);
 * duplicate inserts fail with a Mongo duplicate-key error that services map
 * to a CONFLICT. Field names match the contract (followerId/followingId)
 * and the account-deletion cleanup in user.service.js (FR-038).
 */
const followSchema = new mongoose.Schema(
    {
        followerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
        followingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
    },
    { timestamps: true }
);

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
followSchema.index({ followingId: 1, createdAt: -1 });

export default mongoose.model("Follow", followSchema);
