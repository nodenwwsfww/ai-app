import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define proper types for OpenAI messages
type ContentItem = {
  type: string;
  text?: string;
  image_url?: {
    url: string;
  };
};

export async function getOpenAIChatCompletion(
  existingText: string,
  url: string,
  screenshot?: string
) {
  console.log("Preparing OpenAI request with model: gpt-4o");
  
  const systemMessage = {
    role: "system" as const,
    content: `You are an chrome extension assistant designed to autocomplete the next part of a users sentance using the existing text on any webpage. The current webpage the user is on ${url} - please use this as context for the autocompleted text. Only respond with the autocompleted text. Keep your response extremely short. Do not include the prompt. And no more than 10 words`,
  };

  let userMessage: any;
  
  // If screenshot is provided and valid, create multimodal message
  if (screenshot) {
    try {
      // Validate the screenshot data
      if (!screenshot.startsWith('data:image')) {
        console.warn("Warning: Screenshot is not a valid data URL format");
        console.log(`Screenshot starts with: ${screenshot.substring(0, 30)}...`);
        userMessage = { 
          role: "user" as const, 
          content: existingText 
        };
      } else {
        console.log("Creating multimodal message with screenshot");
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
              text: existingText
            }
          ]
        };
      }
    } catch (error) {
      console.error("Error processing screenshot:", error);
      userMessage = { 
        role: "user" as const, 
        content: existingText 
      };
    }
  } else {
    console.log("Creating text-only message (no screenshot)");
    userMessage = { 
      role: "user" as const, 
      content: existingText 
    };
  }

  try {
    console.log("Sending request to OpenAI...");
    const result = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, userMessage],
    });
    console.log("OpenAI request successful");
    return result;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}
