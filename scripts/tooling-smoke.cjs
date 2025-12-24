const { execSync } = require("child_process");

console.log(`node: ${process.version}`);

try {
  const pnpmVersion = execSync("pnpm -v", { encoding: "utf8" }).trim();
  console.log(`pnpm: ${pnpmVersion}`);
} catch (err) {
  console.log("pnpm: NOT FOUND");
}

console.log("prisma: SKIPPED (not installed yet)");
process.exit(0);
