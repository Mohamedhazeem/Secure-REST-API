import { z } from "zod";
import { COMMENT_MAX_LENGTH } from "../models/comment.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid identifier");

/**
 * Comment creation payload (contract `CommentCreateRequest`).
 *
 * `idempotencyKey` is optional: when supplied, replaying the same key
 * resolves to the original comment instead of creating a duplicate
 * (FR-028, spec US5 acceptance 3).
 */
export const commentCreateSchema = z.object({
    content: z.string().trim().min(1, "Content is required").max(COMMENT_MAX_LENGTH),
    parentCommentId: objectId.nullish(),
    idempotencyKey: z.string().trim().min(1).max(255).optional(),
});

/**
 * The `:id` path parameter of the comment routes is the parent post id.
 * Validating it in the controller keeps a malformed identifier an explicit
 * 400 instead of a cast failure surfacing as an internal error.
 */
export const commentPostIdSchema = objectId;
