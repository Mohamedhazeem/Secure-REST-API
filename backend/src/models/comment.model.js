import mongoose from "mongoose";
import User from "./user.model.js";
import Post from "./post.model.js";

export const COMMENT_MAX_LENGTH = 1000;

/**
 * Comment entity (US5, FR-024).
 *
 * A comment is an atomic append under a post. `version` is the optimistic
 * lock counter (Constitution XI, data-model.md): every mutation presents
 * the version it read and the compare-and-set update increments it, so a
 * stale writer loses with a conflict instead of silently overwriting.
 *
 * `idempotencyKey` is client-supplied (contract `CommentCreateRequest`).
 * The partial unique index on { authorId, idempotencyKey } makes replay
 * protection atomic: two concurrent submissions of the same key cannot both
 * insert, so a retry always resolves to exactly one comment (FR-028).
 * Field names match the contract and the account-deletion cleanup in
 * user.service.js, which reassigns `authorId` to "[deleted]" (FR-038).
 */
const commentSchema = new mongoose.Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: Post,
            required: true,
        },
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
        content: {
            type: String,
            trim: true,
            required: true,
            minlength: 1,
            maxlength: COMMENT_MAX_LENGTH,
        },
        parentCommentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment",
            default: null,
        },
        idempotencyKey: {
            type: String,
            default: null,
        },
        version: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index(
    { authorId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.model("Comment", commentSchema);
