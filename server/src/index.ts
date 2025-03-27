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

// Also cache errors to prevent hammering the API
const errorCache = new LRUCache<string, { error: string, retryAfter?: number }>({
  max: 100,
  ttl: 1000 * 60 // 1 minute
})

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<any>>()

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
function cleanAIResponse(text: string, input: string): string | null {
  const cleaned = text.trim()
  
  // Empty response
  if (!cleaned) {
    console.debug(`[Filter] Empty response`)
    return null
  }

  // Remove any explanatory text or apologies
  if (cleaned.toLowerCase().includes('apologize') || 
      cleaned.toLowerCase().includes('sorry') ||
      cleaned.toLowerCase().includes('haven\'t provided') ||
      cleaned.toLowerCase().includes('cannot') ||
      cleaned.toLowerCase().includes('unable to') ||
      cleaned.toLowerCase().includes('would you like') ||
      cleaned.toLowerCase().includes('here\'s') ||
      cleaned.toLowerCase().includes('suggestion')) {
    console.debug(`[Filter] Contains explanation/apology: "${cleaned}"`)
    return null
  }

  // Remove any AI self-references
  if (cleaned.toLowerCase().includes('ai') ||
      cleaned.toLowerCase().includes('assistant') ||
      cleaned.toLowerCase().includes('model') ||
      cleaned.toLowerCase().includes('help')) {
    console.debug(`[Filter] Contains AI self-reference: "${cleaned}"`)
    return null
  }

  // Remove any markdown or special formatting
  if (cleaned.includes('`') || 
      cleaned.includes('*') || 
      cleaned.includes('#') ||
      cleaned.includes('>')) {
    console.debug(`[Filter] Contains markdown: "${cleaned}"`)
    return null
  }

  // Handle partial words - if input ends with part of a word, completion should complete it
  const inputWords = input.trim().split(/\s+/)
  const lastInputWord = inputWords[inputWords.length - 1]
  
  if (lastInputWord && !lastInputWord.endsWith(',') && !lastInputWord.endsWith('.')) {
    // If we're in the middle of a word, make sure the completion starts with the rest of that word
    if (!cleaned.startsWith(' ') && !cleaned.startsWith(lastInputWord)) {
      const completion = cleaned.split(/\s+/)[0]
      if (!completion.startsWith(lastInputWord.slice(-1))) {
        console.debug(`[Filter] Invalid word completion: input="${lastInputWord}", completion="${cleaned}"`)
        return null
      }
    }
  }

  return cleaned
}

// Helper to normalize text for caching
function getNormalizedKey(text: string, url: string): string {
  return `${text.trim().toLowerCase()}:${url}`
}

// Main completion endpoint
app.post('/', zValidator('json', RequestSchema), async (c) => {
  const { text, url } = c.req.valid('json')
  
  try {
    // Check cache first with normalized key
    const cacheKey = getNormalizedKey(text, url)
    
    // Check success cache
    const cached = cache.get(cacheKey)
    if (cached !== undefined) {
      console.debug(`[Cache] HIT: "${text}" → "${cached}"`)
      return c.json({ text: cached })
    }

    // Check error cache
    const cachedError = errorCache.get(cacheKey)
    if (cachedError) {
      console.debug(`[Cache] Error HIT: "${text}" → ${cachedError.error}`)
      if (cachedError.retryAfter) {
        c.header('Retry-After', cachedError.retryAfter.toString())
      }
      return c.json({ error: cachedError.error }, 429)
    }

    // Check if there's an identical in-flight request
    const existingRequest = inFlightRequests.get(cacheKey)
    if (existingRequest) {
      console.debug(`[Request] Duplicate detected for: "${text}", using existing in-flight request`)
      const result = await existingRequest
      return c.json(result)
    }

    console.debug(`[Request] Text: "${text}", Last word: "${text.split(/\s+/).pop()}"`)

    // Create a promise for this request and track it
    const requestPromise = (async () => {
      try {
        // Get completion from OpenRouter
        const systemPrompt = `You are a real-time text autocomplete engine, like Gmail's Smart Compose. Your only job is to predict and complete the current text naturally.

IMPORTANT RULES:
- ONLY return the direct continuation of the text
- NEVER explain, apologize, or add commentary
- NEVER use markdown or formatting
- NEVER add punctuation unless it's part of a common ending
- If input ends with part of a word, complete that word first
- If input ends with punctuation or space, predict next word(s)
- Keep completions concise and relevant
- Match the style and context of the input
- If unsure, return empty string instead of guessing

Example good responses:
Input: "The quick brown" → Output: " fox jumps over"
Input: "Dear Mr." → Output: " Smith"
Input: "console.log" → Output: "('Hello, world!')"
Input: "Hi," → Output: " how are you"
Input: "He" → Output: "llo"
Input: "Hel" → Output: "lo"

Remember: You are an autocomplete engine, not a chat assistant. Just complete the text naturally.

USER INPUT: ${text}
ONLY RETURN THE COMPLETION, NO OTHER TEXT.`

        console.debug(`[API] Request: "${text}" | Context: ${url} | System: Gemini Pro 2.5 Experimental`)
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': url,
            'X-Title': 'AI T9 Autocomplete'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro-exp-03-25:free',
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
            temperature: 0.2,
            max_tokens: 50,
            stop: ["\n", ".", "!", "?", ";"],
            top_p: 0.9
          })
        })

        const data = await response.json()
        console.debug(`[Raw] Response:`, JSON.stringify(data, null, 2))

        // Handle rate limiting and other API errors
        if (!response.ok) {
          const errorMsg = data.error?.message || `API error: ${response.status}`
          const retryAfter = data.error?.metadata?.raw ? 
            JSON.parse(data.error.metadata.raw)?.error?.details?.[2]?.retryDelay?.replace('s', '') : 
            undefined

          // Cache the error to prevent hammering
          errorCache.set(cacheKey, { 
            error: errorMsg, 
            retryAfter: retryAfter ? parseInt(retryAfter) : undefined 
          })

          return { error: errorMsg, status: 429, retryAfter }
        }

        const rawSuggestion = data.choices?.[0]?.message?.content?.trim() || ''
        const suggestion = cleanAIResponse(rawSuggestion, text)

        // Always cache the result, even if empty
        const finalSuggestion = suggestion || ''
        cache.set(cacheKey, finalSuggestion)
        
        if (suggestion) {
          console.debug(`[API] Response cached: "${text}" → "${suggestion}"`)
        } else {
          console.debug(`[API] Empty response cached for: "${text}"`)
        }

        return { text: finalSuggestion }
      } finally {
        // Remove from in-flight requests when done
        inFlightRequests.delete(cacheKey)
      }
    })()

    // Store the promise in the in-flight requests map
    inFlightRequests.set(cacheKey, requestPromise)

    // Wait for the result
    const result = await requestPromise

    // Handle error response
    if (result.error) {
      if (result.retryAfter) {
        c.header('Retry-After', result.retryAfter.toString())
      }
      return c.json({ error: result.error }, result.status as 429)
    }

    return c.json(result)
  } catch (error) {
    console.error('[Error]', error instanceof Error ? error.message : 'Unknown error')
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    cache: { size: cache.size },
    inFlight: inFlightRequests.size
  })
})

export default app

