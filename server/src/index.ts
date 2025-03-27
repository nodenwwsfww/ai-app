import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { LRUCache } from 'lru-cache'

const app = new Hono()

// Basic middleware
app.use('*', cors())
app.use('*', logger())

// Cache setup
const cache = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
})

// Rate limiting
const rateLimit = new Map<string, { count: number, timestamp: number }>()
const RATE_LIMIT = { max: 30, window: 60000 } // 30 requests per minute

// Request validation
const RequestSchema = z.object({
  text: z.string().max(200),
  url: z.string().url()
})

// Rate limiting middleware
app.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || 
             c.req.header('x-real-ip') || 
             c.req.header('cf-connecting-ip') ||
             'unknown'
             
  const cleanIp = ip.split(',')[0].trim() // Get first IP if multiple are provided

  const now = Date.now()
  const record = rateLimit.get(cleanIp)

  if (record) {
    if (now - record.timestamp > RATE_LIMIT.window) {
      record.count = 1
      record.timestamp = now
    } else if (record.count >= RATE_LIMIT.max) {
      console.warn(`[Rate limit] IP: ${cleanIp} (${record.count} requests in ${RATE_LIMIT.window}ms)`)
      return c.json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((record.timestamp + RATE_LIMIT.window - now) / 1000)
      }, 429)
    } else {
      record.count++
    }
  } else {
    rateLimit.set(cleanIp, { count: 1, timestamp: now })
  }

  // Add rate limit headers
  c.header('X-RateLimit-Limit', RATE_LIMIT.max.toString())
  c.header('X-RateLimit-Remaining', record ? (RATE_LIMIT.max - record.count).toString() : RATE_LIMIT.max.toString())
  c.header('X-RateLimit-Reset', record ? Math.ceil((record.timestamp + RATE_LIMIT.window) / 1000).toString() : '0')

  return next()
})

// Helper to clean AI response
function cleanAIResponse(text: string): string | null {
  // Remove any explanatory text or apologies
  if (text.toLowerCase().includes('apologize') || 
      text.toLowerCase().includes('sorry') ||
      text.toLowerCase().includes('haven\'t provided') ||
      text.toLowerCase().includes('cannot') ||
      text.toLowerCase().includes('unable to')) {
    return null
  }

  // Remove any AI self-references
  if (text.toLowerCase().includes('ai') ||
      text.toLowerCase().includes('assistant') ||
      text.toLowerCase().includes('model')) {
    return null
  }

  return text.trim()
}

// Main completion endpoint
app.post('/', zValidator('json', RequestSchema), async (c) => {
  const { text, url } = c.req.valid('json')
  
  try {
    // Check cache
    const cacheKey = `${text}:${url}`
    const cached = cache.get(cacheKey)
    
    if (cached) {
      console.debug(`[Cache] HIT: "${text}" → "${cached}"`)
      return c.json({ text: cached })
    }

    // Get completion from OpenRouter
    const systemPrompt = 'Complete the text naturally, matching the context and style. Only return the continuation. Never explain or apologize.'
    console.debug(`[API] Request: "${text}" | Context: ${url} | System: ${systemPrompt}`)
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': url,
        'X-Title': 'AI T9 Autocomplete'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-opus',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 50,
        stop: ["\n", ".", "!", "?"]
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const rawSuggestion = data.choices[0].message.content?.trim() || ''
    const suggestion = cleanAIResponse(rawSuggestion)

    if (suggestion) {
      cache.set(cacheKey, suggestion)
      console.debug(`[API] Response: "${text}" → "${suggestion}" (raw: "${rawSuggestion}")`)
      return c.json({ text: suggestion })
    } else {
      console.debug(`[API] Invalid response filtered out: "${rawSuggestion}"`)
      return c.json({ text: '' })
    }

  } catch (error) {
    console.error('[Error]', error instanceof Error ? error.message : 'Unknown error')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    cache: { size: cache.size }
  })
})

export default app
