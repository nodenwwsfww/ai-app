// Model configuration interface
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  temperature?: number;
  systemPromptTemplate?: string;
  userPromptTemplate?: {
    textOnly: string;
    withScreenshot: string;
    withBothScreenshots: string;
  };
  capabilities: {
    multimodal: boolean;
  };
}

// Message role types
export type MessageRole = "system" | "user" | "assistant";

// Message builder parameters interface
export interface MessageBuilderParams {
  modelConfig: ModelConfig;
  existingText: string;
  url: string;
  screenshot?: string;
  previousScreenshot?: string;
  previousTabUrl?: string;
  userCountry?: string;
  userCity?: string;
}

// Template data interface
export interface PromptTemplateData {
  userLocation: string;
  existingText: string;
  url: string;
  previousTabUrl?: string;
}
