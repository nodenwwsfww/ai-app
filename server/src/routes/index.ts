import { Hono } from "hono";
import { getOpenAIChatCompletion } from "../models/openai";

type AutocompleteRequest = {
  text: string;
  url: string;
  screenshot?: string;
};

const app = new Hono();

app.post("/complete", async (c) => {
    try {
      console.log("[POST] /complete");
      const body = await c.req.json<AutocompleteRequest>();
      
      // Log request details without the full screenshot
      console.log(`Request from URL: ${body.url}`);
      console.log(`Text context: ${body.text}`);
      
      // Log receipt of screenshot
      if (body.screenshot) {
        console.log(`✅ Screenshot received! Length: ${body.screenshot.length} chars`);
        console.log(`Screenshot preview: ${body.screenshot.substring(0, 100)}...`);
      } else {
        console.log("❌ No screenshot received with request");
      }
      
      // Pass to OpenAI
      const completion = await getOpenAIChatCompletion(body.text, body.url, body.screenshot);
      
      console.log(`Response: "${completion.choices[0].message.content}"`);
      return c.json({ text: completion.choices[0].message.content });
    } catch (error) {
      console.error("Error processing request:", error);
      return c.json(
        { error: "An error occurred while processing the request." },
        500
      );
    }
  });
  
export default app;