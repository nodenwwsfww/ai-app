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
      align-items: center;
    }
    
    input[type="text"] + .ghost-text,
    input[type="email"] + .ghost-text,
    input[type="password"] + .ghost-text,
    input[type="search"] + .ghost-text,
    input[type="url"] + .ghost-text,
    input[type="tel"] + .ghost-text {
      text-indent: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding-top: 0 !important;
      line-height: normal;
    }
    
    textarea + .ghost-text {
      white-space: pre-wrap;
      word-break: break-word;
      display: block;
      align-items: initial;
    }
    
    .ghost-text {
      padding-top: 0;
    }
  `
  document.head.appendChild(style)
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

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout
  return function (...args: any[]) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

function FunctionHidden() {
  const [isFirstInput, setIsFirstInput] = useState(true)

  // Function to capture screenshot once
  const captureScreenshotOnce = async () => {
    try {
      // Check if screenshot already exists
      const { hasScreenshot } = await chrome.runtime.sendMessage({ type: 'HAS_SCREENSHOT' });
      console.info("@hasScreenshot", hasScreenshot);
      if (hasScreenshot) return;

      console.info("@Capturing initial screenshot with html2canvas...");
      const canvas = await html2canvas(document.body, {
        logging: false,
        allowTaint: true,
        useCORS: true,
        scale: window.devicePixelRatio
      });
      
      const screenshotData = canvas.toDataURL("image/png", 1.0);
      console.info("@Screenshot captured, length:", screenshotData.length);
      
      // Store screenshot in background
      await chrome.runtime.sendMessage({
        type: 'STORE_SCREENSHOT',
        screenshot: screenshotData
      });

    } catch (error) {
      console.info("@Screenshot capture error:", error);
    }
  };

  useEffect(() => {
    
    injectGhostTextStyles()
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
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              if (isSupportedElement(element) && !processed.has(element)) {
                setupInputElement(element as SupportedElement);
                processed.add(element);
                resizeObserver.observe(element);
              }
              
              element.querySelectorAll?.('textarea, input, [contenteditable="true"]').forEach(childElement => {
                if (isSupportedElement(childElement) && !processed.has(childElement)) {
                  setupInputElement(childElement as SupportedElement);
                  processed.add(childElement);
                  resizeObserver.observe(childElement);
                }
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable']
    });
    
    // Clear ghost text when buttons are clicked
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
  }, []);
  
  // Setup function for input elements
  const setupInputElement = (element: SupportedElement) => {
    // Create ghost text element
    const ghostText = document.createElement('div');
    ghostText.classList.add('ghost-text');
    
    if (element.parentNode) {
      element.parentNode.insertBefore(ghostText, element.nextSibling);
      copyStyles(element, ghostText);
      
      setTimeout(() => {
        const elementRect = element.getBoundingClientRect();
        const ghostRect = ghostText.getBoundingClientRect();
        
        if (ghostRect.top < elementRect.top) {
          const correction = elementRect.top - ghostRect.top;
          ghostText.style.transform = `translateY(${correction}px)`;
        }
      }, 50);
      
      // Function to update ghost text position
      const updateGhostTextPosition = () => {
        copyStyles(element, ghostText);
        
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const computedStyle = window.getComputedStyle(element);
          const paddingTop = parseInt(computedStyle.paddingTop) || 0;
          
          ghostText.style.paddingTop = `${paddingTop - element.scrollTop}px`;
          ghostText.style.paddingLeft = `${parseInt(computedStyle.paddingLeft) + element.scrollLeft}px`;
          ghostText.style.transform = 'translateY(0)';
        }
        
        setTimeout(() => {
          const elementRect = element.getBoundingClientRect();
          const ghostRect = ghostText.getBoundingClientRect();
          
          if (ghostRect.top < elementRect.top) {
            const correction = elementRect.top - ghostRect.top;
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
          // Get screenshot from background if available
          const { screenshot } = await chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT' });
          
          // Prepare request
          const requestBody: CompleteRequest = {
            text: value,
            url: window.location.href
          }
          
          // Add screenshot if available
          if (screenshot) {
            requestBody.screenshot = screenshot;
          }
          
          const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          
          const { text } = await apiResponse.json();
          ghostText.textContent = value + text;
          updateGhostTextPosition();
        } catch (error) {
          console.info("@API request error:", error);
          ghostText.textContent = value;
        }
      }, 500);
      
      // Input event handling
      const handleInput = async () => {
        const value = getElementValue(element);
        if (value.length === 0) {
          ghostText.textContent = '';
        } else {
          if (isFirstInput) {
            console.info("@[first input] Capturing initial screenshot");
            console.info("@Setting isFirstInput:", isFirstInput);
            setIsFirstInput(false);
            await captureScreenshotOnce();
          } else {
            console.info("@[input] not first input, Capturing screenshot");
          }
          ghostText.textContent = value;
          debouncedGetSuggestion(value);
        }
        updateGhostTextPosition();
      };
      
      // Handle scroll events
      const handleScroll = () => {
        updateGhostTextPosition();
      };
      
      // Keydown event
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          setElementValue(element, ghostText.textContent || '');
          element.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (e.key === 'Enter' && 
                  !(element.tagName === 'TEXTAREA' && !e.ctrlKey && !e.metaKey)) {
          ghostText.textContent = '';
        }
        
        setTimeout(updateGhostTextPosition, 0);
      };
      
      // Add event listeners
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.addEventListener('input', handleInput);
        element.addEventListener('scroll', handleScroll);
      } else {
        element.addEventListener('input', handleInput);
        element.addEventListener('blur', handleInput);
        element.addEventListener('scroll', handleScroll);
      }
      
      element.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', updateGhostTextPosition);
    }
  };
  
  // Copy styles from source to target element
  const copyStyles = (source: Element, target: HTMLElement) => {
    const parent = source.parentNode as HTMLElement;
    const computedParentStyle = window.getComputedStyle(parent);
    if (computedParentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    
    const computedStyle = window.getComputedStyle(source);
    
    const stylesToCopy = [
      'font-size', 'font-family', 'font-weight', 'letter-spacing',
      'text-align', 'text-indent', 'text-transform',
      'padding-bottom', 'padding-top', 'padding-left', 'padding-right',
      'border-bottom-width', 'border-top-width', 'border-left-width', 'border-right-width',
      'box-sizing', 'line-height', 'width', 'height',
      'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
      'direction', 'writing-mode', 'vertical-align'
    ];
    
    stylesToCopy.forEach(style => {
      target.style[style as any] = computedStyle.getPropertyValue(style);
    });
    
    target.style.position = 'absolute';
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
    
    if (source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement) {
      target.scrollTop = source.scrollTop;
      target.scrollLeft = source.scrollLeft;
    } else if ('scrollTop' in source && 'scrollLeft' in source) {
      target.scrollTop = (source as any).scrollTop;
      target.scrollLeft = (source as any).scrollLeft;
    }
  };
  
  return null;
}

export default FunctionHidden 