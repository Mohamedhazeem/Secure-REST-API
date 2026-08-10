import mongoose from "mongoose";
import User from "./user.model.js";

export const POST_VISIBILITIES = Object.freeze(["public", "followers-only", "private"]);

/**
 * Post entity (US3, FR-036/FR-029).
 *
 * Visibility controls who may read the post (public, followers-only,
 * private). `version` is the optimistic lock counter: every update must
 * present the version it read, and the CAS update increments it — stale
 * writers lose with a conflict (FR-029, Constitution XI).
 */
const postSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            trim: true,
            required: true,
            minlength: 1,
            maxlength: 2000,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
        visibility: {
            type: String,
            enum: POST_VISIBILITIES,
            default: "public",
            required: true,
        },
        version: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });

export default mongoose.model("Post", postSchema);
