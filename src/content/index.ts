import { captureConsoleLogs, getConsoleLogs } from './console-capture';
import { captureNetworkErrors, getNetworkErrors } from './network-capture';
import { getEnvironmentInfo } from './environment';
import type { IssueContext, ExtensionMessage, MessageResponse } from '@/types';

// Initialize captures immediately when script loads
captureConsoleLogs();
captureNetworkErrors();

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener(
    (
        message: ExtensionMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: MessageResponse) => void
    ) => {
        if (message.type === 'GET_PAGE_CONTEXT') {
            const context: IssueContext = {
                environment: getEnvironmentInfo(),
                consoleLogs: getConsoleLogs(),
                networkErrors: getNetworkErrors(),
            };
            sendResponse({ success: true, data: context });
            return true;
        }
        return false;
    }
);
