import mongoose from "mongoose";
import User from "./user.model.js";
import Post from "./post.model.js";

/**
 * Like entity (US4, FR-037).
 *
 * A first-class reaction of `userId` on `postId`. The compound unique index
 * enforces one like per user-post pair (FR-037); duplicate inserts fail with
 * a Mongo duplicate-key error that services map to CONFLICT. Field names
 * match the contract (userId/postId) and the account-deletion cleanup in
 * user.service.js (FR-038).
 */
const likeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: Post,
            required: true,
        },
    },
    { timestamps: true }
);

likeSchema.index({ userId: 1, postId: 1 }, { unique: true });
likeSchema.index({ postId: 1, createdAt: -1 });

export default mongoose.model("Like", likeSchema);
