import OpenAI from "openai";
import { getModelConfig } from "./model-config";
import { buildMessages } from "./prompt-builder";
import type { MessageBuilderParams } from "./types";

/**
 * Creates request parameters for OpenRouter API call
 * @param modelConfig - Model configuration object
 * @param messages - Array of chat messages
 * @returns OpenAI request parameters
 */
function createRequestParams(
  modelConfig: ReturnType<typeof getModelConfig>,
  messages: ReturnType<typeof buildMessages>
): OpenAI.Chat.ChatCompletionCreateParams {
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    model: modelConfig.id,
    messages: messages,
  };

  // Add additional parameters from model configuration
  if (modelConfig.temperature !== undefined) {
    params.temperature = modelConfig.temperature;
  }

  if (modelConfig.maxTokens !== undefined) {
    params.max_tokens = modelConfig.maxTokens;
  }

  return params;
}

/**
 * Gets text autocompletion from OpenRouter API
 * @param openaiClient - OpenAI client
 * @param modelId - Model ID to use
 * @param existingText - Text to continue
 * @param url - URL of the page
 * @param screenshot - Optional screenshot of the current page
 * @param previousScreenshot - Optional screenshot of the previous page
 * @param previousTabUrl - Optional URL of the previous tab
 * @param userCountry - Optional user country
 * @param userCity - Optional user city
 * @returns Promise with API result
 */
export async function getOpenRouterChatCompletion(
  openaiClient: OpenAI,
  modelId: string,
  existingText: string,
  url: string,
  screenshot?: string,
  previousScreenshot?: string,
  previousTabUrl?: string,
  userCountry?: string,
  userCity?: string
) {
  // Get model configuration
  const modelConfig = getModelConfig(modelId);

  console.log(
    `Preparing OpenRouter request with model: ${modelConfig.name} (${modelConfig.id})`
  );

  // Collect user location data
  const userLocation =
    [userCity, userCountry].filter(Boolean).join(", ") || "Not specified";
  console.log(`Using user location: ${userLocation}`);

  // Log previous tab information
  if (previousTabUrl) {
    console.log(`Previous tab URL: ${previousTabUrl}`);
  }

  // Parameters for building messages
  const messageParams: MessageBuilderParams = {
    modelConfig,
    existingText,
    url,
    screenshot,
    previousScreenshot,
    previousTabUrl,
    userCountry,
    userCity,
  };

  // Build messages for API request
  const messages = buildMessages(messageParams);

  try {
    // Log the prompt being sent
    // console.log("--- Sending Prompt to AI ---");
    // console.log(`System Message: ${JSON.stringify(messages[0], null, 2)}`);
    // console.log("-----------------------------");

    // Create request parameters
    const requestParams = createRequestParams(modelConfig, messages);

    // Send the request
    console.log(
      `Sending request to OpenRouter using model ${modelConfig.id}...`
    );
    const result = await openaiClient.chat.completions.create(requestParams);

    // Log the result
    console.log("OpenRouter request successful");

    try {
      // Try to access response content safely
      if (
        result &&
        typeof result === "object" &&
        "choices" in result &&
        Array.isArray(result.choices) &&
        result.choices.length > 0 &&
        result.choices[0].message &&
        result.choices[0].message.content
      ) {
        console.log(`Response: "${result.choices[0].message.content}"`);
      } else {
        console.log("Response received but format is unexpected: ", result);
      }
    } catch (err) {
      console.log("Could not access response content details");
    }

    return result;
  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    throw error;
  }
}
