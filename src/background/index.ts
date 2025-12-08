import { handleMessage } from './handlers';

// Listen for messages from popup, editor, and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
            console.error('[IssueMaker] Message handling error:', error);
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        });

    // Return true to indicate we'll call sendResponse asynchronously
    return true;
});

// Shared function to capture screenshot and open editor
async function captureAndOpenEditor(tab: chrome.tabs.Tab) {
    if (!tab.id || !tab.windowId) {
        console.error('[IssueMaker] No tab ID or window ID');
        return;
    }

    try {
        // Capture screenshot - pass the windowId in the payload
        const screenshotResponse = await handleMessage(
            { type: 'CAPTURE_SCREENSHOT_NOW', payload: { windowId: tab.windowId } },
            { tab } as chrome.runtime.MessageSender
        );

        if (!screenshotResponse.success) {
            console.error('[IssueMaker] Screenshot capture failed:', screenshotResponse.error);
            return;
        }

        // Try to get context from content script
        let contextData = null;
        try {
            contextData = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
            console.log('[IssueMaker] Context received from content script:', {
                success: contextData?.success,
                hasLogs: contextData?.data?.consoleLogs?.length || 0,
                hasErrors: contextData?.data?.networkErrors?.length || 0
            });
        } catch (err) {
            // Content script not available, will use fallback
            console.warn('[IssueMaker] Could not get context from content script:', err);
        }

        // Build context from tab info as fallback
        const finalContext = contextData?.success ? contextData.data : {
            environment: {
                url: tab.url || 'Unknown',
                pageTitle: tab.title || 'Unknown',
                userAgent: navigator.userAgent,
                viewportWidth: tab.width || 0,
                viewportHeight: tab.height || 0,
                timestamp: Date.now()
            },
            consoleLogs: [],
            networkErrors: []
        };

        console.log('[IssueMaker] Final context to store:', {
            hasLogs: finalContext.consoleLogs?.length || 0,
            hasErrors: finalContext.networkErrors?.length || 0,
            env: finalContext.environment?.url
        });

        // Store screenshot and context, then open editor
        await chrome.storage.session.set({
            issuemaker_pending_screenshot: screenshotResponse.data,
            issuemaker_pending_tab_id: tab.id,
            issuemaker_pending_context: finalContext
        });

        chrome.tabs.create({
            url: chrome.runtime.getURL(`dist/src/editor/index.html?tabId=${tab.id}`),
        });
    } catch (error) {
        console.error('[IssueMaker] Failed to capture and open editor:', error);
    }
}

// Handle extension install or update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Open options page on first install
        chrome.runtime.openOptionsPage();
    }

    // Create context menu on install/update
    createContextMenu();
});

// Also create context menu when service worker starts (in case it was killed)
createContextMenu();

// Function to create context menu (handles already existing case)
function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'issuemaker-report',
            title: 'Report Issue with IssueMaker',
            contexts: ['page', 'selection', 'image', 'link']
        });
    });
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'issuemaker-report' && tab) {
        await captureAndOpenEditor(tab);
    }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'report-issue') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await captureAndOpenEditor(tab);
        }
    }
});

// Handle extension icon click when popup is disabled (fallback)
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
        await captureAndOpenEditor(tab);
    }
});

