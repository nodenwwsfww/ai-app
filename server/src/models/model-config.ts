import type { ModelConfig, PromptTemplateData } from "./types";

// ===========================================
// Prompt Templates
// ===========================================
// These can be easily edited without affecting other functionality

const PROMPTS = {
  // System prompts
  system: {
    default: `
You are an AI assistant highly focused on providing direct and relevant text continuations.
Your primary goal is to predict the most likely word(s) that would *logically* and *directly* follow the user's \`Existing Text\`, considering the \`URL\`, the screenshot for *local context* around the input field, and potentially a previous tab's context.
Use the user's provided location (\`User Location: {{USER_LOCATION}}\`) to make suggestions more relevant. For example, prioritize services, places, or context specific to this location if the user's input is ambiguous or relates to geography.

Analyze the \`Existing Text\`: "{{EXISTING_TEXT}}". Consider its content, style, and language register (e.g., formal/informal, technical/casual).

Analyze the primary context: URL \`{{URL}}\` and the provided screenshot (if any).
{{PREVIOUS_TAB_CONTEXT}}

Respond ONLY with the suggested continuation text. Your continuation should seamlessly match the language style and vocabulary of the existing text.
- Your response MUST logically follow the \`Existing Text\`. Do NOT suggest unrelated topics or new search queries.
- Keep the continuation concise, generally 1-5 words.
- Strongly prefer multi-word continuations (2-5 words) if a plausible and logical one exists.
- Generally avoid single-character completions, but allow them if they are clearly the most logical way to complete a word or abbreviation.
- Check if the existing text already ends with a space. If it does, do NOT add another space before your continuation.
- Only add a leading space when continuing after a non-space character AND starting a new word.
- Do NOT repeat the \`Existing Text\` in your response.
- Do NOT use quotes.

Examples of correct spacing:
- "Работа в " + "вильнюсе" → "вильнюсе" (Don't add space; existing text already ends with one)
- "Работа" + "в Вильнюсе" → " в Вильнюсе" (Add space; starting new word after non-space)
- "Вильн" + "юсе" → "юсе" (No space; completing current word)

- **Fallback:** If, after considering all context and rules, no highly logical, direct continuation is found, provide your best guess for a common, single-word continuation that fits the immediate context, still attempting to match the style.
`,
  },

  // User prompts
  user: {
    textOnly: `Based on the webpage URL context ({{URL}}), {{PREVIOUS_TAB_REFERENCE}} and the user's location ({{USER_LOCATION}}), predict the text that should directly follow this existing input:\n\nExisting Text: "{{EXISTING_TEXT}}"`,

    withScreenshot: `Based on the immediate visual context near the input field in the screenshot, the webpage URL ({{URL}}), {{PREVIOUS_TAB_REFERENCE}} and the user's location ({{USER_LOCATION}}), predict the text that should directly follow this existing input:\n\nExisting Text: "{{EXISTING_TEXT}}"`,

    withBothScreenshots: `Based on the immediate visual context near the input field in the screenshots (current and previous), the webpage URL ({{URL}}), {{PREVIOUS_TAB_REFERENCE}} and the user's location ({{USER_LOCATION}}), predict the text that should directly follow this existing input:\n\nExisting Text: "{{EXISTING_TEXT}}"`,
  },
};

// ===========================================
// Model Configurations
// ===========================================

// Available models (using model ID as the key)
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  "google/gemini-2.0-flash-exp:free": {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Google Gemini Flash",
    provider: "Google",
    temperature: 0.2,
    maxTokens: 200,
    systemPromptTemplate: PROMPTS.system.default,
    capabilities: {
      multimodal: true,
    },
    userPromptTemplate: {
      textOnly: PROMPTS.user.textOnly,
      withScreenshot: PROMPTS.user.withScreenshot,
      withBothScreenshots: PROMPTS.user.withBothScreenshots,
    },
  },
};

/**
 * Get model configuration by ID
 * @param modelId - Model ID string
 * @returns ModelConfig object
 */
export function getModelConfig(modelId: string): ModelConfig {
  // Check if model exists with the provided ID
  if (modelId in AVAILABLE_MODELS) {
    return AVAILABLE_MODELS[modelId];
  }

  // If model not found, return Gemini Flash as default
  console.warn(`Model "${modelId}" not found, using default Gemini Flash`);
  return AVAILABLE_MODELS["google/gemini-2.0-flash-exp:free"];
}

/**
 * Get list of available models
 * @returns Record with model IDs and display names
 */
export function getAvailableModels(): Record<string, string> {
  const models: Record<string, string> = {};

  Object.entries(AVAILABLE_MODELS).forEach(([id, config]) => {
    models[id] = config.name;
  });

  return models;
}

/**
 * Fill template with data values
 * @param template - Template string with placeholders
 * @param data - Data to populate the template
 * @returns Filled template string
 */
export function fillPromptTemplate(
  template: string,
  data: PromptTemplateData
): string {
  let filled = template
    .replace(/{{USER_LOCATION}}/g, data.userLocation)
    .replace(/{{EXISTING_TEXT}}/g, data.existingText)
    .replace(/{{URL}}/g, data.url);

  // Add previous tab context if available
  if (data.previousTabUrl) {
    filled = filled.replace(
      /{{PREVIOUS_TAB_CONTEXT}}/g,
      `Also consider the previous tab the user was on: \`${data.previousTabUrl}\`. If there appears to be a logical connection between the current task and previous activity, use this as additional context.`
    );

    filled = filled.replace(
      /{{PREVIOUS_TAB_REFERENCE}}/g,
      `the previous tab the user was on (${data.previousTabUrl}),`
    );
  } else {
    filled = filled.replace(/{{PREVIOUS_TAB_CONTEXT}}/g, "");
    filled = filled.replace(/{{PREVIOUS_TAB_REFERENCE}}/g, "");
  }

  return filled;
}
