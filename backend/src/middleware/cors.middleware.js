import { isOriginAllowed, corsHeaders } from "../configs/cors.js";

export const corsMiddleware = (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", corsHeaders["Access-Control-Allow-Credentials"]);
        res.setHeader("Access-Control-Allow-Methods", corsHeaders["Access-Control-Allow-Methods"]);
        res.setHeader("Access-Control-Allow-Headers", corsHeaders["Access-Control-Allow-Headers"]);
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
};
