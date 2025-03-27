import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { timing } from 'hono/timing'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { LRUCache } from 'lru-cache'
import stringify from 'fast-json-stable-stringify'

const app = new Hono()

// Initialize cache
const cache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
  updateAgeOnGet: true,
  allowStale: true
})

// Request validation schema
const RequestSchema = z.object({
  text: z.string().max(200),
  url: z.string().url(),
  context: z.object({
    platform: z.string().optional(),
    element: z.string().optional(),
    type: z.string().optional(),
    language: z.string().optional(),
    previousContent: z.string().optional(),
    pageContent: z.string().optional()
  }).optional()
})

// Middleware
app.use('*', cors())
app.use('*', logger())
app.use('*', timing())

// Simple rate limiting
const rateLimit = new Map<string, number>()
setInterval(() => rateLimit.clear(), 60000) // Clear every minute

app.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown'
  const count = (rateLimit.get(ip) || 0) + 1
  if (count > 30) { // 30 requests per minute
    return c.json({ error: 'Too many requests' }, 429)
  }
  rateLimit.set(ip, count)
  return next()
})

// Request handler with validation
app.post('/', zValidator('json', RequestSchema), async (c) => {
  const body = c.req.valid('json')
  const requestId = crypto.randomUUID()
  
  try {
    // Generate cache key
    const cacheKey = stringify({
      text: body.text.toLowerCase(),
      url: body.url,
      context: body.context
    })
    
    // Check cache
    const cached = cache.get(cacheKey)
    if (cached) {
      c.header('X-Cache', 'HIT')
      c.header('X-Request-ID', requestId)
      return c.json({ text: cached, cached: true })
    }
    
    // Get completion from OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': body.url, // OpenRouter requires this
        'X-Title': 'AI T9 Autocomplete' // Name of your application
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-opus', // Using Claude 3 Opus for best quality
        messages: [
          {
            role: 'system',
            content: 'Complete the text naturally, matching the context and style. Only return the continuation.'
          },
          {
            role: 'user',
            content: body.text
          }
        ],
        temperature: 0.7,
        max_tokens: 50,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
        stop: ["\n", ".", "!", "?"]
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error! status: ${response.status}`)
    }

    const data = await response.json()
    const suggestion = data.choices[0].message.content?.trim() || ''
    
    // Cache result
    if (suggestion) {
      cache.set(cacheKey, suggestion)
    }
    
    c.header('X-Cache', 'MISS')
    c.header('X-Request-ID', requestId)
    return c.json({ text: suggestion, cached: false })
    
  } catch (error) {
    console.error(`[${requestId}] Error:`, error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Health check
app.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    cache: {
      size: cache.size,
      items: cache.size
    }
  })
})

export default app
