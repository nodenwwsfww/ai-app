import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getOpenAIChatCompletion(
  existingText: string,
  url: string
) {
  return await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an chrome extension assistant designed to autocomplete the next part of a users sentance using the existing text on any webpage. The current webpage the user is on ${url} - please use this as context for the autocompleted text. Only respond with the autocompleted text. Keep your response extremely short. Do not include the prompt.`,
      },
      { role: "user", content: existingText },
    ],
  });
}
