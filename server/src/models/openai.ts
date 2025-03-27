import OpenAI from "openai";
import { config } from "../config";

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

export async function getOpenAIChatCompletion(text: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an AI writing assistant. Complete the user's text with a short, relevant continuation (max 20 words). Do not repeat their input."
      },
      {
        role: "user",
        content: text
      }
    ],
    temperature: 0.7,
    max_tokens: 50,
    presence_penalty: 0.6,
    frequency_penalty: 0.5
  });

  return completion.choices[0].message.content || '';
}
