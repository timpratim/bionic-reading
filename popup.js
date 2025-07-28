// Popup Script for Bionic Reading Extension
class PopupController {
  constructor() {
    this.toggleSwitch = document.getElementById('toggleSwitch');
    this.status = document.getElementById('status');
    this.boldSlider = document.getElementById('boldSlider');
    this.sliderValue = document.getElementById('sliderValue');
    this.demoText = document.getElementById('demoText');
    
    this.init();
  }
  
  async init() {
    // Load current settings
    await this.loadSettings();
    
    // Set up event listeners
    this.toggleSwitch.addEventListener('click', () => this.toggleBionic());
    this.boldSlider.addEventListener('input', (e) => this.updateBoldLetters(e.target.value));
    
    // Get current tab status
    await this.updateStatus();
    
    // Update demo text
    this.updateDemo();
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['boldLetters']);
      const boldLetters = result.boldLetters || 2;
      
      // Extension always starts disabled, so don't set toggle as active
      this.toggleSwitch.classList.remove('active');
      this.boldSlider.value = boldLetters;
      this.sliderValue.textContent = boldLetters;
    } catch (error) {
      console.log('Could not load settings');
      this.toggleSwitch.classList.remove('active');
      this.boldSlider.value = 2;
      this.sliderValue.textContent = '2';
    }
  }
  
  async updateStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      
      if (response && response.enabled) {
        this.status.textContent = 'Bionic Reading is ON';
        this.status.className = 'status enabled';
        this.toggleSwitch.classList.add('active');
      } else {
        this.status.textContent = 'Bionic Reading is OFF';
        this.status.className = 'status disabled';
        this.toggleSwitch.classList.remove('active');
      }
    } catch (error) {
      this.status.textContent = 'Ready to activate';
      this.status.className = 'status disabled';
    }
  }
  
  async toggleBionic() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      
      if (response) {
        this.toggleSwitch.classList.toggle('active', response.enabled);
        
        if (response.enabled) {
          this.status.textContent = 'Bionic Reading is ON';
          this.status.className = 'status enabled';
        } else {
          this.status.textContent = 'Bionic Reading is OFF';
          this.status.className = 'status disabled';
        }
      }
    } catch (error) {
      console.log('Could not toggle bionic reading:', error);
      this.status.textContent = 'Error: Please refresh the page';
      this.status.className = 'status disabled';
    }
  }
  
  async updateBoldLetters(value) {
    this.sliderValue.textContent = value;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'setBoldLetters', 
        value: parseInt(value) 
      });
      
      this.updateDemo();
    } catch (error) {
      console.log('Could not update bold letters setting');
    }
  }
  
  updateDemo() {
    const boldLetters = parseInt(this.boldSlider.value);
    const demoText = "Preview: This is how your text will look with Bionic Reading enabled.";
    
    // Create demo container
    const demoContainer = document.createElement('div');
    demoContainer.className = 'bionic-demo';
    
    // Process text safely
    const bionicFragment = this.convertToBionic(demoText, boldLetters);
    demoContainer.appendChild(bionicFragment);
    
    // Clear and update demo
    this.demoText.textContent = '';
    this.demoText.appendChild(demoContainer);
  }
  
  convertToBionic(text, boldLetters) {
    // Split text into words and spaces to preserve formatting
    const parts = text.split(/(\s+)/);
    const fragment = document.createDocumentFragment();
    
    parts.forEach(part => {
      if (/\s/.test(part)) {
        // Preserve whitespace as text node
        fragment.appendChild(document.createTextNode(part));
      } else if (/\b\w+\b/.test(part)) {
        // Process word
        const wordElement = this.createBionicWord(part, boldLetters);
        fragment.appendChild(wordElement);
      } else {
        // Preserve non-word content as text node
        fragment.appendChild(document.createTextNode(part));
      }
    });
    
    return fragment;
  }
  
  createBionicWord(word, boldLetters) {
    if (word.length <= 1) {
      return document.createTextNode(word);
    }
    
    const boldCount = Math.min(boldLetters, Math.ceil(word.length / 2));
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
