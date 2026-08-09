import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

const ALLOWED = "https://allowed.example.com";
const DISALLOWED = "https://evil.example.com";

describe("CORS middleware", () => {
    it("sets CORS headers for a configured allowed origin", async () => {
        const res = await request(app).get("/api/v1/posts").set("Origin", ALLOWED);
        expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("does not set CORS headers for a disallowed origin", async () => {
        const res = await request(app).get("/api/v1/posts").set("Origin", DISALLOWED);
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("handles preflight OPTIONS with 204 and method headers", async () => {
        const res = await request(app).options("/api/v1/posts").set("Origin", ALLOWED);
        expect(res.status).toBe(204);
        expect(res.headers["access-control-allow-methods"]).toBeDefined();
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("rejects preflight from disallowed origin with no CORS headers", async () => {
        const res = await request(app).options("/api/v1/posts").set("Origin", DISALLOWED);
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
});
