# AI Autocomplete Browser Extension

A browser extension that provides AI-powered text completion suggestions as you type in any textarea across the web.

## Features

- Automatically provides text suggestions in any textarea
- Ghost text preview of the suggestion
- Press Tab to accept the suggestion
- Works across all websites
- Configurable API URL through the extension popup
- Built with Plasmo Framework for cross-browser compatibility

## Development

This extension is built with [Plasmo Framework](https://www.plasmo.com/), a powerful tool for building browser extensions.

### Prerequisites

- Node.js 14+
- npm or bun

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   cd extension
   npm install
   # or
   bun install
   ```

3. Start the development server:
   ```bash
   npm run dev
   # or
   bun run dev
   ```

4. Load the extension in your browser:
   - Chrome: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `extension/build/chrome-mv3-dev` directory
   - Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on...", and select any file in the `extension/build/firefox-mv2-dev` directory

### Building for Production

```bash
npm run build
# or
bun run build
```

The built extension will be in the `extension/build` directory.

## Server Setup

The extension requires a backend server to provide the AI completions. By default, it connects to `http://localhost:8080`.

1. Navigate to the `server` directory
2. Follow the setup instructions in the server's README

## Configuration

You can configure the API URL for completions through the extension popup.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
