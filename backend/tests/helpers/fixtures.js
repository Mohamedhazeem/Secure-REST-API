import User from "../../src/models/user.model.js";
import Post from "../../src/models/post.model.js";
import { seedRolesAndPermissions } from "../../src/configs/seed.js";

export const createUser = async (overrides = {}) => {
    const user = await User.create({
        username: overrides.username ?? `user_${crypto.randomUUID().slice(0, 8)}`,
        email: overrides.email ?? `${crypto.randomUUID().slice(0, 8)}@example.com`,
        password: overrides.password ?? "StrongPass123!",
        ...overrides,
    });
    return { user, password: overrides.password ?? "StrongPass123!" };
};

export const createPost = async ({ author, overrides = {} }) => {
    return Post.create({
        name: overrides.name ?? "Test post",
        description: overrides.description ?? "Test post description",
        age: overrides.age ?? 25,
        author: author._id ?? author,
        ...overrides,
    });
};

export const seedRoles = async () => seedRolesAndPermissions();
