import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("app smoke test", () => {
    it("returns 404 for unknown routes", async () => {
        const res = await request(app).get("/api/v1/nonexistent");
        expect(res.status).toBe(404);
    });

    it("rejects unauthenticated access to protected routes", async () => {
        const res = await request(app).get("/api/v1/posts");
        expect(res.status).toBe(401);
    });
});
