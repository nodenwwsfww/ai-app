// Define types for input elements that we'll support
export type SupportedElement = HTMLInputElement | HTMLTextAreaElement | Element

// Interface for tab screenshot data
export interface TabScreenshot {
  screenshot: string
  timestamp: number
  url: string
}

// Updated request type to include both screenshots
export interface CompleteRequest {
  text: string
  url: string
  screenshot?: string
  previousScreenshot?: string
  previousTabUrl?: string
  userCountry?: string
  userCity?: string
}
