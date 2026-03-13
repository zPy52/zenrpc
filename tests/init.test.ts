import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { resolveOwnPackageJsonPath, runInit } from "../src/cli/init";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

function createTempProject(packageName: string) {
  const cwd = mkdtempSync(resolve(tmpdir(), "zenrpc-init-"));
  tempDirs.push(cwd);

  writeFileSync(
    resolve(cwd, "package.json"),
    JSON.stringify(
      {
        name: packageName,
        private: true
      },
      null,
      2
    )
  );

  return cwd;
}

describe("runInit", () => {
  test("finds the package.json for both source and built CLI layouts", () => {
    const cwd = mkdtempSync(resolve(tmpdir(), "zenrpc-layout-"));
    tempDirs.push(cwd);

    writeFileSync(resolve(cwd, "package.json"), JSON.stringify({ name: "zenrpc", version: "1.0.2" }));
    mkdirSync(resolve(cwd, "src/cli"), { recursive: true });
    mkdirSync(resolve(cwd, "dist"), { recursive: true });

    expect(resolveOwnPackageJsonPath(resolve(cwd, "src/cli"))).toBe(resolve(cwd, "package.json"));
    expect(resolveOwnPackageJsonPath(resolve(cwd, "dist"))).toBe(resolve(cwd, "package.json"));
  });

  test("uses relative local imports when run inside the zenrpc package repo", () => {
    const cwd = createTempProject("zenrpc");

    runInit(cwd, {
      force: false,
      install: false,
      router: "app",
      sourceDir: "src/zenrpc"
    });

    const serverFile = readFileSync(resolve(cwd, "src/zenrpc/server.ts"), "utf8");
    const clientFile = readFileSync(resolve(cwd, "src/zenrpc/client.ts"), "utf8");
    const routeFile = readFileSync(resolve(cwd, "src/app/api/rpc/route.ts"), "utf8");

    expect(serverFile).toContain('import zr from "../index";');
    expect(clientFile).toContain('import zr from "../index";');
    expect(routeFile).toContain('import zr from "../../../index";');
  });

  test("uses package imports for regular consumer apps", () => {
    const cwd = createTempProject("my-app");

    runInit(cwd, {
      force: false,
      install: false,
      router: "app",
      sourceDir: "src/zenrpc"
    });

    const serverFile = readFileSync(resolve(cwd, "src/zenrpc/server.ts"), "utf8");
    const clientFile = readFileSync(resolve(cwd, "src/zenrpc/client.ts"), "utf8");
    const routeFile = readFileSync(resolve(cwd, "src/app/api/rpc/route.ts"), "utf8");

    expect(serverFile).toContain('import zr from "zenrpc";');
    expect(clientFile).toContain('import zr from "zenrpc";');
    expect(routeFile).toContain('import zr from "zenrpc";');
  });
});
