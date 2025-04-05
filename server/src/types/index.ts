export type AutocompleteRequest = {
  text: string;
  url: string;
  screenshot?: string;
  previousScreenshot?: string;
  previousTabUrl?: string;
  userCountry?: string;
  userCity?: string;
};

// Define a type for OpenAI response structure
export interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}
