import cssText from "data-text:./style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import html2canvas from "html2canvas"

// Define types for input elements that we'll support
type SupportedElement = HTMLInputElement | HTMLTextAreaElement | Element;

// Updated request type to include screenshot
interface CompleteRequest {
  text: string;
  url: string;
  screenshot?: string;
}

const API_URL = "http://localhost:8080/complete"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// Add styles for ghost text
const injectGhostTextStyles = () => {
  const style = document.createElement("style")
  style.textContent = `
    .ghost-text-container {
      position: relative;
    }
    .ghost-text {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
      color: rgba(204, 204, 204, 0.7); /* Light grey */
      background: none;
      border-color: transparent;
      border-style: solid;
      display: flex; /* Use flex for alignment */
      align-items: center; /* Vertically center content */
      white-space: pre-wrap; /* Respect whitespace and wrap */
      word-wrap: break-word; /* Break words if necessary */
      overflow: hidden; /* Hide overflow */
    }

    /* Specific styles for different input types */
    input[type="text"] + .ghost-text,
    input[type="email"] + .ghost-text,
    input[type="password"] + .ghost-text,
    input[type="search"] + .ghost-text,
    input[type="url"] + .ghost-text,
    input[type="tel"] + .ghost-text {
      text-overflow: ellipsis; /* Add ellipsis for overflow */
      justify-content: flex-start; /* Align text to the start */
      line-height: normal; /* Ensure normal line height */
    }

    textarea + .ghost-text {
      align-items: flex-start; /* Align text to top for textareas */
      display: block; /* Override flex for block behavior */
    }
  `
  document.head.appendChild(style)
}

// Helper to check if element is supported
const isSupportedElement = (element: Element): boolean => {
  const tagName = element.tagName;
  if (tagName === 'TEXTAREA') return true;
  if (tagName === 'INPUT') {
    const inputElement = element as HTMLInputElement;
    const supportedTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
    return supportedTypes.includes(inputElement.type.toLowerCase());
  }
  return element.getAttribute('contenteditable') === 'true';
}

// Helper to get element value
const getElementValue = (element: SupportedElement): string => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  if (element.getAttribute('contenteditable') === 'true') {
    return element.textContent || '';
  }
  return '';
}

// Helper to set element value
const setElementValue = (element: SupportedElement, value: string): void => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
  } else if (element.getAttribute('contenteditable') === 'true') {
    element.textContent = value;
  }
}

// Debounce function
const debounce = <T extends (...args: any[]) => void>(func: T, wait: number): T => {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  }) as T;
};

// Throttle function (Added)
const throttle = <T extends (...args: any[]) => void>(func: T, limit: number): T => {
  let inThrottle: boolean;
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
      func(...args);
    }
  }) as T;
};

function FunctionHidden() {
  const [isFirstInput, setIsFirstInput] = useState(true)

  // Function to capture screenshot once
  const captureScreenshotOnce = async () => {
    try {
      const { hasScreenshot } = await chrome.runtime.sendMessage({ type: 'HAS_SCREENSHOT' });
      if (hasScreenshot) return;

      const canvas = await html2canvas(document.body, {
        logging: false,
        allowTaint: true,
        useCORS: true,
        scale: window.devicePixelRatio
      });
      const screenshotData = canvas.toDataURL("image/png", 1.0);

      await chrome.runtime.sendMessage({
        type: 'STORE_SCREENSHOT',
        screenshot: screenshotData
      });
    } catch (error) {
      console.error("Screenshot capture error:", error); // Use console.error for errors
    }
  };

  // Copy styles from source to target ghost element
  const copyStyles = (source: Element, target: HTMLElement) => {
    const computedStyle = window.getComputedStyle(source);
    const parent = source.parentNode as HTMLElement;

    // Ensure parent is positioned relatively for absolute positioning of ghost text
    if (parent && window.getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Use string literal keys compatible with CSSStyleDeclaration and element.style
    const stylesToCopy = [
      'font-size', 'font-family', 'font-weight', 'letter-spacing',
      'text-align', 'text-indent', 'text-transform',
      'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
      'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width',
      'box-sizing', 'line-height',
      'margin-top', 'margin-bottom', 'margin-left', 'margin-right', // Keep margins for positioning relative to parent
      'direction', 'writing-mode', 'vertical-align'
    ];

    stylesToCopy.forEach(styleName => {
      // Read using getPropertyValue (safer for computed styles)
      const value = computedStyle.getPropertyValue(styleName);
      // Assign using setProperty which handles kebab-case.
      target.style.setProperty(styleName, value);
    });

    // Set dimensions explicitly
    target.style.width = `${source.clientWidth}px`;
    target.style.height = `${source.clientHeight}px`;

    // Match scroll position
    if (source instanceof HTMLElement) { // Check if source is an HTMLElement to access scroll properties
        target.scrollTop = source.scrollTop;
        target.scrollLeft = source.scrollLeft;
    }
  };


  useEffect(() => {
    injectGhostTextStyles()
    const processed = new WeakSet<Element>()
    // Keep the resize observer, it will be used on demand
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as Element;
        // Ghost text might not exist if accessed before setup, add checks
        const ghostText = element.nextElementSibling as HTMLElement | null;
        if (ghostText?.classList.contains('ghost-text')) {
          copyStyles(element, ghostText); // Update styles on resize
        }
      }
    });

    // Setup function for each supported input element (Called on demand now)
    const setupInputElement = (element: SupportedElement) => {
      // No need to check processed here, the caller will do it.
      processed.add(element); // Mark as processed

      const ghostText = document.createElement('div');
      ghostText.classList.add('ghost-text');
      ghostText.setAttribute('aria-hidden', 'true');


      if (element.parentNode) {
        element.parentNode.insertBefore(ghostText, element.nextSibling);
        copyStyles(element, ghostText); // Initial style copy
        resizeObserver.observe(element); // Observe for size changes AFTER setup

        // Debounced API call function
        const debouncedGetSuggestion = debounce(async (value: string) => {
           if (value.length === 0) {
             ghostText.textContent = '';
             return;
           }
           try {
             // Simplified screenshot logic: capture on first *suggestion fetch* for this input?
             // Or rely on the background script managing a single screenshot?
             // Let's assume background script handles the "once" logic based on messages.
             await captureScreenshotOnce(); // Attempt capture before fetch

             const { screenshot } = await chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT' });
             const requestBody: CompleteRequest = { text: value, url: window.location.href };
             if (screenshot) {
               requestBody.screenshot = screenshot;
             }

             const response = await fetch(API_URL, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(requestBody)
             });
             if (!response.ok) throw new Error(`API error: ${response.statusText}`);
             const { text: suggestion } = await response.json();
             if (suggestion && suggestion.length > 0) {
                 ghostText.textContent = value + suggestion;
             } else {
                 ghostText.textContent = value;
             }
             copyStyles(element, ghostText);
           } catch (error) {
             console.error("API request error:", error);
             ghostText.textContent = value;
           }
         }, 500);

        // Event handler for input/changes
        const handleInput = async () => {
           const value = getElementValue(element);
           ghostText.textContent = value;
           copyStyles(element, ghostText);

           if (value.length > 0) {
             // Removed isFirstInput state logic here, rely on captureScreenshotOnce internal check
             debouncedGetSuggestion(value);
           } else {
             ghostText.textContent = '';
           }
        };

        // Throttled event handler for scroll events
        const handleScroll = throttle(() => {
           copyStyles(element, ghostText);
        }, 100);

        // Event handler for keydown events
        const handleKeyDown = (e: KeyboardEvent) => {
           const currentGhostText = ghostText.textContent || '';
           const currentValue = getElementValue(element);

           if (e.key === 'Tab' && currentGhostText.length > currentValue.length && currentGhostText.startsWith(currentValue)) {
             e.preventDefault();
             setElementValue(element, currentGhostText);
             element.dispatchEvent(new Event('input', { bubbles: true }));
             ghostText.textContent = '';
           } else if (e.key === 'Enter' && !(element.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey)) {
             ghostText.textContent = '';
           }
           setTimeout(() => copyStyles(element, ghostText), 0);
        };

        // Attach event listeners specific to this element
        element.addEventListener('input', handleInput);
        element.addEventListener('scroll', handleScroll);
        element.addEventListener('keydown', handleKeyDown);
        if (element.getAttribute('contenteditable') === 'true') {
           element.addEventListener('blur', handleInput); // Or maybe blur should clear ghost text? Consider UX.
        }
        // Throttled window resize handler specific to this element
        const throttledResizeHandler = throttle(() => copyStyles(element, ghostText), 100);
        window.addEventListener('resize', throttledResizeHandler);

        // Store cleanup functions for *this specific element*
        // This is complex to manage correctly if elements are dynamically removed.
        // A simpler approach for now is relying on the main useEffect cleanup.
        // We'd need a Map<Element, Function[]> to track listeners per element for precise cleanup on element removal.


      } else {
          console.warn("Element has no parentNode, cannot attach ghost text:", element);
      }
    };

    // --- NEW: Listener for initial interaction ---
    const handleFocusIn = (event: FocusEvent) => {
        const target = event.target;
        if (target instanceof Element && isSupportedElement(target) && !processed.has(target)) {
            console.log("Setting up element:", target); // Debug log
            setupInputElement(target as SupportedElement);
        }
    };

    document.addEventListener('focusin', handleFocusIn, true); // Use capture phase might be slightly better

    // REMOVED: Initial processing of existing elements
    // REMOVED: MutationObserver for dynamically added elements

    // Clear ghost text when submit buttons are clicked (keep this global listener)
    const handleSubmitClick = (e: MouseEvent) => {
       const target = e.target as Element;
       if (target.tagName === 'BUTTON' || (target instanceof HTMLInputElement && target.type === 'submit')) {
         document.querySelectorAll('.ghost-text').forEach(ghost => {
           ghost.textContent = '';
         });
       }
    };
    document.addEventListener('click', handleSubmitClick, true);


    // Cleanup function
    return () => {
      console.log("Cleaning up FunctionHidden listeners"); // Debug log
      document.removeEventListener('focusin', handleFocusIn, true); // Remove focus listener
      document.removeEventListener('click', handleSubmitClick, true); // Remove submit click listener
      resizeObserver.disconnect(); // Disconnect resize observer

      // Remove all ghost text elements added by any setupInputElement call
      document.querySelectorAll('.ghost-text').forEach(el => el.remove());

      // Note: Listeners added directly to elements (input, scroll, keydown) and window (resize)
      // within setupInputElement are not explicitly removed here. If the component unmounts,
      // they should be garbage collected. If elements are removed dynamically *before* unmount,
      // listener removal would require more complex tracking (e.g., using a Map).
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return null;
}

export default FunctionHidden 