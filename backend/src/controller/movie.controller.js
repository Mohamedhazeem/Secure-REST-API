import { sampleDb } from "../configs/database.js";
import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";

/**
 * Movies endpoint - read-only paginated access to sample_mflix collection.
 *
 * Complexity: O(n) where n = limit (page size).
 * - estimatedDocumentCount() is O(1) (uses collection metadata, not a scan).
 * - find().skip().limit() scans O(skip + limit) documents; capped at 100 items/page.
 * - Total count and data fetch run concurrently via Promise.all.
 * - No populate/joins: movies are a flat document, so no N+1 risk.
 */
export const movieController = async (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    if (!sampleDb) {
        return next(createError("DEPENDENCY_FAILURE", "Movies data source is unavailable", 503));
    }

    try {
        const collection = sampleDb.collection("movies");
        const [total, data] = await Promise.all([
            collection.estimatedDocumentCount(),
            collection.find({}).skip(skip).limit(limit).toArray(),
        ]);
        return sendSuccess(res, 200, { data, page, limit, total });
    } catch (error) {
        return next(createError("DEPENDENCY_FAILURE", "Failed to retrieve movies", 503));
    }
};
