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

// // Add message listener for screenshots
// chrome.runtime.onMessage.addListener(
//   function(request, sender, sendResponse) {
//     console.log("Content script received message:", request);
    
//     if (request.action === "screenshot") {
//       console.log("Taking screenshot with html2canvas...");
      
//       html2canvas(document.body, {
//         logging: false,
//         allowTaint: true,
//         useCORS: true,
//         scale: window.devicePixelRatio
//       }).then(function(canvas) {
//         const dataURL = canvas.toDataURL("image/png", 1.0);
//         console.log("Screenshot captured with html2canvas, length:", dataURL.length);
        
//         // Send the screenshot data back
//         sendResponse({success: true, dataUrl: dataURL});
//       }).catch(error => {
//         console.error("html2canvas error:", error);
//         sendResponse({success: false, error: error.message});
//       });
      
//       // Return true to indicate we'll send a response asynchronously
//       return true;
//     }
//   }
// );

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

function PlasmoOverlay() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL)
  
  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get("apiUrl", (result) => {
        if (result.apiUrl) {
          setApiUrl(result.apiUrl)
        }
        
        // Inject floating button styles
        injectFloatingButtonStyles()
        
        // Create floating button
        createFloatingButton(result.apiUrl || DEFAULT_API_URL)
      })
    } else {
      // Fallback if chrome.storage is not available
      injectFloatingButtonStyles()
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
          setupInputElement(element as SupportedElement);
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
                setupInputElement(element as SupportedElement);
                processed.add(element);
                resizeObserver.observe(element);
              }
              
              // Check for supported elements inside the added node
              element.querySelectorAll?.('textarea, input, [contenteditable="true"]').forEach(childElement => {
                if (isSupportedElement(childElement) && !processed.has(childElement)) {
                  setupInputElement(childElement as SupportedElement);
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
  
  // Setup function for any supported input element
  const setupInputElement = (element: SupportedElement) => {
    // Create ghost text element
    const ghostText = document.createElement('div');
    ghostText.classList.add('ghost-text');
    
    if (element.parentNode) {
      element.parentNode.insertBefore(ghostText, element.nextSibling);
      copyStyles(element, ghostText);
      
      // Create debounced function for API calls
      const debouncedGetSuggestion = debounce(async (value: string) => {
        if (value.length === 0) {
          ghostText.textContent = '';
          return;
        }
        
        try {
          console.log("Preparing API request, trying to capture screenshot...")
          
          // Try to capture screenshot
          let screenshotData: string | undefined = undefined;
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
      };
      
      // Add event listeners based on element type
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.addEventListener('input', handleInput);
      } else {
        // For contenteditable
        element.addEventListener('input', handleInput);
        element.addEventListener('blur', handleInput); // Sometimes needed for contenteditable
      }
      
      element.addEventListener('keydown', handleKeyDown);
    }
  };
  
  // Copy styles from source to target element
  const copyStyles = (source: Element, target: HTMLElement) => {
    // Ensure parent has position for absolute positioning to work
    const parent = source.parentNode as HTMLElement;
    const computedParentStyle = window.getComputedStyle(parent);
    if (computedParentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    
    const computedStyle = window.getComputedStyle(source);
    const stylesToCopy = [
      'font-size', 'font-family', 'text-align',
      'padding-bottom', 'padding-top', 'padding-left', 'padding-right',
      'border-bottom-width', 'border-top-width', 'border-left-width', 'border-right-width',
      'box-sizing', 'line-height', 'width', 'height',
      'margin-top', 'margin-bottom', 'margin-left', 'margin-right'
    ];
    
    stylesToCopy.forEach(style => {
      target.style[style as any] = computedStyle.getPropertyValue(style);
    });
    
    // Set ghost text styles
    target.style.position = 'absolute';
    target.style.top = '0';
    target.style.left = '0';
    target.style.right = '0';
    target.style.bottom = '0';
    target.style.pointerEvents = 'none';
    target.style.zIndex = '1';
    target.style.color = 'rgba(204, 204, 204, 0.7)';
    target.style.background = 'none';
    target.style.overflow = 'hidden';
    target.style.whiteSpace = 'pre-wrap';
    target.style.wordWrap = 'break-word';
    target.style.borderColor = 'transparent';
    target.style.borderStyle = 'solid';
  };
  
  return null;
}

export default PlasmoOverlay 