# Chrome Web Store - Privacy Practices & Requirements

## Single Purpose Description
IssueMaker helps developers create well-structured GitHub issues by capturing screenshots, annotating them, and using AI to generate professional issue content.

---

## Permission Justifications

### activeTab
**Justification:** Required to capture screenshots of the currently active tab when the user triggers IssueMaker via the toolbar button, right-click menu, or keyboard shortcut. The extension only accesses the active tab when explicitly activated by the user.

### contextMenus
**Justification:** Used to add a "Report Issue with IssueMaker" option to the browser's right-click context menu, allowing users to quickly start creating an issue from any webpage without opening the popup.

### host permission (all_urls)
**Justification:** Required to capture screenshots from any webpage the user is viewing and to inject the content script that captures page context (URL, console logs, network errors) for issue creation. Also needed to communicate with GitHub API (api.github.com) and Google Gemini API (generativelanguage.googleapis.com) using the user's own API keys.

### scripting
**Justification:** Used to inject content scripts that capture page context information (URL, viewport size, console logs, network errors) which is included in the generated GitHub issue to help developers reproduce bugs.

### storage
**Justification:** Used to store user settings locally in the browser, including GitHub Personal Access Token and Gemini API key. Also used for storing issue drafts temporarily. All data is stored locally and never transmitted to third-party servers.

### tabs
**Justification:** Required to get information about the current tab (URL, title, window ID) for screenshot capture and to include page context in generated issues. Also used to open the issue editor in a new tab.

### Remote Code
**Justification:** This extension does NOT use remote code. All JavaScript is bundled locally. The extension makes API calls to:
1. GitHub API (api.github.com) - Using user's own Personal Access Token to create issues
2. Google Gemini API (generativelanguage.googleapis.com) - Using user's own API key for AI-powered issue drafting

These are standard REST API calls, not remote code execution.

---

## Data Usage Certification

### Data Collection
- **API Keys**: GitHub PAT and Gemini API key stored locally in browser storage
- **Page Context**: URL, title, viewport size, console logs, network errors (only when user triggers the extension)
- **Screenshots**: Captured only when user initiates, stored temporarily in session storage

### Data Transmission
- Data is ONLY sent to:
  - User's own GitHub account (via their PAT)
  - Google Gemini API (via their API key)
- NO data is sent to third-party analytics or tracking services
- NO data is sold or shared with third parties

### Data Retention
- API keys persist in local storage until user removes them
- Issue drafts and screenshots stored in session storage (cleared when browser closes)
- No server-side data retention

---

## Category
**Developer Tools**

## Language
**English**

---

## Contact Email
(Enter your email address on the Account tab)
