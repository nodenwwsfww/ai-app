import { Hono } from "hono";
import routes from "./routes";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { MiddlewareHandler } from "hono";

const app = new Hono();
const port = Number(process.env.PORT) || 3000;

// Middleware
app.use("*", cors());

// // Enhanced logging middleware
// const enhancedLogger: MiddlewareHandler = async (c, next) => {
//   const path = c.req.path;
//   const method = c.req.method;
  
//   console.log(`[${method}] ${path}`);
  
//   // Try to log request body if it's JSON
//   try {
//     if (c.req.header("content-type")?.includes("application/json")) {
//       const reqClone = c.req.raw.clone();
//       const reqBody = await reqClone.json();
//       console.log("Request body:", JSON.stringify(reqBody, null, 2));
//     }
//   } catch (e) {
//     console.log("Request body: [Not JSON or empty]");
//   }
  
//   // Track timing
//   const startTime = Date.now();
  
//   // Process the request
//   await next();
  
//   // Log response time
//   const endTime = Date.now();
//   // console.log(`Response time: ${endTime - startTime}ms`);
  
//   // Log response body based on content type
//   try {
//     const contentType = c.res.headers.get("content-type");
//     const resClone = c.res.clone();
    
//     if (contentType?.includes("application/json")) {
//       const resBody = await resClone.json();
//       console.log("Response body:", JSON.stringify(resBody, null, 2));
//     } else {
//       // Handle text responses
//       const textBody = await resClone.text();
//       console.log("Response body:", textBody || "[Empty response]");
//     }
//   } catch (e) {
//     console.log("Response body: [Failed to read]");
//   }
// };

// app.use("*", enhancedLogger);

// Standard logger for basic request info
app.use("*", logger());

// Routes
app.route("/", routes);

// Start server
// console.log(`Server is running on port ${port}!`);
export default {
  port,
  fetch: app.fetch,
};
