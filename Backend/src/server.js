import "dotenv/config";
import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`[SENIORCARE API] listening on port ${PORT} (${process.env.NODE_ENV || "development"})`);
  });

  const shutdown = (signal) => {
    console.log(`\n[SENIORCARE API] received ${signal}, shutting down gracefully...`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((err) => {
  console.error("[SENIORCARE API] failed to start:", err);
  process.exit(1);
});
