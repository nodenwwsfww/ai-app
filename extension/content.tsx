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

const DEFAULT_API_URL = "http://localhost:8080/complete"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// Add styles for floating button
const injectFloatingButtonStyles = () => {
  const style = document.createElement("style")
  style.textContent = `
    .floating-screenshot-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background-color: #34a853;
      color: white;
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 999999;
      transition: all 0.3s ease;
    }
    
    .floating-screenshot-btn:hover {
      transform: scale(1.1);
      background-color: #2d9147;
    }
    
    .floating-screenshot-btn:active {
      transform: scale(0.95);
    }
    
    .floating-screenshot-btn svg {
      width: 24px;
      height: 24px;
    }
    
    .floating-screenshot-status {
      position: fixed;
      bottom: 80px;
      right: 20px;
      padding: 8px 12px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      border-radius: 4px;
      font-size: 14px;
      z-index: 999999;
      max-width: 300px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .floating-screenshot-status.visible {
      opacity: 1;
    }
    
    .loading-spinner {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}

// Function to create the floating button
const createFloatingButton = (apiUrl: string) => {
  // First check if button already exists
  if (document.querySelector('.floating-screenshot-btn')) {
    return
  }
  
  // Create button
  const button = document.createElement('button')
  button.className = 'floating-screenshot-btn'
  button.title = 'Take a screenshot for AI analysis'
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  `
  
  // Create status element
  const statusEl = document.createElement('div')
  statusEl.className = 'floating-screenshot-status'
  
  // Append elements to body
  document.body.appendChild(button)
  document.body.appendChild(statusEl)
  
  // Click handler for the button
  button.addEventListener('click', async () => {
    // Show processing status
    button.innerHTML = `
      <svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
    `
    statusEl.textContent = 'Capturing screenshot...'
    statusEl.className = 'floating-screenshot-status visible'
    
    try {
      // Use html2canvas directly
      console.log("Taking screenshot with html2canvas...")
      
      html2canvas(document.body, {
        logging: false,
        allowTaint: true,
        useCORS: true,
        scale: window.devicePixelRatio
      }).then(async function(canvas) {
        const dataURL = canvas.toDataURL("image/png", 1.0)
        console.log("Screenshot captured with html2canvas, length:", dataURL.length)
        
        // Screenshot captured successfully
        statusEl.textContent = 'Sending to OpenAI...'
        
        try {
          // Get target API URL
          const targetUrl = apiUrl || DEFAULT_API_URL
          
          // Send screenshot to API
          const apiResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: "What's in this screenshot?",
              url: window.location.href,
              screenshot: dataURL
            })
          })
          
          if (apiResponse.ok) {
            const data = await apiResponse.json()
            statusEl.textContent = 'Screenshot processed successfully!'
          } else {
            statusEl.textContent = `Error: API returned ${apiResponse.status}`
          }
        } catch (error) {
          statusEl.textContent = `Error: ${error.message}`
        } finally {
          resetButton()
          setTimeout(() => { statusEl.className = 'floating-screenshot-status' }, 3000)
        }
      }).catch(error => {
        console.error("html2canvas error:", error)
        statusEl.textContent = `Error: ${error.message}`
        resetButton()
        setTimeout(() => { statusEl.className = 'floating-screenshot-status' }, 3000)
      })
    } catch (error) {
      statusEl.textContent = `Error: ${error.message}`
      resetButton()
      setTimeout(() => { statusEl.className = 'floating-screenshot-status' }, 3000)
    }
    
    function resetButton() {
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      `
    }
  })
  
  // Simulate one click after a short delay
  setTimeout(() => {
    console.log("Simulating click on screenshot button")
    const clickEvent = new CustomEvent('click')
    button.dispatchEvent(clickEvent)
  }, 2000)
}

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout
  return function (...args: any[]) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Helper to check if element is supported for text completion
const isSupportedElement = (element: Element): boolean => {
  if (element.tagName === 'TEXTAREA') return true;
  if (element.tagName === 'INPUT') {
    const inputElement = element as HTMLInputElement;
    const supportedTypes = ['text', 'email', 'search', 'url', 'tel', 'password'];
    return supportedTypes.includes(inputElement.type.toLowerCase());
  }
  if (element.getAttribute('contenteditable') === 'true') return true;
  return false;
}

// Helper to get text value from different element types
const getElementValue = (element: SupportedElement): string => {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  }
  if (element.getAttribute('contenteditable') === 'true') {
    return element.textContent || '';
  }
  return '';
}

// Helper to set text value to different element types
const setElementValue = (element: SupportedElement, value: string): void => {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    (element as HTMLInputElement | HTMLTextAreaElement).value = value;
  } else if (element.getAttribute('contenteditable') === 'true') {
    element.textContent = value;
  }
}

// Add styles for ghost text
const injectGhostTextStyles = () => {
  const style = document.createElement("style")
  style.textContent = `
    .ghost-text {
      position: absolute;
      pointer-events: none;
      z-index: 1;
      color: rgba(204, 204, 204, 0.7);
      background: none;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      border-color: transparent;
      border-style: solid;
      box-sizing: border-box;
      display: flex;
      align-items: center; /* Helps with vertical alignment */
    }
    
    /* Fix for inputs with native appearance */
    input[type="text"] + .ghost-text,
    input[type="email"] + .ghost-text,
    input[type="password"] + .ghost-text,
    input[type="search"] + .ghost-text,
    input[type="url"] + .ghost-text,
    input[type="tel"] + .ghost-text {
      text-indent: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      /* These properties help with vertical centering */
      display: flex;
      align-items: center;
      justify-content: flex-start;
      /* Improve text positioning */
      padding-top: 0 !important;
      line-height: normal;
    }
    
    /* Fix for textareas */
    textarea + .ghost-text {
      white-space: pre-wrap;
      word-break: break-word;
      display: block; /* Different display mode for textareas */
      align-items: initial;
    }
    
    /* Force correct text alignment for common input elements */
    .ghost-text {
      padding-top: 0;
    }
  `
  document.head.appendChild(style)
}

function PlasmoOverlay() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL)
  const [screenshotTimestamps, setScreenshotTimestamps] = useState<number[]>([]);
  
  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get("apiUrl", (result) => {
        if (result.apiUrl) {
          setApiUrl(result.apiUrl)
        }
        
        // Inject floating button styles
        injectFloatingButtonStyles()
        
        // Inject ghost text styles
        injectGhostTextStyles()
        
        // Create floating button
        createFloatingButton(result.apiUrl || DEFAULT_API_URL)
      })
    } else {
      // Fallback if chrome.storage is not available
      injectFloatingButtonStyles()
      injectGhostTextStyles()
      createFloatingButton(DEFAULT_API_URL)
    }
    
    // Track processed elements to avoid duplicating work
    const processed = new WeakSet<Element>()
    
    // Set up resize observer to handle element size changes
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as Element;
        const ghostText = element.nextElementSibling as HTMLDivElement;
        if (ghostText?.classList.contains('ghost-text')) {
          copyStyles(element, ghostText);
        }
      }
    })
    
    // Function to process all supported elements in the document
    const processAllElements = () => {
      // Find and setup all supported input elements
      document.querySelectorAll('textarea, input, [contenteditable="true"]').forEach(element => {
        if (isSupportedElement(element) && !processed.has(element)) {
          setupInputElement(element as SupportedElement, screenshotTimestamps, setScreenshotTimestamps);
          processed.add(element);
          resizeObserver.observe(element);
        }
      });
    }
    
    // Initial processing of elements
    processAllElements();
    
    // Watch for new elements being added to the DOM
    const observer = new MutationObserver(mutations => {
      let needsProcessing = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Check if the added node is a supported input element
              if (isSupportedElement(element) && !processed.has(element)) {
                setupInputElement(element as SupportedElement, screenshotTimestamps, setScreenshotTimestamps);
                processed.add(element);
                resizeObserver.observe(element);
              }
              
              // Check for supported elements inside the added node
              element.querySelectorAll?.('textarea, input, [contenteditable="true"]').forEach(childElement => {
                if (isSupportedElement(childElement) && !processed.has(childElement)) {
                  setupInputElement(childElement as SupportedElement, screenshotTimestamps, setScreenshotTimestamps);
                  processed.add(childElement);
                  resizeObserver.observe(childElement);
                }
              });
            }
          });
          
          needsProcessing = true;
        }
      });
      
      // REMOVED redundant processAllElements call
      // if (needsProcessing) {
      //   processAllElements();
      // }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable']
    });
    
    // Clear ghost text when buttons are clicked (common form submission pattern)
    document.addEventListener('click', e => {
      if ((e.target as Element).tagName === 'BUTTON' || 
          ((e.target as HTMLInputElement).type === 'submit')) {
        document.querySelectorAll('.ghost-text').forEach(ghostText => {
          ghostText.textContent = '';
        });
      }
    });
    
    // Cleanup on unmount
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [apiUrl]);
  
  // Setup function accepts state and setter
  const setupInputElement = (element: SupportedElement, timestamps: number[], setTimestamps: React.Dispatch<React.SetStateAction<number[]>>) => {
    // Create ghost text element
    const ghostText = document.createElement('div');
    ghostText.classList.add('ghost-text');
    
    if (element.parentNode) {
      element.parentNode.insertBefore(ghostText, element.nextSibling);
      copyStyles(element, ghostText);
      
      // Apply an initial position fix with a short delay to ensure rendering is complete
      setTimeout(() => {
        // Get element positions
        const elementRect = element.getBoundingClientRect();
        const ghostRect = ghostText.getBoundingClientRect();
        
        console.log("Initial position measurement:", {
          element: {
            top: elementRect.top,
            height: elementRect.height
          },
          ghost: {
            top: ghostRect.top,
            height: ghostRect.height
          }
        });
        
        // Apply correction if ghost text is positioned higher
        if (ghostRect.top < elementRect.top) {
          const correction = elementRect.top - ghostRect.top;
          console.log("Applying initial vertical correction:", correction);
          ghostText.style.transform = `translateY(${correction}px)`;
        }
      }, 50);
      
      // Function to update ghost text position
      const updateGhostTextPosition = () => {
        // Debug
        console.log("Updating ghost text position for", element.tagName);
        
        // Ensure the ghost text is correctly positioned
        copyStyles(element, ghostText);
        
        // For elements that might have complex padding/scrolling
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          // Get computed styles for more accurate positioning
          const computedStyle = window.getComputedStyle(element);
          
          // Parse important style values
          const paddingTop = parseInt(computedStyle.paddingTop) || 0;
          const borderTop = parseInt(computedStyle.borderTopWidth) || 0;
          
          console.log("Input metrics:", {
            paddingTop,
            borderTop,
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft
          });
          
          // Reset the padding before setting the new values to avoid accumulation
          ghostText.style.paddingTop = `${paddingTop}px`;
          ghostText.style.paddingLeft = `${parseInt(computedStyle.paddingLeft) || 0}px`;
          
          // Adjust for scrolling
          ghostText.style.paddingTop = `${paddingTop - element.scrollTop}px`;
          ghostText.style.paddingLeft = `${parseInt(ghostText.style.paddingLeft) + element.scrollLeft}px`;
          
          // Try to fix vertical alignment with a transform
          // This helps in cases where the text baseline is misaligned
          ghostText.style.transform = 'translateY(0)';
        }
        
        // Debug final positions
        setTimeout(() => {
          const elementRect = element.getBoundingClientRect();
          const ghostRect = ghostText.getBoundingClientRect();
          
          console.log("Position comparison:", {
            elementTop: elementRect.top,
            ghostTop: ghostRect.top,
            difference: ghostRect.top - elementRect.top
          });
          
          // If the ghost text is still too high, apply a correction
          if (ghostRect.top < elementRect.top) {
            const correction = elementRect.top - ghostRect.top;
            console.log("Applying vertical correction:", correction);
            ghostText.style.transform = `translateY(${correction}px)`;
          }
        }, 10);
      };
      
      // Create debounced function for API calls
      const debouncedGetSuggestion = debounce(async (value: string) => {
        if (value.length === 0) {
          ghostText.textContent = '';
          return;
        }
        
        try {
          console.log("Preparing API request, checking screenshot rate limit...")
          
          // --- Screenshot Rate Limiting Logic --- START ---
          let shouldTakeScreenshot = false;
          const now = Date.now();
          const oneMinuteAgo = now - 60 * 1000;
  
          // Filter old timestamps
          const recentTimestamps = timestamps.filter(ts => ts > oneMinuteAgo);
  
          if (recentTimestamps.length < 2) {
            shouldTakeScreenshot = true;
            // Add timestamp for this attempt *before* the async operation
            setTimestamps([...recentTimestamps, now]); 
          } else {
            console.log("Screenshot rate limit hit (max 2 per minute). Skipping screenshot.");
          }
          // --- Screenshot Rate Limiting Logic --- END ---
  
          // Try to capture screenshot only if rate limit allows
          let screenshotData: string | undefined = undefined;
          if (shouldTakeScreenshot) {
            try {
              console.log("Capturing autocomplete screenshot with html2canvas...")
              
              // Use html2canvas directly
              const canvas = await html2canvas(document.body, {
                logging: false,
                allowTaint: true,
                useCORS: true,
                scale: window.devicePixelRatio
              });
              
              screenshotData = canvas.toDataURL("image/png", 1.0);
              console.log("Screenshot captured with html2canvas, length:", screenshotData.length)
            } catch (error) {
              console.error("html2canvas error:", error)
            }
          }
          
          // Prepare request
          const requestBody: CompleteRequest = {
            text: value,
            url: window.location.href
          }
          
          // Add screenshot if available
          if (screenshotData) {
            console.log("Adding screenshot to request, data length:", screenshotData.length)
            requestBody.screenshot = screenshotData
          } else {
            console.log("No screenshot data to add to request")
          }
          
          console.log("Sending request to API:", apiUrl)
          const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          
          const { text } = await apiResponse.json();
          ghostText.textContent = value + text;
          updateGhostTextPosition(); // Update position after text is set
        } catch (error) {
          console.error("API request error:", error);
          ghostText.textContent = value;
        }
      }, 500);
      
      // Input event handling for different element types
      const handleInput = () => {
        const value = getElementValue(element);
        if (value.length === 0) {
          ghostText.textContent = '';
        } else {
          ghostText.textContent = value;
          debouncedGetSuggestion(value);
        }
        updateGhostTextPosition(); // Update after input
      };
      
      // Handle scroll events
      const handleScroll = () => {
        updateGhostTextPosition();
      };
      
      // Keydown event for all element types
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          setElementValue(element, ghostText.textContent || '');
          // Trigger input event for compatibility
          element.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (e.key === 'Enter' && 
                  !(element.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey)) {
          // Clear on Enter, but for textareas only clear on Ctrl+Enter or Cmd+Enter
          ghostText.textContent = '';
        }
        
        // Update after key events
        setTimeout(updateGhostTextPosition, 0);
      };
      
      // Add event listeners based on element type
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.addEventListener('input', handleInput);
        element.addEventListener('scroll', handleScroll);
      } else {
        // For contenteditable
        element.addEventListener('input', handleInput);
        element.addEventListener('blur', handleInput); // Sometimes needed for contenteditable
        element.addEventListener('scroll', handleScroll);
      }
      
      element.addEventListener('keydown', handleKeyDown);
      
      // Update position on window resize
      window.addEventListener('resize', updateGhostTextPosition);
    }
  };
  
  // Copy styles from source to target element
  const copyStyles = (source: Element, target: HTMLElement) => {
    // Debugging
    console.log("Copying styles from", source.tagName, "to ghost text");
    
    // Ensure parent has position for absolute positioning to work
    const parent = source.parentNode as HTMLElement;
    const computedParentStyle = window.getComputedStyle(parent);
    if (computedParentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    
    const computedStyle = window.getComputedStyle(source);
    
    // Debug source element position and dimensions
    const sourceRect = source.getBoundingClientRect();
    console.log("Source element rect:", {
      top: sourceRect.top,
      left: sourceRect.left,
      width: sourceRect.width,
      height: sourceRect.height
    });
    
    // More comprehensive list of styles to copy
    const stylesToCopy = [
      'font-size', 'font-family', 'font-weight', 'letter-spacing',
      'text-align', 'text-indent', 'text-transform',
      'padding-bottom', 'padding-top', 'padding-left', 'padding-right',
      'border-bottom-width', 'border-top-width', 'border-left-width', 'border-right-width',
      'box-sizing', 'line-height', 'width', 'height',
      'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
      'direction', 'writing-mode', 'vertical-align'
    ];
    
    // Capture important vertical alignment properties
    const lineHeight = computedStyle.getPropertyValue('line-height');
    const verticalAlign = computedStyle.getPropertyValue('vertical-align');
    const paddingTop = computedStyle.getPropertyValue('padding-top');
    const paddingBottom = computedStyle.getPropertyValue('padding-bottom');
    const borderTopWidth = computedStyle.getPropertyValue('border-top-width');
    const borderBottomWidth = computedStyle.getPropertyValue('border-bottom-width');
    
    console.log("Source vertical properties:", {
      lineHeight,
      verticalAlign,
      paddingTop,
      paddingBottom,
      borderTopWidth,
      borderBottomWidth
    });
    
    stylesToCopy.forEach(style => {
      target.style[style as any] = computedStyle.getPropertyValue(style);
    });
    
    // Set ghost text styles
    target.style.position = 'absolute';
    
    // Rather than setting all edges to 0, we'll be more precise with placement
    // This is especially important for vertical alignment
    target.style.top = '0';
    target.style.left = '0';
    target.style.width = `${source.clientWidth}px`;
    target.style.height = `${source.clientHeight}px`;
    
    target.style.pointerEvents = 'none';
    target.style.zIndex = '1';
    target.style.color = 'rgba(204, 204, 204, 0.7)';
    target.style.background = 'none';
    target.style.overflow = 'hidden';
    target.style.whiteSpace = 'pre-wrap';
    target.style.wordWrap = 'break-word';
    target.style.borderColor = 'transparent';
    target.style.borderStyle = 'solid';
    
    // Sync scrolling position
    if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement) {
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
    } else if ('scrollTop' in source && 'scrollLeft' in source) {
      target.scrollTop = (source as any).scrollTop;
      target.scrollLeft = (source as any).scrollLeft;
    }
    
    // Debug target positioning after style copy
    const targetRect = target.getBoundingClientRect();
    console.log("Ghost text rect after style copy:", {
      top: targetRect.top,
      left: targetRect.left,
      width: targetRect.width,
      height: targetRect.height
    });
  };
  
  return null;
}

export default PlasmoOverlay 