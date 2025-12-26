import { AUTH_TOKEN } from "../configs/constants.js";
import User from "../models/userModel.js"
import { generateToken } from "../utils/generateToken.js";

export const loginUser = async(req,res)=>{
    try {
        const{email,password} = req.body;
        if(!email || !password) return res.status(400).json({message: "email or password not entered"});

        const user = await User.findOne({email});
        if(!user) return res.status(400).json({message: "user not found"});

        const isPasswordMatch = await user.comparePassword(password);
        if(!isPasswordMatch)  return res.status(400).json({message: "invalid credentials!"});

        generateToken(res, user._id);
        return res.status(200).json({message:"user loged in successfully", user:{
            id: user._id,
            email: user.email,
            username: user.username
        }})
    } catch (error) {
        res.status(500).json({message: `internal server error ${error.message || error}`});
    }   
}
export const logoutUser = async(req,res)=>{
    try {
        res.cookie(AUTH_TOKEN, "",{
            httpOnly:true, expires: new Date(0)
        });

        return res.status(200).json({message:"user loged out"})
    } catch (error) {
        res.status(500).json({message: `internal server error ${error.message || error}`});
    }   
}
export const registerUser = async(req, res) =>{
    try {
        const {username, email,password} = req.body;

        if(username == null || email == null || password == null){
            return res.status(400).json({message: "All field are needed"});
        }
       const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
        return res.status(400).json({ message: "Email already exists" });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
        return res.status(400).json({ message: "Username already exists" });
        }

        const user = await User.create({
            username,
            email: email.toLowerCase(),
            password
        })
        generateToken(res, user._id);
        return res.status(201).json({message: "user created",user: {id: user.id, username, email}});
    } catch (error) {
        res.status(500).json({message: error.message});
    }
}
export const deleteUser = async(req,res)=>{
    try {
        const user = await User.findByIdAndDelete(req.user._id);
        res.cookie(AUTH_TOKEN, "", {
            httpOnly: true,
            expires: new Date(0)
        });
        return res.status(200).json({message: "deleted succesful"});

    } catch (error) {
        res.status(500).json({message: {error}});        
    }
}