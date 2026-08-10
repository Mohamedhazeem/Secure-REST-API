import { z } from "zod";
import { POST_VISIBILITIES } from "../models/post.model.js";

export const visibilitySchema = z.enum(POST_VISIBILITIES);

export const createPostSchema = z.object({
    content: z.string().trim().min(1, "Content is required").max(2000),
    visibility: visibilitySchema.default("public"),
});

export const updatePostSchema = z.object({
    content: z.string().trim().min(1).max(2000).optional(),
    visibility: visibilitySchema.optional(),
    version: z.number().int().min(0, "version must be a non-negative integer"),
});
