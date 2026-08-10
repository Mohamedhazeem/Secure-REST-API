import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("console routes (US1, T031)", () => {
    it("GET /console returns HTML with TrustFeed title", async () => {
        const res = await request(app).get("/console");
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/text\/html/);
        expect(res.text).toContain("TrustFeed API Console");
    });

    it("GET /console/openapi.json returns resolved OpenAPI document", async () => {
        const res = await request(app).get("/console/openapi.json");
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/application\/json/);
        const doc = res.body;
        expect(doc).toHaveProperty("openapi");
        expect(doc).toHaveProperty("info");
        expect(doc).toHaveProperty("paths");
        expect(doc).toHaveProperty("components");
        expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    });
});
