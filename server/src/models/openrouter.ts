import OpenAI from "openai";

export async function getOpenRouterChatCompletion(
  openaiClient: OpenAI,
  modelName: string,
  existingText: string,
  url: string,
  screenshot?: string,
  userCountry?: string,
  userCity?: string,
) {
  console.log("Preparing OpenRouter request with model: ", modelName);

  const userLocation =
    [userCity, userCountry].filter(Boolean).join(", ") || "Not specified";
  console.log(`Using user location: ${userLocation}`);

  const systemMessage = {
    role: "system" as const,
    content: `
    You are an AI assistant highly focused on providing direct and relevant text continuations.
    Your primary goal is to predict the most likely word(s) that would *logically* and *directly* follow the user's \`Existing Text\`, considering the \`URL\` and potentially the \`screenshot\` for *local context* around the input field only.
    Use the user's provided location (\`User Location: ${userLocation}\`) to make suggestions more relevant. For example, prioritize services, places, or context specific to this location if the user's input is ambiguous or relates to geography.
    Analyze the \`Existing Text\`: "${existingText}". Consider its content, style, and language register (e.g., formal/informal, technical/casual).
    Analyze the context: URL \`${url}\` and the provided screenshot (if any).
    Respond ONLY with the suggested continuation text. Your continuation should seamlessly match the language style and vocabulary of the existing text.
    - Your response MUST logically follow the \`Existing Text\`. Do NOT suggest unrelated topics or new search queries.
    - Keep the continuation concise, generally 1-5 words.
    - Strongly prefer multi-word continuations (2-5 words) if a plausible and logical one exists.
    - Generally avoid single-character completions, but allow them if they are clearly the most logical way to complete a word or abbreviation.
    - If the continuation starts a new word (e.g., after a space), include a single leading space in your response.
    - If the continuation completes the current word (e.g., adding characters), do NOT include a leading space.
    - Do NOT repeat the \`Existing Text\` in your response.
    - Do NOT use quotes.
    - **Fallback:** If, after considering all context and rules, no highly logical, direct continuation is found, provide your best guess for a common, single-word continuation that fits the immediate context, still attempting to match the style.`,
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
    // Log the full prompt being sent
    console.log("--- Sending Prompt to AI ---");
    console.log("System Message:", JSON.stringify(systemMessage, null, 2));
    console.log("-----------------------------");

    console.log("Sending request to OpenRouter...");
    const result = await openaiClient.chat.completions.create({
      model: modelName,
      messages: [systemMessage, userMessage],
    });
    console.log("OpenRouter full response:", JSON.stringify(result, null, 2)); // Log full response
    console.log("OpenRouter request successful");
    console.log(`Response: "${result.choices[0].message.content}"`); 
    return result;
  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    throw error;
  }
}
