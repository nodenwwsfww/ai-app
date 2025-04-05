export const IGNORE_PATTERNS = [
  "googleads.g.doubleclick.net",
  "googletagmanager.com",
  "googletag.com",
  "googletag.com",
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "bing.com"
]

// Add storage keys constants
export const STORAGE_KEYS = {
  TRIAL_END_TIME: "trialEndTime",
  USER_COUNTRY: "userCountry",
  USER_CITY: "userCity",
  PREVIOUS_SCREENSHOT: "previousScreenshotData",
  PREVIOUS_TAB_URL: "previousTabUrl"
} as const

// UI Constants
export const UI = {
  COLORS: {
    GHOST_TEXT: "rgba(204, 204, 204, 0.7)",
    HIGHLIGHT: "rgba(66, 133, 244, 0.2)"
  },
  Z_INDEX: {
    GHOST_TEXT: 1,
    OVERLAY: 1000
  },
  CLASS_NAMES: {
    GHOST_TEXT: "ghost-text",
    OVERLAY: "ai-t9-suggestion-overlay"
  }
} as const

// API and Request Settings
export const API = {
  DEBOUNCE_MS: 500,
  THROTTLE_MS: 100
} as const
