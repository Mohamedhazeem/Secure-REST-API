import Post from "../models/post.model.js"

export const createPost= async(req,res)=>{
    try {

        const{name, age, description} = req.body;
        if(!name || description == null || age == null) 
            return res.status(400).json({message: "All field required"});

        const post = await Post.create({
            name, age, description, author: req.user._id
        });
        return res.status(201).json({message:"post created", post});
    } catch (error) {
         return res.status(500).json({message: error.message});
    }
}
export const getAllPosts = async (req, res) => {
    const posts = await Post.find().populate("author", "username email");

    return res.status(200).json({
        message: "All posts",
        posts
    });
};

export const getPosts = async(req,res)=>{
    const posts = await Post.find({author: req.user._id}).populate("author", "username email");
    return res.status(200).json({message: "your posts", posts})
}
export const updatePost = async(req,res)=>{
    try {
        const {id} = req.params;
        const {name, description, age} =req.body;
        const post = await Post.findById(id);
        if(!post) return res.status(404).json({message:"post not found"});

        if (post.author.toString() !== req.user._id.toString())
        {
            return res.status(403).json({ message: "Not allowed" }); 
        }
        post.name = name?? post.name;
        post.description = description ?? post.description;
        post.age = age?? post.age;

        await post.save();
        return res.status(200).json({message: "post updated", post});

    } catch (error) {
        return res.status(500).json({message: error.message});
    }
}

export const deletePost = async(req,res)=>{
    try {
        const {id} = req.params;
        if(!id) return res.status(400).json({message:"post id required"});

        const post = await Post.findById(id);
        if(!post) return res.status(404).json({message:"not post found"});

        if(post.author.toString() !== req.user._id.toString())
            return res.status(403).json({message:"Unauthorized"});

        await post.deleteOne();

        return res.status(200).json({message:"post deleted"});
    } 
    catch (error) {
        return res.status(500).json({message: error.message});
    }
    
}