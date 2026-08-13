import { createError } from "../utils/errors.js";
import { sendSuccess } from "../utils/response.js";
import RoleRepository from "../repositories/interfaces/role.repository.js";
import PermissionRepository from "../repositories/interfaces/permission.repository.js";
import { requirePermission } from "../middleware/role.middleware.js";

const roleRepository = new RoleRepository();
const permissionRepository = new PermissionRepository();

export const requireAdmin = () => requirePermission("roles:manage");

export const listRoles = async (req, res, next) => {
    try {
        const roles = await roleRepository.findMany({});
        return sendSuccess(res, 200, { data: roles });
    } catch (err) {
        next(err);
    }
};

export const getRole = async (req, res, next) => {
    try {
        const role = await roleRepository.findById(req.params.id);
        if (!role) {
            return next(createError("NOT_FOUND", "Role not found", 404));
        }
        return sendSuccess(res, 200, { data: role });
    } catch (err) {
        next(err);
    }
};

export const createRole = async (req, res, next) => {
    try {
        const { name, permissionCodes } = req.body;
        const existing = await roleRepository.findOne(name);
        if (existing) {
            return next(createError("CONFLICT", "Role already exists", 409));
        }

        const permissionDocs = [];
        for (const code of permissionCodes) {
            const perm = await permissionRepository.findOne(code);
            if (!perm) {
                return next(createError("NOT_FOUND", `Permission ${code} not found`, 404));
            }
            permissionDocs.push(perm._id);
        }

        const role = await roleRepository.create({ name, permissions: permissionDocs });
        return sendSuccess(res, 201, { data: role });
    } catch (err) {
        next(err);
    }
};

export const updateRole = async (req, res, next) => {
    try {
        const role = await roleRepository.findById(req.params.id);
        if (!role) {
            return next(createError("NOT_FOUND", "Role not found", 404));
        }

        const { name, permissionCodes } = req.body;
        const updateData = {};

        if (name !== undefined) {
            const existing = await roleRepository.findOne(name);
            if (existing && existing._id.toString() !== role._id.toString()) {
                return next(createError("CONFLICT", "Role name already exists", 409));
            }
            updateData.name = name;
        }

        if (permissionCodes !== undefined) {
            const permissionDocs = [];
            for (const code of permissionCodes) {
                const perm = await permissionRepository.findOne(code);
                if (!perm) {
                    return next(createError("NOT_FOUND", `Permission ${code} not found`, 404));
                }
                permissionDocs.push(perm._id);
            }
            updateData.permissions = permissionDocs;
        }

        const updated = await roleRepository.update(role._id, updateData);
        return sendSuccess(res, 200, { data: updated });
    } catch (err) {
        next(err);
    }
};

export const deleteRole = async (req, res, next) => {
    try {
        const role = await roleRepository.findById(req.params.id);
        if (!role) {
            return next(createError("NOT_FOUND", "Role not found", 404));
        }
        await roleRepository.delete(req.params.id);
        return sendSuccess(res, 200, { message: "Role deleted" });
    } catch (err) {
        next(err);
    }
};

export const listPermissions = async (req, res, next) => {
    try {
        const permissions = await permissionRepository.findMany({});
        return sendSuccess(res, 200, { data: permissions });
    } catch (err) {
        next(err);
    }
};

export const getPermission = async (req, res, next) => {
    try {
        const permission = await permissionRepository.findById(req.params.id);
        if (!permission) {
            return next(createError("NOT_FOUND", "Permission not found", 404));
        }
        return sendSuccess(res, 200, { data: permission });
    } catch (err) {
        next(err);
    }
};

export const createPermission = async (req, res, next) => {
    try {
        const { code, description } = req.body;
        const existing = await permissionRepository.findOne(code);
        if (existing) {
            return next(createError("CONFLICT", "Permission already exists", 409));
        }
        const permission = await permissionRepository.create({ code, description });
        return sendSuccess(res, 201, { data: permission });
    } catch (err) {
        next(err);
    }
};

export const updatePermission = async (req, res, next) => {
    try {
        const permission = await permissionRepository.findById(req.params.id);
        if (!permission) {
            return next(createError("NOT_FOUND", "Permission not found", 404));
        }

        const { code, description } = req.body;
        const updateData = {};

        if (code !== undefined) {
            const existing = await permissionRepository.findOne(code);
            if (existing && existing._id.toString() !== permission._id.toString()) {
                return next(createError("CONFLICT", "Permission code already exists", 409));
            }
            updateData.code = code;
        }

        if (description !== undefined) {
            updateData.description = description;
        }

        const updated = await permissionRepository.update(permission._id, updateData);
        return sendSuccess(res, 200, { data: updated });
    } catch (err) {
        next(err);
    }
};

export const deletePermission = async (req, res, next) => {
    try {
        const permission = await permissionRepository.findById(req.params.id);
        if (!permission) {
            return next(createError("NOT_FOUND", "Permission not found", 404));
        }
        await permissionRepository.delete(req.params.id);
        return sendSuccess(res, 200, { message: "Permission deleted" });
    } catch (err) {
        next(err);
    }
};
