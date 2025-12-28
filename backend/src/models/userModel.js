import mongoose, {Schema} from "mongoose";
import bcrypt from "bcrypt";
import { testDb } from "../configs/database.js";
const userSchema = new Schema({
    username:{
        type: String,
        required: true,
        unique:true,
        minLength:1,
        maxLength:20,
        trim:true,
        lowercase:true
    },
    password:{
        type: String,
        required: true,
        minLength:1,
        maxLength:30,
    },
    email:{
        type: String,
        required: true,
        trim:true,
        lowercase:true
    }
},
{
    timestamps: true
}

);
// no use next() along with async
userSchema.pre("save", async function(){
    if(!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password,10);    
});

// custom methods
userSchema.methods.comparePassword = async function(password){
    return await bcrypt.compare(password, this.password);
}

export default testDb.model("User", userSchema);