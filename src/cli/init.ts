import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type RouterMode = "app" | "auto" | "both" | "pages";
type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

export interface InitOptions {
  force: boolean;
  install: boolean;
  packageManager?: PackageManager;
  router: RouterMode;
  sourceDir: string;
}

interface GeneratedFile {
  path: string;
  contents: string;
}

function relativeImport(fromFile: string, toFile: string) {
  const importPath = relative(resolve(fromFile, ".."), toFile)
    .replace(/\\/g, "/")
    .replace(/\.[^.]+$/, "");
  return importPath.startsWith(".") ? importPath : `./${importPath}`;
}

function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (existsSync(resolve(cwd, "bun.lock")) || existsSync(resolve(cwd, "bun.lockb"))) {
    return "bun";
  }

  if (existsSync(resolve(cwd, "yarn.lock"))) {
    return "yarn";
  }

  if (existsSync(resolve(cwd, "package-lock.json"))) {
    return "npm";
  }

  const userAgent = process.env.npm_config_user_agent ?? "";

  if (userAgent.startsWith("pnpm")) {
    return "pnpm";
  }

  if (userAgent.startsWith("yarn")) {
    return "yarn";
  }

  if (userAgent.startsWith("bun")) {
    return "bun";
  }

  return "npm";
}

function readOwnVersion() {
  const packageJsonPath = resolve(__dirname, "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };
  return packageJson.version;
}

function chooseAppRouteFile(cwd: string) {
  const srcRoute = resolve(cwd, "src/app/api/rpc/route.ts");
  const rootRoute = resolve(cwd, "app/api/rpc/route.ts");

  if (existsSync(resolve(cwd, "app"))) {
    return rootRoute;
  }

  return srcRoute;
}

function choosePagesRouteFile(cwd: string) {
  const srcRoute = resolve(cwd, "src/pages/api/rpc.ts");
  const rootRoute = resolve(cwd, "pages/api/rpc.ts");

  if (existsSync(resolve(cwd, "pages"))) {
    return rootRoute;
  }

  return srcRoute;
}

function resolveRouterTargets(cwd: string, router: RouterMode) {
  const hasAppRouter = existsSync(resolve(cwd, "src/app")) || existsSync(resolve(cwd, "app"));
  const hasPagesRouter = existsSync(resolve(cwd, "src/pages")) || existsSync(resolve(cwd, "pages"));

  if (router === "app") {
    return { app: true, pages: false };
  }

  if (router === "pages") {
    return { app: false, pages: true };
  }

  if (router === "both") {
    return { app: true, pages: true };
  }

  if (hasAppRouter && hasPagesRouter) {
    return { app: true, pages: true };
  }

  if (hasPagesRouter) {
    return { app: false, pages: true };
  }

  return { app: true, pages: false };
}

function createNextrpcFiles(cwd: string, sourceDir: string): GeneratedFile[] {
  const nextrpcDir = resolve(cwd, sourceDir);

  return [
    {
      contents: [
        'import n from "zenrpc";',
        'import type { PublicApi } from "./api-types";',
        "",
        "export const rpc = n.createClient<PublicApi>({",
        '  url: "/api/rpc"',
        "});",
        ""
      ].join("\n"),
      path: resolve(nextrpcDir, "client.ts")
    },
    {
      contents: [
        'import type { server } from "./server";',
        "",
        "export type PublicApi = typeof server;",
        ""
      ].join("\n"),
      path: resolve(nextrpcDir, "api-types.ts")
    },
    {
      contents: [
        'import "server-only";',
        "",
        'import n from "zenrpc";',
        'import { z } from "zod";',
        "",
        "const taskLists = {",
        "  default: [{ _id: \"task_1\", text: \"Ship ZenRPC\" }]",
        "};",
        "",
        "export const server = n.createServer({",
        "  posts: {",
        "    options: {",
        "      get: n.endpoint({ postId: z.string() }, async ({ postId }) => ({",
        "          body: `This post came from ${postId}.`,",
        "          id: postId,",
        "          title: \"Example post\"",
        "        }))",
        "    }",
        "  },",
        "  tasks: n.createServer({",
        "    add: n.endpoint({ text: z.string() }, async ({ text }) => {",
        "        const task = { _id: `task_${Date.now()}`, text };",
        "        taskLists.default.push(task);",
        "        return task;",
        "      }),",
        "    get: n.endpoint({ taskListId: z.string() }, async ({ taskListId }) => {",
        "        return taskListId === \"default\" ? taskLists.default : [];",
        "      })",
        "  })",
        "});",
        ""
      ].join("\n"),
      path: resolve(nextrpcDir, "server.ts")
    }
  ];
}

function createRouteFiles(cwd: string, sourceDir: string, router: RouterMode): GeneratedFile[] {
  const routeTargets = resolveRouterTargets(cwd, router);
  const serverFile = resolve(cwd, sourceDir, "server.ts");
  const files: GeneratedFile[] = [];

  if (routeTargets.app) {
    const appRouteFile = chooseAppRouteFile(cwd);
    files.push({
      contents: [
        'import n from "zenrpc";',
        `import { server } from "${relativeImport(appRouteFile, serverFile)}";`,
        "",
        "export const POST = n.POSTHandler(server);",
        ""
      ].join("\n"),
      path: appRouteFile
    });
  }

  if (routeTargets.pages) {
    const pagesRouteFile = choosePagesRouteFile(cwd);
    files.push({
      contents: [
        'import n from "zenrpc";',
        `import { server } from "${relativeImport(pagesRouteFile, serverFile)}";`,
        "",
        "export default n.createPagesHandler(server);",
        ""
      ].join("\n"),
      path: pagesRouteFile
    });
  }

  return files;
}

function writeGeneratedFiles(files: GeneratedFile[], force: boolean) {
  const conflicts = files.filter((file) => existsSync(file.path));

  if (conflicts.length > 0 && !force) {
    const conflictList = conflicts.map((file) => `- ${relative(process.cwd(), file.path)}`).join("\n");
    throw new Error(`Refusing to overwrite existing files:\n${conflictList}\nRe-run with --force.`);
  }

  for (const file of files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.contents, "utf8");
  }
}

function installDependencies(cwd: string, packageManager: PackageManager) {
  const version = readOwnVersion();
  const dependency = `zenrpc@${version}`;
  const installCommand =
    packageManager === "pnpm"
      ? ["add", dependency, "zod"]
      : packageManager === "yarn"
        ? ["add", dependency, "zod"]
        : packageManager === "bun"
          ? ["add", dependency, "zod"]
          : ["install", dependency, "zod"];

  const result = spawnSync(packageManager, installCommand, {
    cwd,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Dependency installation failed using ${packageManager}.`);
  }
}

export function runInit(cwd: string, options: InitOptions) {
  if (!existsSync(resolve(cwd, "package.json"))) {
    throw new Error("Run `zenrpc init` inside a project that already has a package.json.");
  }

  const nextrpcFiles = createNextrpcFiles(cwd, options.sourceDir);
  const routeFiles = createRouteFiles(cwd, options.sourceDir, options.router);
  const files = [...nextrpcFiles, ...routeFiles];

  writeGeneratedFiles(files, options.force);

  const packageManager = options.packageManager ?? detectPackageManager(cwd);

  if (options.install) {
    installDependencies(cwd, packageManager);
  }

  return {
    files: files.map((file) => relative(cwd, file.path)),
    packageManager
  };
}
