import { sampleDb } from "../configs/database.js"

export const movieController = async(req,res)=>{
    try {

        if(!req.user || !req.user._id)
            return res.status(403).json({message: "Unauthorized"})

        const page = req.query.page*1 || 1;
        const limit = req.query.limit*1 || 20;

        let skip = (page-1) * limit;
        
        const movies = await sampleDb
        .collection("movies")
        .find({})
        .skip(skip)
        .limit(limit)
        .toArray();

    return res.status(200).json({count: movies.length,movies});
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}