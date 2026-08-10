import dotenv from "dotenv";
dotenv.config();
import { app } from "./app.js";
import { seedRolesAndPermissions } from "./configs/seed.js";
import { assertContract, CONTRACT_PUBLISHED } from "./docs/contract-check.js";

const startServer = async () => {
    try {
        if (process.env.NODE_ENV !== "production") {
            assertContract({ app, contractDir: CONTRACT_PUBLISHED });
        }

        if (process.env.NODE_ENV !== "test") {
            try {
                await seedRolesAndPermissions();
            } catch (err) {
                console.error("🛑 Failed to seed roles and permissions:", err);
                process.exit(1);
            }
        }

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
        process.exit(1);
    }
};

startServer();