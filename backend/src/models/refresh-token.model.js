import mongoose, { Schema } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    tokenId: {
      type: String,
      required: [true, "Token ID is required"],
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ tokenId: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ expiresAt: 1 });

export default mongoose.model("RefreshToken", refreshTokenSchema);
