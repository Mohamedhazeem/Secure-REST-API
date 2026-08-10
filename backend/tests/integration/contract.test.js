import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { app } from "../../src/app.js";
import {
    CONTRACT_CANONICAL,
    CONTRACT_PUBLISHED,
    FUTURE_PATHS,
    assertContract,
    collectContractRoutes,
    collectImplementedRoutes,
    loadContract,
    resolveRef,
} from "../../src/docs/contract-check.js";

const listFiles = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) listFiles(full, out);
        else out.push(full);
    }
    return out;
};

describe("API contract completeness (US1)", () => {
    it("parses as a valid OpenAPI 3 document with paths and operations", () => {
        const doc = loadContract(join(CONTRACT_CANONICAL, "openapi.yaml"));
        expect(doc.openapi).toMatch(/^3\./);
        expect(doc.info.title).toBeTruthy();
        expect(doc.info.version).toBeTruthy();
        expect(doc.paths).toBeTruthy();
        expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    });

    it("asserts every documented path has an implementation route and vice versa", () => {
        expect(() => assertContract({ app })).not.toThrow();
    });

    it("documents every endpoint the app actually serves", () => {
        const doc = loadContract(join(CONTRACT_CANONICAL, "openapi.yaml"));
        const serverUrl = doc.servers?.[0]?.url ?? "/api/v1";
        const contractKeys = new Set(
            collectContractRoutes(doc, CONTRACT_CANONICAL).map(
                (r) => `${r.method} ${`${serverUrl}/${r.path}`.replace(/\/+/g, "/")}`
            )
        );
        const missing = collectImplementedRoutes(app, { doc, contractDir: CONTRACT_CANONICAL }).filter(
            (r) => !contractKeys.has(`${r.method} ${r.path}`)
        );
        expect(missing).toEqual([]);
    });

    it("keeps the published copy in sync with the canonical contract", () => {
        const canonicalFiles = listFiles(CONTRACT_CANONICAL).sort();
        const publishedFiles = listFiles(CONTRACT_PUBLISHED)
            .filter((file) => file.endsWith(".yaml"))
            .sort();
        expect(publishedFiles.length).toBe(canonicalFiles.length);
        for (const canonicalFile of canonicalFiles) {
            const rel = relative(CONTRACT_CANONICAL, canonicalFile);
            const publishedFile = join(CONTRACT_PUBLISHED, rel);
            expect(readFileSync(publishedFile, "utf8")).toBe(readFileSync(canonicalFile, "utf8"));
        }
    });

    it("tags every future-phase path with the task that implements it", () => {
        const doc = loadContract(join(CONTRACT_CANONICAL, "openapi.yaml"));
        const serverUrl = doc.servers?.[0]?.url ?? "/api/v1";
        const contractKeys = new Set(
            collectContractRoutes(doc, CONTRACT_CANONICAL).map(
                (r) => `${r.method} ${`${serverUrl}/${r.path}`.replace(/\/+/g, "/")}`
            )
        );
        for (const future of FUTURE_PATHS) {
            const key = `${future.method} ${`${serverUrl}/${future.path}`.replace(/\/+/g, "/")}`;
            expect(contractKeys.has(key), `FUTURE_PATHS references undocumentd route ${key} (${future.task})`).toBe(
                true
            );
            expect(future.task).toMatch(/^T(\d{3}|BD)/);
        }
    });

    it("keeps every FUTURE_PATHS task tracked in tasks.md", () => {
        const tasksMd = readFileSync(
            join(CONTRACT_CANONICAL, "../tasks.md"),
            "utf8"
        );
        const knownTasks = new Set(
            [...tasksMd.matchAll(/\bT\d{3}\b/g)].map((match) => match[0])
        );
        for (const future of FUTURE_PATHS) {
            if (future.task === "TBD") continue;
            expect(knownTasks.has(future.task), `FUTURE_PATHS task ${future.task} missing from tasks.md`).toBe(true);
        }
    });

    it("gives every shared response component the standard correlation and CORS headers", () => {
        const doc = loadContract(join(CONTRACT_CANONICAL, "openapi.yaml"));
        const responses = resolveRef(
            join(CONTRACT_CANONICAL, "openapi.yaml"),
            doc,
            { $ref: "./components/responses.yaml" }
        );
        const standardHeaders = [
            "X-Correlation-Id",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
            "Access-Control-Allow-Methods",
            "Access-Control-Allow-Headers",
        ];
        const names = Object.keys(responses ?? {});
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
            const headers = Object.keys(responses[name].headers ?? {});
            for (const header of standardHeaders) {
                expect(headers, `${name} missing header ${header}`).toContain(header);
            }
        }
    });
});
