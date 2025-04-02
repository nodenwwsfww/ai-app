// Define types for input elements that we'll support
export type SupportedElement = HTMLInputElement | HTMLTextAreaElement | Element;

// Updated request type to include screenshot
export interface CompleteRequest {
  text: string;
  url: string;
  screenshot?: string;
}