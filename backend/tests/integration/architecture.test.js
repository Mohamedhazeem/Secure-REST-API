import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "src");

const read = (rel) => readFileSync(join(src, rel), "utf8");

describe("clean architecture layering", () => {
  it("post controller depends on the service, not on models", () => {
    const srcCode = read("controller/post.controller.js");
    expect(srcCode).toMatch(/from "\.\.\/service\/post\.service\.js"/);
    expect(srcCode).not.toMatch(/from "\.\.\/models\//);
  });

  it("post service depends on a repository, not on models", () => {
    const srcCode = read("service/post.service.js");
    expect(srcCode).toMatch(/repositories\/implementations\/mongoose\/post\.repository\.js/);
    expect(srcCode).not.toMatch(/from "\.\.\/models\//);
  });

  it("user controller depends on services, not on models", () => {
    const srcCode = read("controller/user.controller.js");
    expect(srcCode).toMatch(/from "\.\.\/service\/user\.service\.js"/);
    expect(srcCode).not.toMatch(/from "\.\.\/models\//);
  });

  it("user service depends on repositories, not on models", () => {
    const srcCode = read("service/user.service.js");
    expect(srcCode).toMatch(/repositories\/implementations\/mongoose\//);
    expect(srcCode).not.toMatch(/from "\.\.\/models\//);
  });

  it("controllers never talk to Redis directly", () => {
    for (const file of ["controller/post.controller.js", "controller/user.controller.js"]) {
      const srcCode = read(file);
      expect(srcCode).not.toMatch(/configs\/redis\.js/);
    }
  });
});
