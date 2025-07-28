# Bionic Reading Chrome Extension

A Chrome extension that converts any webpage or PDF text to Bionic Reading format for improved reading speed and comprehension.

## Features

- ✅ **Webpage Support**: Works on any website
- ✅ **PDF Support**: Converts hosted PDFs (like https://nlp.stanford.edu/IR-book/pdf/01bool.pdf)
- ✅ **Customizable**: Adjust number of bold letters per word (1-4)
- ✅ **Toggle On/Off**: Easy enable/disable via popup
- ✅ **Dynamic Content**: Handles SPAs and dynamically loaded content
- ✅ **Preserves Formatting**: Maintains links, layout, and text selection

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this folder
4. The extension icon will appear in your toolbar

## Usage

1. Navigate to any webpage or PDF
2. Click the Bionic Reading extension icon
3. Toggle "Enable Bionic Reading" to ON
4. Adjust the "Bold Letters per Word" slider as needed
5. The page text will be converted to Bionic Reading format

## How It Works

Bionic Reading emphasizes the first few letters of each word by making them bold. This creates "fixation points" that help guide eye movement and potentially improve reading speed while maintaining comprehension.

## Technical Details

- **Manifest V3**: Uses the latest Chrome extension API
- **Content Scripts**: Processes DOM text nodes in real-time
- **PDF.js Integration**: Handles PDF text layers for hosted PDFs
- **MutationObserver**: Monitors dynamic content changes
- **Storage API**: Saves user preferences

## Supported Content

- Regular webpages (HTML)
- Single Page Applications (SPAs)
- Hosted PDFs viewed in browser
- Dynamic content loaded via JavaScript

## Settings

- **Bold Letters**: Choose 1-4 letters to bold per word
- **Auto-enable**: Extension remembers your preference per session

## Privacy

This extension:
- Only processes text on pages you visit
- Does not send any data to external servers
- Stores preferences locally in Chrome
- Works entirely offline

## Development

The extension consists of:
- `manifest.json`: Extension configuration
- `content.js`: Main text processing logic
- `pdf-handler.js`: PDF-specific text handling
- `popup.html/js`: User interface
- `bionic.css`: Styling for bionic text

## License

MIT License - Feel free to modify and distribute.
