import mongoose, { Schema } from "mongoose";

/**
 * Session entity (US2, FR-020/FR-022).
 *
 * Represents an active authentication session tied to a refresh token.
 * The refresh token is never stored in plaintext — only its SHA-256 hash
 * (refreshTokenHash) is persisted. Rotation replaces the hash in place
 * while keeping the session id (the token `jti` claim) stable. Revocation
 * is a state transition (revokedAt), never an edit.
 */
const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    deviceFingerprint: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1, revokedAt: 1 });
sessionSchema.index({ userId: 1, expiresAt: 1 });
sessionSchema.index({ revokedAt: 1, lastActiveAt: 1 });
sessionSchema.index({ revokedAt: 1, expiresAt: 1 });

export default mongoose.model("Session", sessionSchema);
