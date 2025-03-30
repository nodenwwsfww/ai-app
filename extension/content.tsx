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

    // Observer for element resizing
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as Element;
        const ghostText = element.nextElementSibling as HTMLElement | null; // Type assertion
        if (ghostText?.classList.contains('ghost-text')) {
          copyStyles(element, ghostText); // Update styles on resize
        }
      }
    });

    // Setup function for each supported input element
    const setupInputElement = (element: SupportedElement) => {
      if (processed.has(element)) return; // Already processed

      const ghostText = document.createElement('div');
      ghostText.classList.add('ghost-text');
      // Make it non-interactive for screen readers
      ghostText.setAttribute('aria-hidden', 'true');


      if (element.parentNode) {
        // Insert ghost text after the element
        element.parentNode.insertBefore(ghostText, element.nextSibling);
        copyStyles(element, ghostText); // Initial style copy
        processed.add(element);
        resizeObserver.observe(element); // Observe for size changes

        // Debounced API call function
        const debouncedGetSuggestion = debounce(async (value: string) => {
          if (value.length === 0) {
            ghostText.textContent = '';
            return;
          }
          try {
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
            // Only show suggestion if it adds something
            if (suggestion && suggestion.length > 0) {
                ghostText.textContent = value + suggestion;
            } else {
                ghostText.textContent = value; // Show current value if no suggestion
            }
            copyStyles(element, ghostText); // Update styles after getting suggestion
          } catch (error) {
            console.error("API request error:", error);
            ghostText.textContent = value; // Show current value on error
          }
        }, 500); // 500ms debounce

        // Event handler for input/changes
        const handleInput = async () => {
          const value = getElementValue(element);
          ghostText.textContent = value; // Immediately update ghost text to match input
          copyStyles(element, ghostText); // Update styles on input

          if (value.length > 0) {
            if (isFirstInput) {
              setIsFirstInput(false);
              await captureScreenshotOnce(); // Capture screenshot on first input
            }
            debouncedGetSuggestion(value); // Trigger suggestion fetching
          } else {
            ghostText.textContent = ''; // Clear ghost text if input is empty
          }
        };

        // Event handler for scroll events
        const handleScroll = () => {
          copyStyles(element, ghostText); // Update styles/scroll on scroll
        };

        // Event handler for keydown events (Tab completion, Enter clearing)
        const handleKeyDown = (e: KeyboardEvent) => {
          const currentGhostText = ghostText.textContent || '';
          const currentValue = getElementValue(element);

          // Tab completion: only if ghost text is longer than input value
          if (e.key === 'Tab' && currentGhostText.length > currentValue.length && currentGhostText.startsWith(currentValue)) {
            e.preventDefault();
            setElementValue(element, currentGhostText);
            // Trigger input event for frameworks/listeners
            element.dispatchEvent(new Event('input', { bubbles: true }));
            ghostText.textContent = ''; // Clear ghost text after completion
          } else if (e.key === 'Enter' && !(element.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey)) {
            // Clear ghost text on Enter (except for multiline textareas without Ctrl/Meta)
            ghostText.textContent = '';
          }
          // Update styles after keydown potentially changes content/scroll
          setTimeout(() => copyStyles(element, ghostText), 0);
        };

        // Attach event listeners
        element.addEventListener('input', handleInput);
        element.addEventListener('scroll', handleScroll);
        element.addEventListener('keydown', handleKeyDown);
        // For contenteditable, also listen to blur to catch changes
        if (element.getAttribute('contenteditable') === 'true') {
          element.addEventListener('blur', handleInput);
        }
        // Update styles on window resize
        window.addEventListener('resize', () => copyStyles(element, ghostText));

      } else {
          console.warn("Element has no parentNode, cannot attach ghost text:", element);
      }
    };

    // Initial processing of existing elements
    document.querySelectorAll('textarea, input, [contenteditable="true"]').forEach(element => {
        if(isSupportedElement(element)) {
            setupInputElement(element as SupportedElement);
        }
    });

    // Observer for dynamically added elements
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) { // Check if node is an Element
            // Check the node itself
            if (isSupportedElement(node)) {
              setupInputElement(node as SupportedElement);
            }
            // Check descendants of the node
            node.querySelectorAll('textarea, input, [contenteditable="true"]').forEach(childElement => {
              if(isSupportedElement(childElement)) {
                setupInputElement(childElement as SupportedElement);
              }
            });
          }
        });
        // Handle changes to contenteditable attribute
        if (mutation.type === 'attributes' && mutation.attributeName === 'contenteditable') {
            const targetElement = mutation.target;
            if (targetElement instanceof Element && isSupportedElement(targetElement)) {
                setupInputElement(targetElement as SupportedElement);
            }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable'] // Watch for changes to contenteditable
    });

    // Clear ghost text when submit buttons are clicked
    document.addEventListener('click', e => {
      const target = e.target as Element;
      if (target.tagName === 'BUTTON' || (target instanceof HTMLInputElement && target.type === 'submit')) {
        document.querySelectorAll('.ghost-text').forEach(ghost => {
          ghost.textContent = '';
        });
      }
    }, true); // Use capture phase to potentially clear before form submission logic


    // Cleanup function
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      // Remove window resize listener? - Decided against for simplicity, usually minor impact.
      // Could add removal logic here if needed.
      document.removeEventListener('click', () => {}, true); // Need the exact function ref to remove, complex here. Consider alternatives if cleanup is critical.
       // Clean up ghost text elements and listeners associated with elements if needed (more complex)
       document.querySelectorAll('.ghost-text').forEach(el => el.remove());
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return null; // This component doesn't render anything itself
}

export default FunctionHidden 