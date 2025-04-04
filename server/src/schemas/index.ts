import { z } from "zod";

export const AutocompleteRequestSchema = z.object({
  text: z.string().min(1), // Ensure text is not empty
  url: z.string().url(),
  screenshot: z.string().optional(),
  userCountry: z.string().optional(),
  userCity: z.string().optional(),
});

// Export other schemas here if needed
