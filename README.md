# IssueMaker 🐛

A Chrome extension that makes it incredibly easy to create high-quality GitHub issues from any web app you're testing. Features AI-powered issue generation, screenshot annotations, and automatic context capture.

## Features

- 📸 **Screenshot Capture** - Capture the current tab with one click
- ✏️ **Annotation Tools** - Draw arrows, rectangles, add text, and blur sensitive areas
- 🔍 **Context Capture** - Automatically collects console logs, network errors, and environment info
- 🤖 **AI-Powered Drafting** - Uses Gemini 2.5 Pro to generate well-structured issue titles and bodies
- 🏷️ **Labels & Metadata** - Select labels from your repo and categorize issues
- 📝 **Review & Edit** - Preview, edit, and refine before creating

## Installation

### Prerequisites

- Node.js 18+ and npm
- A GitHub Personal Access Token with `repo` scope
- A Gemini API key from Google AI Studio

### Build from Source

1. Clone the repository:
   ```bash
   cd IssueMaker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `IssueMaker` directory (the root folder containing `manifest.json`)

### Configuration

1. Click the extension icon and then "Open Settings" (or right-click the icon → Options)
2. Enter your **GitHub Personal Access Token**
   - Create one at [github.com/settings/tokens](https://github.com/settings/tokens)
   - Required scope: `repo`
3. Enter your **Default Repository** in `owner/repo` format
4. Enter your **Gemini API Key**
   - Get one at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
5. Optionally set default labels
6. Click "Save Settings"

## Usage

1. Navigate to any web page where you've found a bug or have a feature idea
2. Click the IssueMaker extension icon
3. Click "New Issue from This Page"
4. The editor will open with:
   - A screenshot of the page on the left
   - An issue form on the right
5. **Annotate the screenshot** (optional):
   - Use arrows, rectangles, text, or blur tools
   - Choose colors from the palette
6. **Fill in the issue details**:
   - Select issue type (Bug/Feature/Other)
   - Add a title and description
   - For bugs: add steps to reproduce, expected vs actual behavior
   - Toggle which context to include
7. Click **"Generate with AI"**
8. **Review the generated issue**:
   - Edit title and body as needed
   - Toggle between Edit and Preview modes
   - Adjust labels
9. Click **"Create GitHub Issue"**
10. 🎉 View your new issue on GitHub!

## Development

```bash
# Install dependencies
npm install

# Build with watch mode (auto-rebuild on changes)
npm run dev

# Type check
npm run typecheck
```

After making changes, click the refresh icon on `chrome://extensions` to reload the extension.

## Project Structure

```
IssueMaker/
├── manifest.json          # Chrome extension manifest
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Build configuration
├── src/
│   ├── types/             # TypeScript interfaces
│   ├── core/              # Shared utilities
│   ├── background/        # Service worker (API integrations)
│   ├── content/           # Content script (context capture)
│   ├── popup/             # Extension popup UI
│   ├── options/           # Settings page
│   └── editor/            # Main editor UI
└── icons/                 # Extension icons
```

## Tech Stack

- **Manifest V3** - Latest Chrome extension format
- **TypeScript** - Type-safe development
- **React** - UI components
- **Vite** - Fast builds
- **Gemini 2.5 Pro** - AI-powered issue generation
- **GitHub REST API** - Issue creation

## License

MIT
