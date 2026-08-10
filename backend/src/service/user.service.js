import bcrypt from "bcrypt";
import crypto from "crypto";
import mongoose from "mongoose";
import UserRepository from "../repositories/implementations/mongoose/user.repository.js";
import RoleRepository from "../repositories/implementations/mongoose/role.repository.js";
import PermissionRepository from "../repositories/implementations/mongoose/permission.repository.js";
import PostRepository from "../repositories/implementations/mongoose/post.repository.js";
import { revokeAllSessions } from "./session.service.js";
import { createError } from "../utils/errors.js";

const userRepository = new UserRepository();
const roleRepository = new RoleRepository();
const permissionRepository = new PermissionRepository();
const postRepository = new PostRepository();

const DEFAULT_ROLE = "user";

const DELETED_USERNAME = "[deleted]";
const DELETED_EMAIL = "deleted@trustfeed.local";

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

/**
 * Shared "[deleted]" attribution placeholder (FR-038). Authored content is
 * reassigned to this system account so threads and feeds keep their context
 * while the original owner's personal data is permanently removed.
 */
const ensureDeletedPlaceholder = async () => {
    const existing = await userRepository.findOne({ username: DELETED_USERNAME });
    if (existing) return existing;
    try {
        return await userRepository.create({
            username: DELETED_USERNAME,
            email: DELETED_EMAIL,
            password: crypto.randomBytes(12).toString("hex"),
        });
    } catch (error) {
        const raced = await userRepository.findOne({ username: DELETED_USERNAME });
        if (raced) return raced;
        throw error;
    }
};

/**
 * Anonymize or remove social-graph data (FR-038).
 *
 * Comment, Like, and Follow models are introduced by US4/US5 (T044-T049).
 * They are resolved through the Mongoose model registry when registered so
 * account deletion automatically covers the full social graph as those
 * phases land, without persistence coupling in this service.
 */
const anonymizeSocialData = async (userId, placeholderId) => {
    const Comment = mongoose.models.Comment;
    if (Comment) {
        await Comment.updateMany({ authorId: userId }, { $set: { authorId: placeholderId } });
    }
    const Like = mongoose.models.Like;
    if (Like) {
        await Like.deleteMany({ userId });
    }
    const Follow = mongoose.models.Follow;
    if (Follow) {
        await Follow.deleteMany({ $or: [{ followerId: userId }, { followingId: userId }] });
    }
};

/**
 * Delete an account (T031, FR-038): reassign authored posts to the
 * "[deleted]" placeholder, anonymize/remove social data, revoke every
 * session, and permanently remove credentials and personal data.
 *
 * The placeholder is prepared before sessions are revoked so a failure
 * mid-deletion never leaves the user locked out with nothing deleted.
 */
export const deleteUserAccount = async (userId) => {
    const user = await userRepository.findById(userId);
    if (!user) {
        throw createError("NOT_FOUND", "User not found", 404);
    }

    const placeholder = await ensureDeletedPlaceholder();
    await revokeAllSessions({ userId });
    await postRepository.reassignAuthor(userId, placeholder._id);
    await anonymizeSocialData(userId, placeholder._id);

    await userRepository.permanentlyDelete(userId);
    return user;
};
