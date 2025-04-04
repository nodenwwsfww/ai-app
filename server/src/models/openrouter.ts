import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1",
});

const model =
  process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";

export async function getOpenRouterChatCompletion(
  existingText: string,
  url: string,
  screenshot?: string,
  userCountry?: string,
  userCity?: string,
) {
  console.log("Preparing OpenRouter request with model: ", model);

  const userLocation =
    [userCity, userCountry].filter(Boolean).join(", ") || "Not specified";
  console.log(`Using user location: ${userLocation}`);

  const systemMessage = {
    role: "system" as const,
    content: `
    You are an AI assistant focused *exclusively* on providing direct text continuations.
    Your goal is to predict the very next word(s) that would logically follow the user's \`Existing Text\`, considering the \`URL\` and potentially the \`screenshot\` for *local context* around the input field only.
    Use the user's provided location (\`User Location: ${userLocation}\`) to make suggestions more relevant. For example, prioritize services, places, or context specific to this location if the user's input is ambiguous or relates to geography.
    Analyze the \`Existing Text\`: "${existingText}".
    Analyze the context: URL \`${url}\` and the provided screenshot (if any).
    Respond ONLY with the most likely *direct continuation* text that would immediately follow the \`Existing Text\`.
    - If the continuation starts a new word (e.g., after a space), include a single leading space in your response.
    - If the continuation completes the current word (e.g., adding characters), do NOT include a leading space.
    - Your response MUST logically follow the \`Existing Text\`. Do NOT suggest unrelated topics or new search queries.
    - Do NOT repeat the \`Existing Text\` in your response.
    - Do NOT use quotes.
    - Keep the continuation very short (1-5 words).`,
  };

  let userMessage: OpenAI.Chat.ChatCompletionMessageParam;

  // If screenshot is provided and valid, create multimodal message without getting description
  if (screenshot && screenshot.startsWith("data:image")) {
    console.log("Creating multimodal message with screenshot (no description)");
    userMessage = {
      role: "user" as const,
      content: [
        {
          type: "image_url",
          image_url: {
            url: screenshot,
          },
        },
        {
          type: "text",
          text: `Based *only* on the immediate visual context near the input field in the screenshot, the webpage URL, and the user's location (${userLocation}), predict the text that should directly follow this existing input:\\n\\nExisting Text: "${existingText}"`,
        },
      ],
    };
  } else {
    // Use text-only message in all other cases
    console.log("Creating text-only message");
    if (screenshot && !screenshot.startsWith("data:image")) {
      console.warn("Warning: Screenshot is not a valid data URL format");
      console.log(`Screenshot starts with: ${screenshot.substring(0, 30)}...`);
    }

    userMessage = {
      role: "user" as const,
      content: `Based *only* on the webpage URL context and the user's location (${userLocation}), predict the text that should directly follow this existing input:\\n\\nExisting Text: "${existingText}"`,
    };
  }

  try {
    console.log("Sending request to OpenRouter...");
    const result = await openai.chat.completions.create({
      model: model,
      messages: [systemMessage, userMessage],
    });
    console.log("OpenRouter request successful");
    return result;
  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    throw error;
  }
}
