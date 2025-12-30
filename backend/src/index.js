import { connectDB } from "./configs/database.js";
import {app} from "./app.js";


const startServer = async() =>{
    try{
       await connectDB();
      const server = app.listen(process.env.PORT || 3333, () => {
      console.log(
        `connected to server on port ${process.env.PORT || 3333}`
      );
    });

    server.on("error", (error) => {
      console.error("Server error:", error);
      process.exit(1);
    });
    }catch(error){
        console.log(`server failed: ${error}`);
    }    
}

startServer();