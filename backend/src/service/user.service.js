import bcrypt from "bcrypt";
import crypto from "crypto";
import UserRepository from "../repositories/implementations/mongoose/user.repository.js";
import RoleRepository from "../repositories/implementations/mongoose/role.repository.js";
import PermissionRepository from "../repositories/implementations/mongoose/permission.repository.js";
import { createError } from "../utils/errors.js";

const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const permissionRepository = new PermissionRepository();

const DEFAULT_ROLE = "user";

const ensureDefaultRole = async () => {
    const read = await permissionRepository.upsert("posts:read", { code: "posts:read", description: "Read posts" });
    const create = await permissionRepository.upsert("posts:create", { code: "posts:create", description: "Create posts" });

    return roleRepository.upsert(DEFAULT_ROLE, { name: DEFAULT_ROLE, permissions: [read._id, create._id] });
};

export const registerUser = async ({ username, email, password }) => {
    const normalizedEmail = email.toLowerCase();

    if (await userRepository.findOne({ email: normalizedEmail })) {
        throw createError("CONFLICT", "Email already exists", 409);
    }
    if (await userRepository.findOne({ username })) {
        throw createError("CONFLICT", "Username already exists", 409);
    }

    const userRole = await ensureDefaultRole();

    const user = await userRepository.create({
        username,
        email: normalizedEmail,
        password,
        roles: [userRole._id],
    });

    return {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
    };
};

export const loginUser = async ({ email, password }) => {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user) {
        throw createError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
        throw createError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    return {
        id: user._id,
        username: user.username,
        email: user.email,
        _id: user._id,
    };
};

export const deleteUserAccount = async (userId) => {
    const user = await userRepository.delete(userId);
    if (!user) {
        throw createError("NOT_FOUND", "User not found", 404);
    }
    return user;
};

export const generateJti = () => crypto.randomUUID();
