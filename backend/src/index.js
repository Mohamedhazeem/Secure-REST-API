import dotenv from "dotenv";
dotenv.config();
import { app } from "./app.js";

const startServer = () => {
    try {
        const PORT = process.env.PORT || 3333;
        
        const server = app.listen(PORT, () => {
            console.log(`🚀 Express server running on port ${PORT}`);
        });

        server.on("error", (error) => {
            console.error("🛑 Server error:", error);
            process.exit(1);
        });
    } catch (error) {
        console.error(`🛑 Server startup failed: ${error}`);
    }    
};

startServer();