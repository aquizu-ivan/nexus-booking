const app = require("./app");

const port = Number(process.env.API_PORT) || 4000;

const server = app.listen(port, () => {
  console.log(`nexus-booking-api listening on ${port}`);
});

module.exports = server;
