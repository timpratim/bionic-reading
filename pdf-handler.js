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
        span.innerHTML = convertToBionic(originalText);
      }
    });
    
    textLayerDiv.dataset.bionicProcessed = 'true';
  }
  
  function convertToBionic(text) {
    return text.replace(/\b\w+\b/g, (word) => {
      if (word.length <= 1) return word;
      
      const boldCount = Math.min(2, Math.ceil(word.length / 2));
      const boldPart = word.substring(0, boldCount);
      const normalPart = word.substring(boldCount);
      
      return `<span class="bionic-word"><span class="bionic-bold">${boldPart}</span><span class="bionic-normal">${normalPart}</span></span>`;
    });
  }
  
  // Start the process
  waitForPDFJS();
})();
