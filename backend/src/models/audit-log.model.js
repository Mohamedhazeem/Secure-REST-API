import mongoose, { Schema } from "mongoose";

/**
 * Audit Log entity (US6, FR-030).
 *
 * Immutable, append-only record of security-relevant events:
 * authentication, authorization failures, token reuse, and resource
 * mutations. Every entry is correlated to its request via correlationId
 * (FR-031). Entries are never updated or deleted.
 */
const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      default: null,
    },
    resourceId: {
      type: String,
      default: null,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error"],
      default: "info",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    correlationId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ correlationId: 1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export default mongoose.model("AuditLog", auditLogSchema);
