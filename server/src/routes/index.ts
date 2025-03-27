import { Hono } from "hono";
import { getOpenAIChatCompletion } from "../models/openai";

type AutocompleteRequest = {
  text: string;
  url: string;
};

const app = new Hono();
  
app.post("/complete", async (c) => {
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
  
export default app;