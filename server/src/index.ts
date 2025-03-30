import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import routes from "./routes";

const app = new Hono();
const port = Number(process.env.PORT) || 3000;

// Middleware
app.use("*", cors());

// Standard logger for basic request info
app.use("*", logger());

// Routes
app.route("/", routes);

export default {
  port,
  fetch: app.fetch,
};
