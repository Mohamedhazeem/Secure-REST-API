import { Router } from "express";
import { createComment, listComments } from "../controller/comment.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { commentCreateSchema } from "../validators/comment.validator.js";
import { requirePermission } from "../middleware/role.middleware.js";

/**
 * Comment routes (US5, T083). Mounted under `/api/v1/posts`, so the `:id`
 * parameter is the parent post id, matching the contract paths
 * `/posts/{id}/comments`.
 */
export const commentRouter = Router();

commentRouter.post(
    "/:id/comments",
    validate(commentCreateSchema),
    requirePermission("comments:create"),
    createComment
);
commentRouter.get("/:id/comments", requirePermission("comments:read"), listComments);
