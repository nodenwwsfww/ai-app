import { Hono } from "hono";
import { z } from "zod";
import OpenAI from "openai";
import { getOpenRouterChatCompletion } from "../models/openrouter";
import { AutocompleteRequestSchema } from "../schemas";
import { getAvailableModels, getModelConfig } from "../models/model-config";

// Create OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1",
});

// Get model ID from environment variables or use default
const getDefaultModelId = (): string => {
  return process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";
};

/**
 * Extract text content from OpenAI API response
 * @param result - OpenAI API response
 * @returns Text content from the response or empty string if not available
 */
function extractResponseContent(result: any): string {
  try {
    if (
      result &&
      typeof result === "object" &&
      "choices" in result &&
      Array.isArray(result.choices) &&
      result.choices.length > 0 &&
      result.choices[0].message &&
      typeof result.choices[0].message.content === "string"
    ) {
      return result.choices[0].message.content;
    }
  } catch (e) {
    console.warn("Error extracting response content:", e);
  }

  return "";
}

const app = new Hono();

// Route for autocompletion
app.post("/complete", async (c) => {
  try {
    console.log("[POST] /complete");
    const rawBody = await c.req.json();

    // Validate request using Zod
    const parseResult = AutocompleteRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      console.error("Invalid request body:", parseResult.error.flatten());
      return c.json(
        { error: "Invalid request body", details: parseResult.error.flatten() },
        400
      );
    }

    const body = parseResult.data;

    // Log request details
    console.log(`Request from URL: ${body.url}`);
    console.log(`Text context: ${body.text}`);
    console.log(`User Country: ${body.userCountry || "Not provided"}`);
    console.log(`User City: ${body.userCity || "Not provided"}`);

    // Log screenshot information
    if (body.screenshot) {
      console.log(
        `✅ Current screenshot received! Length: ${body.screenshot.length} chars`
      );
    } else {
      console.log("❌ No current screenshot received with request");
    }

    if (body.previousScreenshot) {
      console.log(
        `✅ Previous screenshot received! Length: ${body.previousScreenshot.length} chars`
      );
    }

    if (body.previousTabUrl) {
      console.log(`Previous tab URL: ${body.previousTabUrl}`);
    }

    // Get model to use
    const modelId = getDefaultModelId();
    const modelConfig = getModelConfig(modelId);
    console.log(`Using model: ${modelConfig.name} (${modelConfig.id})`);

    // Send request to OpenRouter
    const completion = await getOpenRouterChatCompletion(
      openai,
      modelId,
      body.text,
      body.url,
      body.screenshot,
      body.previousScreenshot,
      body.previousTabUrl,
      body.userCountry,
      body.userCity
    );

    // Extract and log response content
    const responseContent = extractResponseContent(completion);
    console.log(`Response content: "${responseContent}"`);

    return c.json({ text: responseContent });
  } catch (error) {
    console.error("Error processing request:", error);
    return c.json(
      { error: "An error occurred while processing the request." },
      500
    );
  }
});

// Route for getting list of available models
app.get("/models", async (c) => {
  try {
    const models = getAvailableModels();
    const currentModel = getDefaultModelId();

    return c.json({
      models,
      current: currentModel,
    });
  } catch (error) {
    console.error("Error getting models:", error);
    return c.json({ error: "Failed to retrieve models" }, 500);
  }
});

// Ping route for health check
app.get("/ping", async (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

export default app;
