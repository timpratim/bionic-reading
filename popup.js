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
      const result = await chrome.storage.sync.get(['bionicEnabled', 'boldLetters']);
      const enabled = result.bionicEnabled || false;
      const boldLetters = result.boldLetters || 2;
      
      this.toggleSwitch.classList.toggle('active', enabled);
      this.boldSlider.value = boldLetters;
      this.sliderValue.textContent = boldLetters;
    } catch (error) {
      console.log('Could not load settings');
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
    
    const bionicHTML = demoText.replace(/\b\w+\b/g, (word) => {
      if (word.length <= 1) return word;
      
      const boldCount = Math.min(boldLetters, Math.ceil(word.length / 2));
      const boldPart = word.substring(0, boldCount);
      const normalPart = word.substring(boldCount);
      
      return `<span class="bionic-word"><span class="bionic-bold">${boldPart}</span><span class="bionic-normal">${normalPart}</span></span>`;
    });
    
    this.demoText.innerHTML = `<div class="bionic-demo">${bionicHTML}</div>`;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
