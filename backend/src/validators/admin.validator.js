import { z } from "zod";

export const createRoleSchema = z.object({
    name: z.string().min(1, "Role name is required").max(50, "Role name must be at most 50 characters"),
    permissionCodes: z.array(z.string().min(1)).optional().default([]),
});

export const updateRoleSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    permissionCodes: z.array(z.string().min(1)).optional(),
});

export const createPermissionSchema = z.object({
    code: z.string().min(1, "Permission code is required").max(100, "Permission code must be at most 100 characters"),
    description: z.string().max(200, "Description must be at most 200 characters").optional().default(""),
});

export const updatePermissionSchema = z.object({
    code: z.string().min(1).max(100).optional(),
    description: z.string().max(200).optional(),
});
