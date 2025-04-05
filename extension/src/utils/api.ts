import { STORAGE_KEYS } from "~constants"
import { captureScreenshotOnce } from "~contents-helpers/web"
import type { CompleteRequest } from "~types"

// Retrieve user settings from storage
export const getUserSettings = async (): Promise<{
  userCountry: string | undefined
  userCity: string | undefined
}> => {
  if (!chrome.storage?.local) {
    return { userCountry: undefined, userCity: undefined }
  }

  return await new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.USER_COUNTRY, STORAGE_KEYS.USER_CITY],
      (result) => {
        resolve({
          userCountry: result[STORAGE_KEYS.USER_COUNTRY] || undefined,
          userCity: result[STORAGE_KEYS.USER_CITY] || undefined
        })
      }
    )
  })
}

// Get screenshots from background
export const getScreenshots = async (): Promise<{
  currentScreenshot: string | null
  previousScreenshot: string | null
  previousTabUrl: string | null
}> => {
  return await chrome.runtime.sendMessage({
    type: "GET_BOTH_SCREENSHOTS"
  })
}

// Prepare API request with common parameters
export const prepareRequestBody = (
  text: string,
  userSettings: {
    userCountry: string | undefined
    userCity: string | undefined
  },
  screenshots: {
    currentScreenshot: string | null
    previousScreenshot: string | null
    previousTabUrl: string | null
  }
): CompleteRequest => {
  const requestBody: CompleteRequest = {
    text,
    url: window.location.href,
    ...(userSettings.userCountry && {
      userCountry: userSettings.userCountry
    }),
    ...(userSettings.userCity && { userCity: userSettings.userCity })
  }

  // Add current screenshot if available
  if (screenshots.currentScreenshot) {
    requestBody.screenshot = screenshots.currentScreenshot
  }

  // Add previous screenshot and URL if available
  if (screenshots.previousScreenshot) {
    requestBody.previousScreenshot = screenshots.previousScreenshot
    if (screenshots.previousTabUrl) {
      requestBody.previousTabUrl = screenshots.previousTabUrl
    }
  }

  return requestBody
}

// Get suggestions from API
export const getSuggestion = async (text: string): Promise<string | null> => {
  try {
    // Take screenshot when needed
    await captureScreenshotOnce(chrome)

    // Get user settings
    const userSettings = await getUserSettings()

    // Get screenshots
    const screenshots = await getScreenshots()

    // Prepare request body
    const requestBody = prepareRequestBody(text, userSettings, screenshots)

    // Make API request
    const response = await fetch(process.env.PLASMO_PUBLIC_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const { text: suggestion } = await response.json()

    // Check for model refusal or empty suggestion
    const noSuggestion =
      !suggestion ||
      suggestion.length === 0 ||
      suggestion === "[No plausible continuation]"

    return noSuggestion ? null : suggestion
  } catch (error) {
    console.error("API request error:", error)
    return null
  }
}
