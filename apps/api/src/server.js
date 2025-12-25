const app = require("./app");

const port = Number(process.env.PORT || process.env.API_PORT) || 4000;
const host = process.env.API_HOST || "0.0.0.0";

const runtimeEnv = process.env.NODE_ENV || (process.env.PORT ? "production" : "development");
const startedAt = app.locals.startedAt || new Date().toISOString();
const gitSha = app.locals.gitSha || "unknown";

const server = app.listen(port, host, () => {
  console.log(
    `BOOT startedAt=${startedAt} env=${runtimeEnv} host=${host} port=${port} gitSha=${gitSha}`
  );
});

module.exports = server;
