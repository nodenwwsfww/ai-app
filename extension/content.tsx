import cssText from "data-text:./style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

// Define types for input elements that we'll support
type SupportedElement = HTMLInputElement | HTMLTextAreaElement | Element;

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
      })
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
      
      // Sometimes mutations don't directly capture all elements, so periodically recheck
      if (needsProcessing) {
        processAllElements();
      }
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
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: value,
              url: window.location.href
            })
          });
          
          const { text } = await response.json();
          ghostText.textContent = value + text;
        } catch (error) {
          console.error(error);
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