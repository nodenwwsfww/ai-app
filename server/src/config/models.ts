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
    id: "google/gemini-2.5-pro-exp-03-25:free",
    name: "Gemini Pro 2.5 Experimental",
    provider: "Google",
    contextWindow: 32000,
    costPer1kTokens: 0.001,
    maxOutputTokens: 50,
    temperature: 0.2,
    frequencyPenalty: 0.05,
    presencePenalty: 0.0
  }
]

export const DEFAULT_MODEL = AVAILABLE_MODELS[0]

export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(model => model.id === modelId)
}

export function validateModelId(modelId: string): boolean {
  return AVAILABLE_MODELS.some(model => model.id === modelId)
} 