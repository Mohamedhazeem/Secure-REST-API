import Permission from "../models/permission.model.js";
import Role from "../models/role.model.js";

const PERMISSION_CODES = [
  "posts:create",
  "posts:read",
  "posts:update",
  "posts:delete",
  "users:read",
  "users:delete",
  "follows:create",
  "follows:delete",
  "likes:create",
  "likes:delete",
  "likes:read",
  "feed:read",
];

const PERMISSION_DESCRIPTIONS = {
  "posts:create": "Create new posts",
  "posts:read": "View posts",
  "posts:update": "Update own posts",
  "posts:delete": "Delete own posts",
  "users:read": "View user profiles",
  "users:delete": "Delete user accounts",
  "follows:create": "Follow users",
  "follows:delete": "Unfollow users",
  "likes:create": "Like posts",
  "likes:delete": "Unlike posts",
  "likes:read": "View like status",
  "feed:read": "Read the personalized feed",
};

const ROLES = [
  {
    name: "user",
    permissionCodes: ["posts:read", "posts:create"],
  },
  {
    name: "admin",
    permissionCodes: PERMISSION_CODES,
  },
];

export async function seedRolesAndPermissions() {
  const permissionDocs = await Promise.all(
    PERMISSION_CODES.map((code) =>
      Permission.findOneAndUpdate(
        { code },
        { code, description: PERMISSION_DESCRIPTIONS[code] || "" },
        { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" }
      )
    )
  );

  const permissionMap = new Map(
    permissionDocs.map((doc) => [doc.code, doc._id])
  );

  for (const roleDef of ROLES) {
    const permissionIds = roleDef.permissionCodes
      .map((code) => permissionMap.get(code))
      .filter(Boolean);

    await Role.findOneAndUpdate(
      { name: roleDef.name },
      { name: roleDef.name, permissions: permissionIds },
      { upsert: true, setDefaultsOnInsert: true, returnDocument: "after" }
    );
  }
}
