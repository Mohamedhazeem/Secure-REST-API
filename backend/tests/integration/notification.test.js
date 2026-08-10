import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/user.model.js";
import Role from "../../src/models/role.model.js";
import Permission from "../../src/models/permission.model.js";

const unique = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 9)}`;

const registerAndLogin = async (username, email, password = "password123") => {
    await request(app).post("/api/v1/auth").send({ username, email, password });
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    return login.headers["set-cookie"];
};

const grantPermissions = async (email, codes) => {
    const perms = [];
    for (const code of codes) {
        const p = await Permission.findOneAndUpdate(
            { code },
            { code, description: code },
            { upsert: true, returnDocument: "after" }
        );
        perms.push(p._id);
    }
    const role = await Role.create({ name: unique("role"), permissions: perms });
    await User.findOneAndUpdate({ email: email.toLowerCase() }, { roles: [role._id] });
};

const userIdByEmail = async (email) => {
    const user = await User.findOne({ email: email.toLowerCase() });
    return user._id.toString();
};

const RECIPIENT_PERMISSIONS = ["posts:create", "posts:read", "notifications:read", "notifications:update"];
const ACTOR_PERMISSIONS = ["comments:create", "comments:read", "likes:create", "follows:create", "posts:read"];

const createUser = async (prefix, permissions) => {
    const username = unique(prefix);
    const email = `${username}@example.com`;
    const cookies = await registerAndLogin(username, email);
    await grantPermissions(email, permissions);
    return { username, email, cookies, userId: await userIdByEmail(email) };
};

const createRecipientWithPost = async (content = "notify me") => {
    const recipient = await createUser("recipient", RECIPIENT_PERMISSIONS);
    const created = await request(app)
        .post("/api/v1/posts")
        .set("Cookie", recipient.cookies)
        .send({ content });
    expect(created.status).toBe(201);
    return { ...recipient, postId: created.body.post._id };
};

const listNotifications = async (user) => {
    const res = await request(app).get("/api/v1/notifications").set("Cookie", user.cookies);
    expect(res.status).toBe(200);
    return res.body;
};

describe("notifications for social events (US5, T070, FR-027)", () => {
    it("creates a comment notification for the post author", async () => {
        const recipient = await createRecipientWithPost("post that gets commented on");
        const actor = await createUser("commenter", ACTOR_PERMISSIONS);

        const comment = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", actor.cookies)
            .send({ content: "great post", idempotencyKey: unique("cmt") });
        expect(comment.status).toBe(201);
        expect(comment.body.postId).toBe(recipient.postId);
        expect(comment.body.authorId).toBe(actor.userId);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
        const [notification] = notifications.data;
        expect(notification.type).toBe("comment");
        expect(notification.recipientId).toBe(recipient.userId);
        expect(notification.actorId).toBe(actor.userId);
        expect(notification.actorName).toBe(actor.username);
        expect(notification.action).toBeTruthy();
        expect(notification.targetSummary).toBeTruthy();
        expect(notification.deepLink).toContain(recipient.postId);
        expect(notification.resourceId).toBe(comment.body._id);
        expect(notification.read).toBe(false);
    });

    it("creates a follow notification for the followed user", async () => {
        const recipient = await createUser("followed", RECIPIENT_PERMISSIONS);
        const actor = await createUser("follower", ACTOR_PERMISSIONS);

        const follow = await request(app)
            .post(`/api/v1/users/${recipient.userId}/follow`)
            .set("Cookie", actor.cookies);
        expect(follow.status).toBe(201);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
        const [notification] = notifications.data;
        expect(notification.type).toBe("follow");
        expect(notification.recipientId).toBe(recipient.userId);
        expect(notification.actorId).toBe(actor.userId);
        expect(notification.actorName).toBe(actor.username);
        expect(notification.deepLink).toContain(actor.userId);
    });

    it("creates a like notification for the post author", async () => {
        const recipient = await createRecipientWithPost("post that gets liked");
        const actor = await createUser("liker", ACTOR_PERMISSIONS);

        const like = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/likes`)
            .set("Cookie", actor.cookies)
            .send({ idempotencyKey: unique("like") });
        expect(like.status).toBe(201);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
        const [notification] = notifications.data;
        expect(notification.type).toBe("like");
        expect(notification.recipientId).toBe(recipient.userId);
        expect(notification.actorId).toBe(actor.userId);
        expect(notification.resourceId).toBe(recipient.postId);
        expect(notification.deepLink).toContain(recipient.postId);
    });

    it("lists notifications in reverse chronological order", async () => {
        const recipient = await createRecipientWithPost("post with several interactions");
        const actor = await createUser("busyactor", ACTOR_PERMISSIONS);

        await request(app)
            .post(`/api/v1/users/${recipient.userId}/follow`)
            .set("Cookie", actor.cookies);
        await request(app)
            .post(`/api/v1/posts/${recipient.postId}/likes`)
            .set("Cookie", actor.cookies)
            .send({ idempotencyKey: unique("like") });
        await request(app)
            .post(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", actor.cookies)
            .send({ content: "nice one", idempotencyKey: unique("cmt") });

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(3);
        expect(notifications.data.map((n) => n.type)).toEqual(["comment", "like", "follow"]);
    });

    it("never notifies a user about their own action", async () => {
        const recipient = await createRecipientWithPost("self interaction");
        await grantPermissions(recipient.email, [...RECIPIENT_PERMISSIONS, ...ACTOR_PERMISSIONS]);

        const comment = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", recipient.cookies)
            .send({ content: "commenting on my own post", idempotencyKey: unique("cmt") });
        expect(comment.status).toBe(201);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(0);
    });

    it("marks a notification as read and refuses notifications owned by others", async () => {
        const recipient = await createRecipientWithPost("mark read");
        const actor = await createUser("reader", ACTOR_PERMISSIONS);
        const other = await createUser("intruder", RECIPIENT_PERMISSIONS);

        await request(app)
            .post(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", actor.cookies)
            .send({ content: "read me", idempotencyKey: unique("cmt") });

        const before = await listNotifications(recipient);
        const notificationId = before.data[0]._id;

        const marked = await request(app)
            .patch(`/api/v1/notifications/${notificationId}/read`)
            .set("Cookie", recipient.cookies);
        expect(marked.status).toBe(200);
        expect(marked.body.read).toBe(true);

        const foreign = await request(app)
            .patch(`/api/v1/notifications/${notificationId}/read`)
            .set("Cookie", other.cookies);
        expect(foreign.status).toBe(404);
        expect(foreign.body.code).toBe("NOT_FOUND");
    });

    it("requires authentication to list notifications", async () => {
        const res = await request(app).get("/api/v1/notifications");
        expect(res.status).toBe(401);
    });

    it("rejects malformed identifiers with an explicit 400", async () => {
        const recipient = await createUser("badids", [...RECIPIENT_PERMISSIONS, ...ACTOR_PERMISSIONS]);

        const comment = await request(app)
            .post("/api/v1/posts/not-an-id/comments")
            .set("Cookie", recipient.cookies)
            .send({ content: "nowhere to go" });
        expect(comment.status).toBe(400);
        expect(comment.body.code).toBe("VALIDATION_ERROR");

        const marked = await request(app)
            .patch("/api/v1/notifications/not-an-id/read")
            .set("Cookie", recipient.cookies);
        expect(marked.status).toBe(400);
        expect(marked.body.code).toBe("VALIDATION_ERROR");
    });
});

describe("notification idempotency (US5, T071, FR-027)", () => {
    it("returns the same comment and exactly one notification for a replayed idempotency key", async () => {
        const recipient = await createRecipientWithPost("idempotent comments");
        const actor = await createUser("replayer", ACTOR_PERMISSIONS);
        const idempotencyKey = unique("cmt");

        const first = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", actor.cookies)
            .send({ content: "only once", idempotencyKey });
        expect(first.status).toBe(201);

        const replay = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", actor.cookies)
            .send({ content: "only once", idempotencyKey });
        expect(replay.status).toBe(409);
        expect(replay.body._id).toBe(first.body._id);

        const comments = await request(app)
            .get(`/api/v1/posts/${recipient.postId}/comments`)
            .set("Cookie", actor.cookies);
        expect(comments.status).toBe(200);
        expect(comments.body.total).toBe(1);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
        expect(notifications.data[0].type).toBe("comment");
    });

    it("produces exactly one follow notification when the follow is repeated", async () => {
        const recipient = await createUser("followedonce", RECIPIENT_PERMISSIONS);
        const actor = await createUser("refollower", ACTOR_PERMISSIONS);

        const first = await request(app)
            .post(`/api/v1/users/${recipient.userId}/follow`)
            .set("Cookie", actor.cookies);
        expect(first.status).toBe(201);

        const second = await request(app)
            .post(`/api/v1/users/${recipient.userId}/follow`)
            .set("Cookie", actor.cookies);
        expect(second.status).toBe(409);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
        expect(notifications.data[0].type).toBe("follow");
    });

    it("produces exactly one like notification when the like is repeated", async () => {
        const recipient = await createRecipientWithPost("idempotent likes");
        const actor = await createUser("repeatliker", ACTOR_PERMISSIONS);
        const idempotencyKey = unique("like");

        const first = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/likes`)
            .set("Cookie", actor.cookies)
            .send({ idempotencyKey });
        expect(first.status).toBe(201);

        const second = await request(app)
            .post(`/api/v1/posts/${recipient.postId}/likes`)
            .set("Cookie", actor.cookies)
            .send({ idempotencyKey });
        expect(second.status).toBe(409);

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
        expect(notifications.data[0].type).toBe("like");
    });

    it("delivers a notification only once when the same job is dispatched twice", async () => {
        const { dispatchNotification } = await import("../../src/workers/notification.worker.js");
        const recipient = await createRecipientWithPost("duplicate dispatch");
        const actor = await createUser("dupdispatch", ACTOR_PERMISSIONS);

        const job = {
            type: "like",
            recipientId: recipient.userId,
            actorId: actor.userId,
            resourceId: recipient.postId,
            dedupeKey: `like:${recipient.postId}:${actor.userId}`,
        };
        await dispatchNotification(job);
        await dispatchNotification({ ...job });

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(1);
    });
});

describe("notification delivery failures (US5, T082, SC-017)", () => {
    it("dead-letters a job that can never succeed instead of retrying forever", async () => {
        const { dispatchNotification, getDeadLetters, clearDeadLetters } = await import(
            "../../src/workers/notification.worker.js"
        );
        clearDeadLetters();

        const result = await dispatchNotification({
            type: "like",
            recipientId: "not-an-object-id",
            actorId: "not-an-object-id",
            resourceId: "not-an-object-id",
            dedupeKey: "malformed-job",
        });
        expect(result.deadLettered).toBe(true);

        const deadLetters = getDeadLetters();
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].job.dedupeKey).toBe("malformed-job");
        expect(deadLetters[0].error).toMatch(/Invalid notification job/);
        clearDeadLetters();
    });

    it("dead-letters a job whose actor no longer exists", async () => {
        const { dispatchNotification, getDeadLetters, clearDeadLetters } = await import(
            "../../src/workers/notification.worker.js"
        );
        const recipient = await createUser("orphanrecip", RECIPIENT_PERMISSIONS);
        clearDeadLetters();

        const result = await dispatchNotification({
            type: "follow",
            recipientId: recipient.userId,
            actorId: "64b2c4d3e4b0c2a5f8e9d000",
            resourceId: "64b2c4d3e4b0c2a5f8e9d001",
            dedupeKey: "missing-actor-job",
        });
        expect(result.deadLettered).toBe(true);
        expect(getDeadLetters().map((entry) => entry.job.dedupeKey)).toContain("missing-actor-job");

        const notifications = await listNotifications(recipient);
        expect(notifications.total).toBe(0);
        clearDeadLetters();
    });
});
