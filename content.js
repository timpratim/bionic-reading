// Bionic Reading Content Script
class BionicReader {
  constructor() {
    this.isEnabled = false;
    this.originalTexts = new Map();
    this.boldLetters = 2; // Default number of letters to bold
    this.observer = null;
    this.isPDF = false;
    this.processingTimeout = null;
    this.processedElements = new Set(); // Track processed elements to avoid reprocessing
    this.maxMapSize = 10000; // Limit map size to prevent memory issues
    
    this.init();
  }

  async init() {
    // Check if this is a PDF
    this.isPDF = this.detectPDF();
    
    // Load settings
    await this.loadSettings();
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggle') {
        this.toggle();
        sendResponse({ enabled: this.isEnabled });
      } else if (request.action === 'getStatus') {
        sendResponse({ enabled: this.isEnabled });
      } else if (request.action === 'setBoldLetters') {
        const value = Number(request.value);
        if (!Number.isInteger(value) || value < 1 || value > 10) {
          sendResponse({ success: false, error: 'Invalid boldLetters value' });
          return;
        }
        this.boldLetters = value;
        this.saveSettings();
        if (this.isEnabled) {
          this.reapplyBionic();
        }
        sendResponse({ success: true });
      }
    });

    // Extension always starts disabled on new tabs/pages
    // User must manually enable it each time
  }

  detectPDF() {
    // Check if we're viewing a PDF
    const isPDF = document.contentType === 'application/pdf' || 
           window.location.pathname.toLowerCase().endsWith('.pdf') ||
           document.querySelector('embed[type="application/pdf"]') !== null ||
           document.querySelector('#viewer') !== null || // PDF.js viewer
           document.querySelector('#viewerContainer') !== null ||
           window.location.href.includes('.pdf');
    
    console.log('PDF Detection:', isPDF, {
      contentType: document.contentType,
      pathname: window.location.pathname,
      hasEmbed: !!document.querySelector('embed[type="application/pdf"]'),
      hasViewer: !!document.querySelector('#viewer'),
      hasViewerContainer: !!document.querySelector('#viewerContainer'),
      url: window.location.href
    });
    
    return isPDF;
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['boldLetters']);
      this.isEnabled = false; // Always start disabled on new tabs/pages
      
      // Validate stored boldLetters value
      const storedValue = Number(result.boldLetters);
      if (Number.isInteger(storedValue) && storedValue >= 1 && storedValue <= 10) {
        this.boldLetters = storedValue;
      } else {
        this.boldLetters = 2; // Default fallback
      }
    } catch (error) {
      console.log('Using default settings');
      this.isEnabled = false;
      this.boldLetters = 2;
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        boldLetters: this.boldLetters
      });
    } catch (error) {
      console.log('Could not save settings');
    }
  }

  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  enable() {
    this.isEnabled = true;
    this.saveSettings();
    
    if (this.isPDF) {
      this.handlePDF();
    } else {
      this.processTextNodes();
      this.startObserving();
    }
  }

  disable() {
    this.isEnabled = false;
    this.saveSettings();
    this.restoreOriginalText();
    this.stopObserving();
  }

  reapplyBionic() {
    if (!this.isEnabled) return;
    
    this.restoreOriginalText();
    if (this.isPDF) {
      this.handlePDF();
    } else {
      this.processTextNodes();
    }
  }

  handlePDF() {
    console.log('Handling PDF...');
    
    // Wait for PDF.js to load
    const checkPDFReady = () => {
      const textLayer = document.querySelector('.textLayer');
      const pdfViewer = document.querySelector('#viewer');
      const viewerContainer = document.querySelector('#viewerContainer');
      const pageElements = document.querySelectorAll('[data-page-number]');
      
      console.log('PDF Ready Check:', {
        textLayer: !!textLayer,
        pdfViewer: !!pdfViewer,
        viewerContainer: !!viewerContainer,
        pageElements: pageElements.length
      });
      
      if (textLayer || pdfViewer || viewerContainer || pageElements.length > 0) {
        setTimeout(() => this.processPDFText(), 1000);
      } else {
        // Try again in 500ms, but also try processing any existing text
        this.processAnyVisibleText();
        setTimeout(checkPDFReady, 500);
      }
    };
    
    checkPDFReady();
  }

  processPDFText() {
    console.log('Processing PDF text...');
    
    // Handle PDF.js text layers
    const textLayers = document.querySelectorAll('.textLayer');
    console.log('Found text layers:', textLayers.length);
    
    textLayers.forEach(layer => {
      const textDivs = layer.querySelectorAll('span, div');
      console.log('Found text elements in layer:', textDivs.length);
      
      textDivs.forEach(div => {
        if (div.textContent && div.textContent.trim()) {
          this.processSingleTextNode(div);
        }
      });
    });

    // Also try to find any visible text elements
    this.processAnyVisibleText();

    // Also handle direct PDF embed text if accessible
    const pdfEmbeds = document.querySelectorAll('embed[type="application/pdf"]');
    if (pdfEmbeds.length > 0) {
      // For direct PDF embeds, we need to inject a script
      this.injectPDFScript();
    }
  }

  processAnyVisibleText() {
    console.log('Processing any visible text...');
    
    // Throttle processing to avoid performance issues
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    
    this.processingTimeout = setTimeout(() => {
      // Try to find any text elements that might contain PDF text
      const allTextElements = document.querySelectorAll('span, div, p');
      let processedCount = 0;
      
      // Process in batches to avoid blocking the UI
      const batchSize = 50;
      const elements = Array.from(allTextElements);
      
      const processBatch = (startIndex) => {
        const endIndex = Math.min(startIndex + batchSize, elements.length);
        
        for (let i = startIndex; i < endIndex; i++) {
          const element = elements[i];
          
          if (element.textContent && 
              element.textContent.trim().length > 10 && 
              !element.classList.contains('bionic-processed') &&
              element.offsetParent !== null) { // Element is visible
            
            // Skip if it's likely UI text
            const text = element.textContent.trim();
            if (!text.match(/^(page|zoom|print|download|save|menu|button|\d+)$/i)) {
              this.processSingleTextNode(element);
              processedCount++;
            }
          }
        }
        
        // Continue with next batch if there are more elements
        if (endIndex < elements.length) {
          setTimeout(() => processBatch(endIndex), 10);
        } else {
          console.log('Processed visible text elements:', processedCount);
        }
      };
      
      processBatch(0);
    }, 100);
  }

  async injectPDFScript() {
    try {
      // Get the PDF handler code and execute it in main world
      const pdfHandlerCode = this.getPDFHandlerCode();
      
      await chrome.scripting.executeScript({
        target: { tabId: await this.getCurrentTabId() },
        world: 'MAIN',
        func: pdfHandlerCode
      });
    } catch (error) {
      console.log('Could not inject PDF handler:', error);
    }
  }
  
  async getCurrentTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id;
  }
  
  getPDFHandlerCode() {
    return function() {
      // Defensive snapshots against prototype pollution
      const createElement = document.createElement.bind(document);
      const createTextNode = document.createTextNode.bind(document);
      const createDocumentFragment = document.createDocumentFragment.bind(document);
      const forEach = Array.prototype.forEach.bind(Array.prototype);
      
      function waitForPDFJS() {
        if (window.pdfjsLib || window.PDFViewerApplication) {
          initializePDFHandler();
        } else {
          setTimeout(waitForPDFJS, 100);
        }
      }
      
      function initializePDFHandler() {
        if (window.PDFViewerApplication && window.PDFViewerApplication.eventBus) {
          window.PDFViewerApplication.eventBus.on('textlayerrendered', function(evt) {
            setTimeout(() => {
              processPDFTextLayer(evt.source.textLayerDiv);
            }, 100);
          });
        }
        
        setTimeout(() => {
          const textLayers = document.querySelectorAll('.textLayer');
          forEach.call(textLayers, processPDFTextLayer);
        }, 1000);
      }
      
      function processPDFTextLayer(textLayerDiv) {
        if (!textLayerDiv || textLayerDiv.dataset.bionicProcessed) return;
        
        const spans = textLayerDiv.querySelectorAll('span');
        forEach.call(spans, span => {
          if (span.textContent && span.textContent.trim()) {
            const originalText = span.textContent;
            const bionicFragment = convertToBionic(originalText);
            span.textContent = '';
            span.appendChild(bionicFragment);
          }
        });
        
        textLayerDiv.dataset.bionicProcessed = 'true';
      }
      
      function convertToBionic(text) {
        const parts = text.split(/(\s+)/);
        const fragment = createDocumentFragment();
        
        forEach.call(parts, part => {
          if (/\s/.test(part)) {
            fragment.appendChild(createTextNode(part));
          } else if (/\b\w+\b/.test(part)) {
            const wordElement = createBionicWord(part);
            fragment.appendChild(wordElement);
          } else {
            fragment.appendChild(createTextNode(part));
          }
        });
        
        return fragment;
      }
      
      function createBionicWord(word) {
        if (word.length <= 1) {
          return createTextNode(word);
        }
        
        const boldCount = Math.min(2, Math.ceil(word.length / 2));
        const boldPart = word.substring(0, boldCount);
        const normalPart = word.substring(boldCount);
        
        const wordSpan = createElement('span');
        wordSpan.className = 'bionic-word';
        
        const boldSpan = createElement('span');
        boldSpan.className = 'bionic-bold';
        boldSpan.textContent = boldPart;
        
        const normalSpan = createElement('span');
        normalSpan.className = 'bionic-normal';
        normalSpan.textContent = normalPart;
        
        wordSpan.appendChild(boldSpan);
        wordSpan.appendChild(normalSpan);
        
        return wordSpan;
      }
      
      waitForPDFJS();
    };
  }

  processTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script, style, and other non-visible elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if text is empty or only whitespace
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      this.processTextNode(textNode);
    });
  }

  processTextNode(textNode) {
    // Skip if not a text node or if parent is not suitable
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return;
    }
    
    const parent = textNode.parentElement;
    if (!parent) return;
    
    // Skip script, style, and other non-visible elements
    const tagName = parent.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
      return;
    }
    
    // Skip if text is empty or only whitespace
    const text = textNode.textContent.trim();
    if (!text || text.length < 3) {
      return;
    }
    
    // Check map size limit to prevent memory issues
    if (this.originalTexts.size >= this.maxMapSize) {
      this.cleanupOldEntries();
    }
    
    // Store original text and process
    this.originalTexts.set(textNode, textNode.textContent);
    
    const bionicFragment = this.convertToBionic(text);
    parent.replaceChild(bionicFragment, textNode);
  }

  processSingleTextNode(element) {
    // Skip if already processed or if element is not suitable
    if (element.classList.contains('bionic-processed') || 
        this.processedElements.has(element) ||
        !element.textContent ||
        element.textContent.trim().length < 3) {
      return;
    }
    
    // Check map size limit to prevent memory issues
    if (this.originalTexts.size >= this.maxMapSize) {
      this.cleanupOldEntries();
    }
    
    const originalText = element.textContent;
    this.originalTexts.set(element, originalText);
    this.processedElements.add(element);
    
    // Clear existing content and append bionic fragment
    element.textContent = '';
    const bionicFragment = this.convertToBionic(originalText);
    element.appendChild(bionicFragment);
    element.classList.add('bionic-processed');
  }

  convertToBionic(text) {
    // Split text into words and spaces to preserve formatting
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    
    parts.forEach(part => {
      if (/\s/.test(part)) {
        // Preserve whitespace as text node
        fragment.appendChild(document.createTextNode(part));
      } else if (/\b\w+\b/.test(part)) {
        // Process word
        const wordElement = this.createBionicWord(part);
        fragment.appendChild(wordElement);
      } else {
        // Preserve non-word content as text node
        fragment.appendChild(document.createTextNode(part));
      }
    });
    
    return fragment;
  }
  
  createBionicWord(word) {
    if (word.length <= 1) {
      return document.createTextNode(word);
    }
    
    const boldCount = Math.min(this.boldLetters, Math.ceil(word.length / 2));
    const boldPart = word.substring(0, boldCount);
    const normalPart = word.substring(boldCount);
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'bionic-word';
    
    const boldSpan = document.createElement('span');
    boldSpan.className = 'bionic-bold';
    boldSpan.textContent = boldPart;
    
    const normalSpan = document.createElement('span');
    normalSpan.className = 'bionic-normal';
    normalSpan.textContent = normalPart;
    
    wordSpan.appendChild(boldSpan);
    wordSpan.appendChild(normalSpan);
    
    return wordSpan;
  }

  startObserving() {
    // Throttle mutation processing to improve performance
    let mutationTimeout;
    let processingStartTime = 0;
    let processingBudget = 50; // Max 50ms per second
    let lastSecond = Math.floor(Date.now() / 1000);
    let timeSpentThisSecond = 0;
    
    this.observer = new MutationObserver((mutations) => {
      // Rate limiting check
      const currentSecond = Math.floor(Date.now() / 1000);
      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;
        timeSpentThisSecond = 0;
      }
      
      if (timeSpentThisSecond >= processingBudget) {
        return; // Skip processing if budget exceeded
      }
      
      // Clear previous timeout
      if (mutationTimeout) {
        clearTimeout(mutationTimeout);
      }
      
      // Throttle mutations to avoid excessive processing during scrolling
      mutationTimeout = setTimeout(() => {
        processingStartTime = performance.now();
        const nodesToProcess = [];
        
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              nodesToProcess.push(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              // Collect text nodes from the added element
              const walker = document.createTreeWalker(
                node,
                NodeFilter.SHOW_TEXT,
                null,
                false
              );
              
              let textNode;
              while (textNode = walker.nextNode()) {
                nodesToProcess.push(textNode);
              }
            }
          });
        });
        
        // Process nodes in small batches
        this.processBatchedNodes(nodesToProcess);
        
        // Update time budget tracking
        const processingTime = performance.now() - processingStartTime;
        timeSpentThisSecond += processingTime;
      }, 200); // Wait 200ms before processing mutations
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processBatchedNodes(nodes) {
    const batchSize = 20;
    let currentIndex = 0;
    
    const processBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, nodes.length);
      
      for (let i = currentIndex; i < endIndex; i++) {
        this.processTextNode(nodes[i]);
      }
      
      currentIndex = endIndex;
      
      if (currentIndex < nodes.length) {
        setTimeout(processBatch, 10);
      }
    };
    
    if (nodes.length > 0) {
      processBatch();
    }
  }

  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  cleanupOldEntries() {
    // Remove entries for elements that are no longer in the DOM
    const keysToDelete = [];
    
    for (const [element] of this.originalTexts) {
      if (!document.contains(element)) {
        keysToDelete.push(element);
      }
    }
    
    keysToDelete.forEach(key => {
      this.originalTexts.delete(key);
      this.processedElements.delete(key);
    });
    
    // If still too large, remove oldest entries (first half)
    if (this.originalTexts.size >= this.maxMapSize) {
      const entries = Array.from(this.originalTexts.entries());
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      
      toRemove.forEach(([element]) => {
        this.originalTexts.delete(element);
        this.processedElements.delete(element);
      });
    }
  }

  restoreOriginalText() {
    // Remove all bionic formatting
    const bionicElements = document.querySelectorAll('.bionic-word');
    bionicElements.forEach(element => {
      const parent = element.parentNode;
      const textNode = document.createTextNode(element.textContent);
      parent.replaceChild(textNode, element);
    });

    // Restore PDF elements
    const processedElements = document.querySelectorAll('.bionic-processed');
    processedElements.forEach(element => {
      const originalText = this.originalTexts.get(element);
      if (originalText) {
        element.textContent = originalText;
        element.classList.remove('bionic-processed');
      }
    });

    this.originalTexts.clear();
    this.processedElements.clear();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BionicReader();
  });
} else {
  new BionicReader();
}
