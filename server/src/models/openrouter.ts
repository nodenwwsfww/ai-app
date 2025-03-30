import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1",
});

const model = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";

export async function getOpenRouterChatCompletion(
  existingText: string,
  url: string,
  screenshot?: string
) {
  console.log("Preparing OpenRouter request with model: ", model);
  
  const systemMessage = {
    role: "system",
    content: `
    You are an AI assistant integrated into a Chrome extension. Your task is to provide a concise and relevant completion for the user's current text input.
    Analyze the user's existing text and the context of the current webpage URL: ${url}.
    If an image of the webpage is also provided, use the visual context, especially elements near the input area, to enhance your prediction.
    Your goal is to predict the most likely *continuation* of the user's text.
    Respond ONLY with the suggested completion text. Do NOT repeat the user's original text.
    DO NOT wrap your response in quotes.
    Keep the completion brief, ideally a few words or a short phrase (around 10 words max).`,
  };

  let userMessage: any;
  
  // If screenshot is provided and valid, create multimodal message without getting description
  if (screenshot && screenshot.startsWith('data:image')) {
    console.log("Creating multimodal message with screenshot (no description)");
    userMessage = {
      role: "user" as const,
      content: [
        {
          type: "image_url",
          image_url: {
            url: screenshot
          }
        },
        {
          type: "text",
          text: `Given the webpage context and the following text, suggest a completion:\n\nExisting Text: "${existingText}"`
        }
      ]
    };
  } else {
    // Use text-only message in all other cases
    console.log("Creating text-only message");
    if (screenshot && !screenshot.startsWith('data:image')) {
      console.warn("Warning: Screenshot is not a valid data URL format");
      console.log(`Screenshot starts with: ${screenshot.substring(0, 30)}...`);
    }
    
    userMessage = {
      role: "user" as const,
      content: `Given the webpage context, suggest a completion for the following text:\n\n"${existingText}"`
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
