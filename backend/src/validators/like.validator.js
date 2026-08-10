import { z } from "zod";

/**
 * Like creation requires a client-generated idempotencyKey per the
 * contract's `LikeCreateRequest` schema (paths/likes.yaml). Unlike and
 * status-check operations carry no body.
 */
export const likeCreateSchema = z.object({
    idempotencyKey: z.string().trim().min(1, "idempotencyKey is required"),
});
