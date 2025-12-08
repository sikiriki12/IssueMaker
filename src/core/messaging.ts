import type { ExtensionMessage, MessageResponse } from '@/types';

/**
 * Send a message to the background service worker
 */
export function sendMessage<T = unknown, R = unknown>(
    message: ExtensionMessage<T>
): Promise<MessageResponse<R>> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response: MessageResponse<R>) => {
            if (chrome.runtime.lastError) {
                resolve({
                    success: false,
                    error: chrome.runtime.lastError.message || 'Unknown error',
                });
            } else {
                resolve(response || { success: false, error: 'No response' });
            }
        });
    });
}

/**
 * Send a message to a content script in a specific tab
 */
export function sendTabMessage<T = unknown, R = unknown>(
    tabId: number,
    message: ExtensionMessage<T>
): Promise<MessageResponse<R>> {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response: MessageResponse<R>) => {
            if (chrome.runtime.lastError) {
                resolve({
                    success: false,
                    error: chrome.runtime.lastError.message || 'Unknown error',
                });
            } else {
                resolve(response || { success: false, error: 'No response' });
            }
        });
    });
}
