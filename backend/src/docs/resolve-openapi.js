import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { load } from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONTRACT_DIR = resolve(__dirname, "openapi");

const fileCache = new Map();

function resolveRef(fromFile, value) {
  if (!value || typeof value !== "object" || typeof value.$ref !== "string") return value;
  const ref = value.$ref;
  const [filePart, fragment] = ref.split("#");
  let target = load(readFileSync(fromFile, "utf8"));
  let targetFile = fromFile;
  if (filePart) {
    targetFile = resolve(dirname(fromFile), filePart);
    if (!fileCache.has(targetFile)) {
      fileCache.set(targetFile, load(readFileSync(targetFile, "utf8")));
    }
    target = fileCache.get(targetFile);
  }
  if (!fragment) return { value: target, file: targetFile };
  let current = target;
  for (const part of fragment.slice(1).split("/").map(decodeURIComponent)) {
    if (current == null) return undefined;
    current = current[part];
  }
  return { value: current, file: targetFile };
}

function resolveAll(obj, fromFile) {
  if (Array.isArray(obj)) {
    return obj.map((item) => resolveAll(item, fromFile));
  }
  if (obj && typeof obj === "object") {
    if (typeof obj.$ref === "string") {
      const resolved = resolveRef(fromFile, obj);
      if (resolved && typeof resolved.value === "object") {
        return resolveAll(resolved.value, resolved.file);
      }
      return resolved?.value;
    }
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveAll(value, fromFile);
    }
    return result;
  }
  return obj;
}

export function resolveOpenApiContract() {
  const rootPath = join(CONTRACT_DIR, "openapi.yaml");
  const doc = load(readFileSync(rootPath, "utf8"));
  return resolveAll(doc, rootPath);
}
