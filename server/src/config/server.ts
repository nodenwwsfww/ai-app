import { ModelConfig, AVAILABLE_MODELS } from './models'

interface ServerConfig {
  port: number
  env: string
  cache: {
    maxSize: number
    ttl: number // in milliseconds
  }
  rateLimiting: {
    maxRequests: number
    windowMs: number // in milliseconds
  }
  model: {
    defaultId: string
    maxOutputTokens: number
    temperature: number
    frequencyPenalty: number
    presencePenalty: number
  }
}

export const config: ServerConfig = {
  port: Number(process.env.PORT) || 8080,
  env: process.env.NODE_ENV || 'development',
  cache: {
    maxSize: 1000,
    ttl: 1000 * 60 * 60 // 1 hour
  },
  rateLimiting: {
    maxRequests: 30,
    windowMs: 60000 // 1 minute
  },
  model: {
    defaultId: 'google/gemini-2.5-pro-exp-03-25:free',
    maxOutputTokens: 50,
    temperature: 0.2,
    frequencyPenalty: 0.05,
    presencePenalty: 0.0
  }
}

export function getModelConfig(modelId?: string): ModelConfig {
  return AVAILABLE_MODELS.find((m: ModelConfig) => m.id === modelId) || AVAILABLE_MODELS[0]
} 