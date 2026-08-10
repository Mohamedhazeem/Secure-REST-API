import mongoose from "mongoose";
import User from "./user.model.js";

export const NOTIFICATION_TYPES = Object.freeze(["follow", "comment", "like"]);

/**
 * Notification entity (US5, FR-027/FR-039).
 *
 * The payload is self-contained: actor, action, target summary, and deep
 * link let a client render the notification without extra API calls
 * (FR-039). `dedupeKey` is the delivery guarantee: the queue is
 * at-least-once (Decision 6), so the same job may be processed more than
 * once after a retry. The unique index turns duplicate processing into a
 * no-op insert, yielding effectively-once delivery (SC-017).
 */
const notificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
        actorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: User,
            required: true,
        },
        type: {
            type: String,
            enum: NOTIFICATION_TYPES,
            required: true,
        },
        actorName: {
            type: String,
            required: true,
            trim: true,
        },
        action: {
            type: String,
            required: true,
            trim: true,
        },
        targetSummary: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        deepLink: {
            type: String,
            required: true,
            trim: true,
        },
        resourceId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        read: {
            type: Boolean,
            default: false,
        },
        dedupeKey: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true });

export default mongoose.model("Notification", notificationSchema);
