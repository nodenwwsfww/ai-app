# AI T9 Server

Backend server for AI T9 autocomplete extension.

## Features

- Fast autocomplete suggestions using OpenRouter API (Claude 3 Opus)
- LRU caching with TTL
- Rate limiting
- Request validation
- CORS support
- Health check endpoint

## Setup

1. Install dependencies:
```bash
bun install
```

2. Create a `.env` file with your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_api_key_here
PORT=8080
NODE_ENV=development
```

You can get your OpenRouter API key at https://openrouter.ai/keys

3. Start the development server:
```bash
bun run dev
```

## API Endpoints

### POST /

Get autocomplete suggestions.

Request body:
```json
{
  "text": "string",
  "url": "string",
  "context": {
    "platform": "string",
    "element": "string",
    "type": "string",
    "language": "string",
    "previousContent": "string",
    "pageContent": "string"
  }
}
```

Response:
```json
{
  "text": "string",
  "cached": boolean
}
```

### GET /health

Check server health.

Response:
```json
{
  "status": "healthy",
  "cache": {
    "size": number,
    "items": number
  }
}
```

## Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development/production)

## Development

Run tests:
```bash
bun test
```

Build for production:
```bash
bun run build
```

This project was created using `bun init` in bun v1.0.26. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
