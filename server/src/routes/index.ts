import { Hono } from "hono";
import { z } from "zod";
import { getOpenRouterChatCompletion } from "../models/openrouter";
import { AutocompleteRequestSchema } from "../schemas";

const app = new Hono();

app.post("/complete", async (c) => {
  try {
    console.log("[POST] /complete");
    const rawBody = await c.req.json(); // Get raw body first

    // Validate the request body using Zod
    const parseResult = AutocompleteRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("Invalid request body:", parseResult.error.flatten());
      return c.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        400,
      );
    }

    const body = parseResult.data; // Use validated and typed data

    // Log request details without the full screenshot
    console.log(`Request from URL: ${body.url}`);
    console.log(`Text context: ${body.text}`);
    // Log personalization data
    console.log(`User Country: ${body.userCountry || "Not provided"}`);
    console.log(`User City: ${body.userCity || "Not provided"}`);

    // Log receipt of screenshot
    if (body.screenshot) {
      console.log(
        `✅ Screenshot received! Length: ${body.screenshot.length} chars`,
      );
      console.log(
        `Screenshot preview: ${body.screenshot.substring(0, 100)}...`,
      );
    } else {
      console.log("❌ No screenshot received with request");
    }

    // Pass validated data to OpenRouter
    const completion = await getOpenRouterChatCompletion(
      body.text,
      body.url,
      body.screenshot,
      body.userCountry,
      body.userCity,
    );

    console.log(`Response: "${completion.choices[0].message.content}"`);
    return c.json({ text: completion.choices[0].message.content });
  } catch (error) {
    console.error("Error processing request:", error);
    // Log the raw body in case of unexpected errors during processing
    if (!(error instanceof z.ZodError)) {
      // Don't log if it was a validation error we already logged
      try {
        const rawBodyForError = await c.req.json();
        console.error(
          "Raw request body on error:",
          JSON.stringify(rawBodyForError, null, 2),
        );
      } catch (parseError) {
        console.error("Could not parse request body on error.");
      }
    }
    return c.json(
      { error: "An error occurred while processing the request." },
      500,
    );
  }
});

export default app;
