import { Router } from "express";
import {
    listRoles,
    getRole,
    createRole,
    updateRole,
    deleteRole,
    listPermissions,
    getPermission,
    createPermission,
    updatePermission,
    deletePermission,
    requireAdmin,
} from "../controllers/admin.controller.js";
import { authMiddleWare } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    createRoleSchema,
    updateRoleSchema,
    createPermissionSchema,
    updatePermissionSchema,
} from "../validators/admin.validator.js";

export const adminRouter = Router();

adminRouter.use(authMiddleWare);
adminRouter.use(requireAdmin());

adminRouter.get("/roles", listRoles);
adminRouter.get("/roles/:id", getRole);
adminRouter.post("/roles", validate(createRoleSchema), createRole);
adminRouter.patch("/roles/:id", validate(updateRoleSchema), updateRole);
adminRouter.delete("/roles/:id", deleteRole);

adminRouter.get("/permissions", listPermissions);
adminRouter.get("/permissions/:id", getPermission);
adminRouter.post("/permissions", validate(createPermissionSchema), createPermission);
adminRouter.patch("/permissions/:id", validate(updatePermissionSchema), updatePermission);
adminRouter.delete("/permissions/:id", deletePermission);
