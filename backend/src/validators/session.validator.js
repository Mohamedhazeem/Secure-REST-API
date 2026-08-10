import { z } from "zod";

export const sessionIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Session id must be a valid identifier");

export const revokeSessionParamsSchema = z.object({
  id: sessionIdSchema,
});
