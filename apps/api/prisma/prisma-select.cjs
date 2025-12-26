const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node prisma-select.cjs <prisma args>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const databaseUrl = process.env.DATABASE_URL || "";
const schemaFile = databaseUrl.startsWith("file:")
  ? "prisma/schema.sqlite.prisma"
  : "prisma/schema.pg.prisma";

if (databaseUrl.startsWith("file:")) {
  const rawPath = databaseUrl.replace(/^file:/, "");
  const dbPath = rawPath.startsWith(".")
    ? path.resolve(__dirname, rawPath)
    : path.resolve(rawPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.closeSync(fs.openSync(dbPath, "a"));
}

const repoRoot = path.resolve(__dirname, "..", "..", "..");

function runPrisma(prismaCommandArgs) {
  const prismaArgs = ["-C", "apps/api", "exec", "--", "prisma", ...prismaCommandArgs];
  if (!prismaArgs.includes("--schema")) {
    prismaArgs.push("--schema", schemaFile);
  }
  return new Promise((resolve) => {
    const child = spawn("pnpm", prismaArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      shell: true,
    });
    child.on("exit", (code) => {
      resolve(code === null ? 1 : code);
    });
  });
}

async function run() {
  if (args[0] === "deploy") {
    if (databaseUrl.startsWith("file:")) {
      const generateCode = await runPrisma(["generate"]);
      process.exit(generateCode);
    }
    const migrateCode = await runPrisma(["migrate", "deploy"]);
    if (migrateCode !== 0) {
      process.exit(migrateCode);
    }
    const generateCode = await runPrisma(["generate"]);
    process.exit(generateCode);
  }

  const code = await runPrisma(args);
  process.exit(code);
}

run().catch(() => {
  process.exit(1);
});
