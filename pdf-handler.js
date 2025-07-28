// PDF Handler for direct PDF embeds
(function() {
  'use strict';
  
  // This script handles PDFs that are directly embedded
  // It works by intercepting PDF.js text rendering
  
  function waitForPDFJS() {
    if (window.pdfjsLib || window.PDFViewerApplication) {
      initializePDFHandler();
    } else {
      setTimeout(waitForPDFJS, 100);
    }
  }
  
  function initializePDFHandler() {
    // Hook into PDF.js text layer rendering
    if (window.PDFViewerApplication && window.PDFViewerApplication.eventBus) {
      window.PDFViewerApplication.eventBus.on('textlayerrendered', function(evt) {
        setTimeout(() => {
          processPDFTextLayer(evt.source.textLayerDiv);
        }, 100);
      });
    }
    
    // Also check for existing text layers
    setTimeout(() => {
      const textLayers = document.querySelectorAll('.textLayer');
      textLayers.forEach(processPDFTextLayer);
    }, 1000);
  }
  
  function processPDFTextLayer(textLayerDiv) {
    if (!textLayerDiv || textLayerDiv.dataset.bionicProcessed) return;
    
    const spans = textLayerDiv.querySelectorAll('span');
    spans.forEach(span => {
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
    // Split text into words and spaces to preserve formatting
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    
    parts.forEach(part => {
      if (/\s/.test(part)) {
        // Preserve whitespace as text node
        fragment.appendChild(document.createTextNode(part));
      } else if (/\b\w+\b/.test(part)) {
        // Process word
        const wordElement = createBionicWord(part);
        fragment.appendChild(wordElement);
      } else {
        // Preserve non-word content as text node
        fragment.appendChild(document.createTextNode(part));
      }
    });
    
    return fragment;
  }
  
  function createBionicWord(word) {
    if (word.length <= 1) {
      return document.createTextNode(word);
    }
    
    const boldCount = Math.min(2, Math.ceil(word.length / 2));
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
  
  // Start the process
  waitForPDFJS();
})();
