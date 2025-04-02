import { useEffect, useState } from "react"
import html2canvas from "html2canvas"
import type { PlasmoCSConfig } from "plasmo"
import type { SupportedElement, CompleteRequest } from "../types"
import {
    injectGhostTextStyles,
    isSupportedElement,
    getElementValue,
    setElementValue,
    copyStyles,
    debounce,
    throttle
} from "~/utils/web";

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    all_frames: true
}

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

            const response = await fetch(process.env.PLASMO_PUBLIC_API_URL, {
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

        // Throttled event handler for scroll events (Improved)
        const handleScroll = throttle(() => {
          copyStyles(element, ghostText); // Update styles/scroll on scroll (throttled)
        }, 100); // Throttle to run at most every 100ms

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
        // Update styles on window resize (Improved)
        const throttledResizeHandler = throttle(() => copyStyles(element, ghostText), 100); // Throttle to run at most every 100ms
        window.addEventListener('resize', throttledResizeHandler);

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


    // Cleanup function (Improved slightly for clarity, but full listener removal needs more infrastructure)
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      // To properly remove listeners added in setupInputElement, we'd need to track them
      // (e.g., in a Map<Element, Function>) and iterate/remove here.
      // The current approach relies on the component unmount removing everything eventually.
      // Removing the global click listener:
      // This requires storing the listener function reference used in addEventListener.
      // Example:
      // const globalClickListener = e => { ... };
      // document.addEventListener('click', globalClickListener, true);
      // return () => { document.removeEventListener('click', globalClickListener, true); ... };
      // For now, leaving the simplified global listener removal comment.
       document.querySelectorAll('.ghost-text').forEach(el => el.remove()); // Remove ghost text elements
    };
  }, []); // Empty dependency array ensures this runs once on mount

  return null; // This component doesn't render anything itself
}

export default FunctionHidden 