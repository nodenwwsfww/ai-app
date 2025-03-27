import cssText from "data-text:./style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"


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
    
    const textareas = document.querySelectorAll("textarea")
    const processed = new WeakSet()
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const textarea = entry.target as HTMLTextAreaElement
        const ghostText = textarea.nextElementSibling as HTMLDivElement
        if (ghostText?.classList.contains('ghost-text')) {
          copyStyles(textarea, ghostText)
        }
      }
    })
    
    textareas.forEach(textarea => {
      if (!processed.has(textarea)) {
        setupTextarea(textarea)
        processed.add(textarea)
        resizeObserver.observe(textarea)
      }
    })
    
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'TEXTAREA') {
              const textarea = node as HTMLTextAreaElement
              if (!processed.has(textarea)) {
                setupTextarea(textarea)
                processed.add(textarea)
                resizeObserver.observe(textarea)
              }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              (node as Element).querySelectorAll('textarea').forEach(textarea => {
                if (!processed.has(textarea)) {
                  setupTextarea(textarea)
                  processed.add(textarea)
                  resizeObserver.observe(textarea)
                }
              })
            }
          })
        }
      })
    })
    
    observer.observe(document.body, { childList: true, subtree: true })
    
    document.addEventListener('click', e => {
      if ((e.target as Element).tagName === 'BUTTON') {
        document.querySelectorAll('.ghost-text').forEach(ghostText => {
          ghostText.textContent = ''
        })
      }
    })
    
    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
    }
  }, [])
  
  const setupTextarea = (textarea: HTMLTextAreaElement) => {
    const ghostText = document.createElement('div')
    ghostText.classList.add('ghost-text')
    
    if (textarea.parentNode) {
      textarea.parentNode.insertBefore(ghostText, textarea.nextSibling)
      copyStyles(textarea, ghostText)
      
      const debouncedGetSuggestion = debounce(async (value: string) => {
        if (value.length === 0) {
          ghostText.textContent = ''
          return
        }
        
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: value,
              url: window.location.href
            })
          })
          
          const { text } = await response.json()
          ghostText.textContent = value + text
        } catch (error) {
          console.error(error)
          ghostText.textContent = value
        }
      }, 500)
      
      textarea.addEventListener('input', () => {
        const value = textarea.value
        if (value.length === 0) {
          ghostText.textContent = ''
        } else {
          ghostText.textContent = value
          debouncedGetSuggestion(value)
        }
      })
      
      textarea.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault()
          textarea.value = ghostText.textContent || ''
        } else if (e.key === 'Enter') {
          ghostText.textContent = ''
        }
      })
    }
  }
  
  const copyStyles = (source: HTMLElement, target: HTMLElement) => {
    const parent = source.parentNode as HTMLElement
    parent.style.position = 'relative'
    
    const computedStyle = window.getComputedStyle(source)
    const stylesToCopy = [
      'font-size', 'font-family', 'text-align',
      'padding-bottom', 'padding-top', 'padding-left', 'padding-right',
      'border-bottom-width', 'border-top-width', 'border-left-width', 'border-right-width',
      'box-sizing', 'line-height', 'width', 'height'
    ]
    
    stylesToCopy.forEach(style => {
      target.style[style as any] = computedStyle.getPropertyValue(style)
    })
    
    target.style.position = 'absolute'
    target.style.top = '0'
    target.style.left = '0'
    target.style.right = '0'
    target.style.bottom = '0'
    target.style.pointerEvents = 'none'
    target.style.zIndex = '1'
    target.style.color = 'rgba(204, 204, 204, 0.7)'
    target.style.background = 'none'
    target.style.overflow = 'hidden'
    target.style.whiteSpace = 'pre-wrap'
    target.style.wordWrap = 'break-word'
    target.style.borderColor = 'transparent'
    target.style.borderStyle = 'solid'
  }
  
  return null
}

export default PlasmoOverlay 