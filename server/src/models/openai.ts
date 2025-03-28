import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = "gpt-4o";

// Note: Keeping the getImageDescription function in case it's used elsewhere,
// but it won't be called in the updated implementation
async function getImageDescription(screenshot: string): Promise<string> {
  console.log("Requesting image description from OpenAI...");
  try {
    const response = await openai.chat.completions.create({
      model: model, // Use the same multimodal model
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this webpage screenshot concisely, focusing on the main content, text fields, or interactive elements visible. Aim for 1-2 sentences." },
            {
              type: "image_url",
              image_url: {
                url: screenshot,
              },
            },
          ],
        },
      ],
      max_tokens: 100, // Limit description length
    });
    const description = response.choices[0].message?.content?.trim() || "Could not generate description.";
    console.log("Image description received:", description);
    return description;
  } catch (error) {
    console.error("Error generating image description:", error);
    return "Error generating image description.";
  }
}

export async function getOpenAIChatCompletion(
  existingText: string,
  url: string,
  screenshot?: string
) {
  console.log("Preparing OpenAI request with model: ", model);
  
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
    console.log("Sending request to OpenAI...");
    const result = await openai.chat.completions.create({
      model: model,
      messages: [systemMessage, userMessage],
    });
    console.log("OpenAI request successful");
    return result;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}
