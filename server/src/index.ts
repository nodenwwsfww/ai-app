import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getOpenAIChatCompletion } from "./models/openai";

type AutocompleteRequest = {
  text: string;
  url: string;
};

const app = new Hono();
const port = Number(process.env.PORT) || 3000;

// Middlewares
app.use("*", logger());
app.use("*", cors());

// Routes
app.get("/", (c) => {
  return c.json({ message: "CORS enabled!" });
});

app.post("/", async (c) => {
  try {
    const { text, url } = await c.req.json<AutocompleteRequest>();
    const completion = await getOpenAIChatCompletion(text, url);
    return c.json({ text: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    return c.json(
      { error: "An error occurred while processing the request." },
      500
    );
  }
});

// Start server
console.log(`Server is running on port ${port}!`);
export default {
  port,
  fetch: app.fetch,
};
