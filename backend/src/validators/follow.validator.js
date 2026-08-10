import { z } from "zod";

/**
 * Follow operations carry no request body (contract `follows.yaml`).
 * The strict empty schema rejects unexpected payload fields while
 * allowing the conventional empty or absent body.
 */
export const followSchema = z.object({}).strict().optional();
