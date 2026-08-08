import { z } from "zod";

export const createPostSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().min(1, "Description is required").max(2000),
  age: z.number().int().min(0).max(150),
});

export const updatePostSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  age: z.number().int().min(0).max(150).optional(),
});
