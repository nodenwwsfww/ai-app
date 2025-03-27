import dotenv from 'dotenv'
dotenv.config()

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required')
}

export const config = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PORT: process.env.PORT || 8080
} as const 