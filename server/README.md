# autocomplete-server

Backend service for autocomplete functionality using Hono.

## Setup

To install dependencies:

```bash
bun install
```

Copy `.env.example` to `.env` and add your API keys.

## Running the server

```bash
bun run dev
```

The server will run on port 8080 by default (configurable via PORT environment variable).

This project uses [Hono](https://hono.dev/) for its API layer and [Bun](https://bun.sh) as its JavaScript runtime.
