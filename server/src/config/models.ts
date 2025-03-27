export interface ModelConfig {
  id: string
  name: string
  provider: string
  contextWindow: number
  costPer1kTokens: number
  maxOutputTokens: number
  temperature: number
  frequencyPenalty: number
  presencePenalty: number
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "anthropic/claude-3-opus",
    name: "Claude 3 Opus",
    provider: "Anthropic",
    contextWindow: 200000,
    costPer1kTokens: 0.015,
    maxOutputTokens: 50,
    temperature: 0.7,
    frequencyPenalty: 0.5,
    presencePenalty: 0.6
  },
  {
    id: "anthropic/claude-3-sonnet",
    name: "Claude 3 Sonnet",
    provider: "Anthropic",
    contextWindow: 200000,
    costPer1kTokens: 0.003,
    maxOutputTokens: 50,
    temperature: 0.7,
    frequencyPenalty: 0.5,
    presencePenalty: 0.6
  },
  {
    id: "google/gemini-pro",
    name: "Gemini Pro",
    provider: "Google",
    contextWindow: 32000,
    costPer1kTokens: 0.001,
    maxOutputTokens: 50,
    temperature: 0.7,
    frequencyPenalty: 0.5,
    presencePenalty: 0.6
  },
  {
    id: "meta-llama/llama-2-70b-chat",
    name: "Llama 2 70B",
    provider: "Meta",
    contextWindow: 4096,
    costPer1kTokens: 0.0007,
    maxOutputTokens: 50,
    temperature: 0.7,
    frequencyPenalty: 0.5,
    presencePenalty: 0.6
  },
  {
    id: "openai/gpt-4-turbo-preview",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    contextWindow: 128000,
    costPer1kTokens: 0.01,
    maxOutputTokens: 50,
    temperature: 0.7,
    frequencyPenalty: 0.5,
    presencePenalty: 0.6
  }
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0] // Claude 3 Opus by default

export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(model => model.id === modelId)
}

export function validateModelId(modelId: string): boolean {
  return AVAILABLE_MODELS.some(model => model.id === modelId)
} 