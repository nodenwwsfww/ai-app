import OpenAI from "openai";
import type { MessageBuilderParams } from "./types";
import { fillPromptTemplate } from "./model-config";

/**
 * Builds a system message based on model template
 * @param params - Parameters for message building
 * @returns OpenAI system message object
 */
export function buildSystemMessage(
  params: MessageBuilderParams
): OpenAI.Chat.ChatCompletionSystemMessageParam {
  const { modelConfig, existingText, url, previousTabUrl } = params;

  const userLocation =
    [params.userCity, params.userCountry].filter(Boolean).join(", ") ||
    "Not specified";

  const systemTemplate = modelConfig.systemPromptTemplate || "";
  const systemContent = fillPromptTemplate(systemTemplate, {
    userLocation,
    existingText,
    url,
    previousTabUrl,
  });

  return {
    role: "system" as const,
    content: systemContent,
  };
}

/**
 * Builds a user message based on model template and available screenshots
 * @param params - Parameters for message building
 * @returns OpenAI user message object
 */
export function buildUserMessage(
  params: MessageBuilderParams
): OpenAI.Chat.ChatCompletionUserMessageParam {
  const {
    modelConfig,
    existingText,
    url,
    screenshot,
    previousScreenshot,
    previousTabUrl,
  } = params;
  const userLocation =
    [params.userCity, params.userCountry].filter(Boolean).join(", ") ||
    "Not specified";

  // Basic data for all template types
  const templateData = {
    userLocation,
    existingText,
    url,
    previousTabUrl,
  };

  // Ensure userPromptTemplate exists (should always exist with proper setup)
  const templates = modelConfig.userPromptTemplate;
  if (!templates) {
    throw new Error("User prompt template is not defined");
  }

  // Determine message type and build appropriate content
  const isMultimodal = modelConfig.capabilities.multimodal;
  const hasCurrentScreenshot =
    screenshot && screenshot.startsWith("data:image");
  const hasPreviousScreenshot =
    previousScreenshot && previousScreenshot.startsWith("data:image");

  // Case 1: Text-only message (no screenshots or model doesn't support multimodal)
  if (!isMultimodal || !hasCurrentScreenshot) {
    return {
      role: "user" as const,
      content: fillPromptTemplate(templates.textOnly, templateData),
    };
  }

  // Case 2: Message with both screenshots
  if (hasCurrentScreenshot && hasPreviousScreenshot) {
    const promptText = fillPromptTemplate(
      templates.withBothScreenshots,
      templateData
    );

    return {
      role: "user" as const,
      content: [
        { type: "image_url", image_url: { url: screenshot } },
        { type: "image_url", image_url: { url: previousScreenshot } },
        { type: "text", text: promptText },
      ],
    };
  }

  // Case 3: Message with only current screenshot
  const promptText = fillPromptTemplate(templates.withScreenshot, templateData);

  return {
    role: "user" as const,
    content: [
      { type: "image_url", image_url: { url: screenshot } },
      { type: "text", text: promptText },
    ],
  };
}

/**
 * Builds complete message array for API request
 * @param params - Parameters for message building
 * @returns Array of OpenAI chat messages
 */
export function buildMessages(
  params: MessageBuilderParams
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const systemMessage = buildSystemMessage(params);
  const userMessage = buildUserMessage(params);

  return [systemMessage, userMessage];
}
