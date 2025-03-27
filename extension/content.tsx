import cssText from "data-text:./style.css"
import type { PlasmoCSConfig } from "plasmo"

// Add TypeScript interface for our custom HTMLTextAreaElement with ghostText property
interface CustomHTMLTextAreaElement extends HTMLTextAreaElement {
  ghostText?: HTMLDivElement
}

// Add TypeScript interface for element with ghostText property
interface ElementWithGhostText extends Element {
  ghostText?: HTMLDivElement
}

// CSS to be injected
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// Default API URL if not set in settings
const DEFAULT_API_URL = "http://localhost:8080"

// Configuration for the content script
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Main content script function that runs when the script is injected
function PlasmoInject() {
  let apiUrl = DEFAULT_API_URL

  // Try to get API URL from storage
  if (chrome.storage) {
    chrome.storage.local.get("apiUrl", (result) => {
      if (result.apiUrl) {
        apiUrl = result.apiUrl
      }
    })
  }

  // ResizeObserver to adjust ghost text when textarea size changes
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      // Access ghostText from the textarea element
      const target = entry.target as ElementWithGhostText
      if (target.ghostText) {
        copyStyles(entry.target, target.ghostText)
      }
    }
  })

  // Set up the event listener for textarea focus
  document.addEventListener("focusin", handleFocusIn)

  // Apply the logic to all textareas on page load
  document.querySelectorAll("textarea").forEach((textarea) => {
    handleFocusIn({ target: textarea })
    resizeObserver.observe(textarea)
  })

  // Listen for button clicks and clear ghost text
  document.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", function () {
      document.querySelectorAll("textarea").forEach((textarea) => {
        const customTextarea = textarea as CustomHTMLTextAreaElement
        if (customTextarea.ghostText) {
          customTextarea.ghostText.textContent = ""
        }
      })
    })
  })

  function handleFocusIn(event) {
    const target = event.target as CustomHTMLTextAreaElement
    
    if (target.dataset.inputListenerAdded) {
      return
    }

    if (target.tagName === "TEXTAREA") {
      const ghostText = document.createElement("div")

      ghostText.style.zIndex = "100"

      target.parentNode.insertBefore(ghostText, target.nextSibling)

      copyStyles(target, ghostText)

      // Store ghostText as a property of the textarea
      target.ghostText = ghostText

      const debouncedInputHandler = debounce(async function (e) {
        const inputTarget = e.target as CustomHTMLTextAreaElement
        if (inputTarget.value.length === 0) {
          ghostText.textContent = ""
          return
        }
        const suggestion = await getSuggestion(inputTarget.value)
        ghostText.textContent = inputTarget.value + `${suggestion}`
      }, 500)

      target.addEventListener("input", function (e) {
        const inputTarget = e.target as CustomHTMLTextAreaElement
        if (inputTarget.value.length === 0) {
          ghostText.textContent = ""
        } else {
          ghostText.textContent = inputTarget.value
          debouncedInputHandler(e)
        }
      })

      target.addEventListener("keydown", function (e) {
        const keydownTarget = e.target as CustomHTMLTextAreaElement
        if (e.key === "Tab") {
          e.preventDefault()
          keydownTarget.value = ghostText.textContent || ""
        } else if (e.key === "Enter") {
          ghostText.textContent = ""
        }
      })
    }

    target.dataset.inputListenerAdded = "true"
  }

  async function getSuggestion(inputValue) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: inputValue,
          url: window.location.href
        })
      })

      const { text } = await response.json()
      return text
    } catch (error) {
      console.error(error)
      return ""
    }
  }

  function copyStyles(source, target) {
    // get the parent of the source
    const parent = source.parentNode
    
    // apply position relative to the parent
    parent.style.position = "relative"

    const computedStyle = window.getComputedStyle(source)

    for (const key of computedStyle) {
      if (
        [
          "font-size",
          "font-family",
          "text-align",
          "padding-bottom",
          "padding-top",
          "padding-left",
          "padding-right",
          "border-bottom-width",
          "border-top-width",
          "border-left-width",
          "border-right-width",
          "box-sizing",
          "line-height",
          "width",
          "height"
        ].includes(key)
      ) {
        target.style[key] = computedStyle[key]
      }
    }
    target.style.position = "absolute"
    target.style.top = "0"
    target.style.left = "0"
    target.style.right = "0"
    target.style.bottom = "0"
    target.style.pointerEvents = "none"
    target.style.zIndex = "1"
    target.style.color = "rgba(204, 204, 204, 0.7)"
    target.style.background = "none"
    target.style.overflow = "hidden"
    target.style.whiteSpace = "pre-wrap"
    target.style.wordWrap = "break-word"
    target.style.borderColor = "transparent"
    target.style.borderStyle = "solid"
  }

  function debounce(func, wait) {
    let timeout
    return function (...args) {
      const context = this
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(context, args), wait)
    }
  }
}

// This invokes our main function when the content script is injected
PlasmoInject()

// Export an empty component (Plasmo expects a React component)
export default function PlasmoOverlay() {
  return null
} 