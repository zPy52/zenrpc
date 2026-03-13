import { resolve } from "node:path";

import { runInit } from "./init";

function printHelp() {
  console.log(
    [
      "ZenRPC",
      "",
      "Usage:",
      "  zenrpc init [--router app|pages|both|auto] [--dir src/zenrpc] [--force] [--no-install]",
      "",
      "Examples:",
      "  pnpm dlx zenrpc@latest init",
      "  npx zenrpc@latest init --router pages",
      "  bunx --bun zenrpc@latest init --force"
    ].join("\n")
  );
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  const command = args.shift();

  if (!command || command === "--help" || command === "-h") {
    return { command: "help" as const };
  }

  if (command !== "init") {
    throw new Error(`Unknown command "${command}".`);
  }

  const options = {
    force: false,
    install: true,
    router: "auto" as const,
    sourceDir: "src/zenrpc"
  };

  while (args.length > 0) {
    const token = args.shift();

    if (!token) {
      continue;
    }

    if (token === "--force") {
      options.force = true;
      continue;
    }

    if (token === "--no-install") {
      options.install = false;
      continue;
    }

    if (token === "--router") {
      const value = args.shift();

      if (!value || !["app", "auto", "both", "pages"].includes(value)) {
        throw new Error("`--router` expects one of: app, pages, both, auto.");
      }

      options.router = value as typeof options.router;
      continue;
    }

    if (token === "--dir") {
      const value = args.shift();

      if (!value) {
        throw new Error("`--dir` expects a path.");
      }

      options.sourceDir = value;
      continue;
    }

    throw new Error(`Unknown option "${token}".`);
  }

  return {
    command: "init" as const,
    options
  };
}

async function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2));

    if (parsed.command === "help") {
      printHelp();
      return;
    }

    const result = runInit(resolve(process.cwd()), parsed.options);

    console.log(`Scaffolded ZenRPC using ${result.packageManager}.`);

    for (const file of result.files) {
      console.log(`  created ${file}`);
    }

    if (!parsed.options.install) {
      console.log("Skipped dependency installation.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
