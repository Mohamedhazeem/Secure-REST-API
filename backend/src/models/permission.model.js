import mongoose, { Schema } from "mongoose";

const permissionSchema = new Schema(
  {
    code: {
      type: String,
      required: [true, "Permission code is required"],
      unique: true,
      maxlength: [100, "Permission code must be at most 100 characters"],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [200, "Description must be at most 200 characters"],
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Permission", permissionSchema);
