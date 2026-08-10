import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { load } from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONTRACT_CANONICAL = resolve(__dirname, "../../../specs/002-trustfeed-social-api/contracts");
export const CONTRACT_PUBLISHED = join(__dirname, "openapi");

export const FUTURE_PATHS = [
    { method: "GET", path: "users/me", task: "TBD" },
    { method: "PATCH", path: "users/me", task: "TBD" },
    { method: "POST", path: "users/{id}/follow", task: "T055" },
    { method: "DELETE", path: "users/{id}/unfollow", task: "T055" },
    { method: "POST", path: "posts/{id}/likes", task: "T056" },
    { method: "DELETE", path: "posts/{id}/likes", task: "T056" },
    { method: "GET", path: "posts/{id}/likes/me", task: "T056" },
    { method: "GET", path: "feed", task: "T057" },
    { method: "GET", path: "posts/{id}/comments", task: "T083" },
    { method: "POST", path: "posts/{id}/comments", task: "T083" },
    { method: "GET", path: "notifications", task: "T084" },
    { method: "PATCH", path: "notifications/{id}/read", task: "T084" },
    { method: "GET", path: "auth/sessions", task: "T029" },
    { method: "DELETE", path: "auth/sessions/{id}", task: "T029" },
];

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

export function loadContract(file) {
    return load(readFileSync(file, "utf8"));
}

export function resolveRef(fromFile, doc, value, fileCache) {
    if (!value || typeof value !== "object" || typeof value.$ref !== "string") return value;
    const ref = value.$ref;
    const [filePart, fragment] = ref.split("#");
    let target = doc;
    if (filePart) {
        const file = resolve(dirname(fromFile), filePart);
        target = fileCache?.get(file);
        if (!target) {
            target = load(readFileSync(file, "utf8"));
            fileCache?.set(file, target);
        }
    }
    if (!fragment) return target;
    let current = target;
    for (const part of fragment.slice(1).split("/").map(decodeURIComponent)) {
        if (current == null) return undefined;
        current = current[part];
    }
    return current;
}

export function normalizePath(path) {
    return path
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .replace(/:([^/]+)/g, "{$1}");
}

export function collectContractRoutes(doc, contractDir) {
    const routes = [];
    const fileCache = new Map();
    for (const [pathKey, rawItem] of Object.entries(doc.paths ?? {})) {
        if (pathKey.startsWith("x-")) continue;
        const item = resolveRef(join(contractDir, "openapi.yaml"), doc, rawItem, fileCache);
        if (!item || typeof item !== "object") continue;
        for (const method of HTTP_METHODS) {
            if (item[method]) routes.push({ method: method.toUpperCase(), path: normalizePath(pathKey) });
        }
    }
    return routes;
}

export function collectImplementedRoutes(app, { doc, contractDir } = {}) {
    const router = app.router ?? app._router;
    if (!router?.stack) return [];
    const serverUrl = doc?.servers?.[0]?.url ?? "/api/v1";
    const probePath = (path) => path.replace(/\{([^}]+)\}/g, "probe");
    const collected = new Map();
    const walk = (stack, path, prefix) => {
        for (const layer of stack) {
            if (!layer || typeof layer.match !== "function") continue;
            let matched;
            try {
                matched = layer.match(path);
            } catch {
                matched = false;
            }
            if (!matched) continue;
            const consumed = layer.path ?? "";
            if (layer.route) {
                const full = normalizePath(prefix + layer.route.path);
                for (const method of Object.keys(layer.route.methods ?? {}).filter((m) => m !== "_all")) {
                    collected.set(`${method.toUpperCase()} /${full}`, {
                        method: method.toUpperCase(),
                        path: `/${full}`,
                    });
                }
            } else if (layer.handle?.stack) {
                const remainder = path.slice(consumed.length);
                walk(layer.handle.stack, remainder === "" ? "/" : remainder, prefix + consumed);
            }
        }
    };
    const candidates = collectContractRoutes(doc ?? loadContract(join(contractDir, "openapi.yaml")), contractDir);
    for (const route of candidates) {
        const concrete = `${serverUrl}/${probePath(route.path)}`.replace(/\/+/g, "/");
        walk(router.stack, concrete, "");
    }
    return [...collected.values()];
}

export function assertContract({ app, contractDir = CONTRACT_PUBLISHED } = {}) {
    const doc = loadContract(join(contractDir, "openapi.yaml"));
    const serverUrl = doc.servers?.[0]?.url ?? "/api/v1";
    const contractRoutes = collectContractRoutes(doc, contractDir);
    const implementedRoutes = collectImplementedRoutes(app, { doc, contractDir });
    const implementedKeys = new Set(implementedRoutes.map((r) => `${r.method} ${r.path}`));
    const futureKeys = new Set(FUTURE_PATHS.map((f) => `${f.method} ${serverUrl}/${f.path}`));
    const problems = [];
    for (const route of contractRoutes) {
        const key = `${route.method} ${serverUrl}/${route.path}`;
        if (futureKeys.has(key)) continue;
        if (!implementedKeys.has(key)) problems.push(`No implementation for ${key}`);
    }
    for (const route of implementedRoutes) {
        if (!contractRoutes.some((r) => `${r.method} ${serverUrl}/${r.path}` === `${route.method} ${route.path}`)) {
            problems.push(`No contract entry for ${route.method} ${route.path}`);
        }
    }
    if (problems.length > 0) {
        throw new Error(`Contract validation failed (${problems.length} issue${problems.length === 1 ? "" : "s"}):\n- ${problems.join("\n- ")}`);
    }
    return { contractRoutes, implementedRoutes };
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (isDirectRun) {
    process.env.NODE_ENV = "test";
    const { app } = await import("../app.js");
    try {
        const { contractRoutes, implementedRoutes } = assertContract({ app });
        console.log(
            `Contract check passed: ${contractRoutes.length} documented paths, ${implementedRoutes.length} implemented routes.`
        );
        process.exitCode = 0;
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
