import mongoose, {Schema} from "mongoose";
import User from "../models/userModel.js"
const postSchema = new Schema(
   {
    name:{
        type: String,
        trim:true,
        required:true
    },
    description:{
        type: String,
        required:true
    }, 
    age:{
        type: Number,
        required:true,
        minLength:1,
        maxLength:50
    },
    author:{
        type: Schema.Types.ObjectId,
        ref: User,
        required:true
    } 
   },
   {
    timestamps: true
   }
);

export default mongoose.model("Post", postSchema);