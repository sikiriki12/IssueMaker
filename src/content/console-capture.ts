import type { ConsoleEntry } from '@/types';
import { MAX_CONSOLE_LOGS } from '@/core/constants';

const logs: ConsoleEntry[] = [];

/**
 * Set up listener for console events from the page script running in MAIN world.
 * The page-script.ts file runs in the page's execution context and sends events here.
 */
export function captureConsoleLogs(): void {
    // Listen for console events from the page script (running in MAIN world)
    window.addEventListener('__issuemaker_console__', ((event: CustomEvent) => {
        const { level, message, stack, timestamp } = event.detail;
        addLog(level, message, stack, timestamp);
    }) as EventListener);
}

/**
 * Add a log entry to the buffer
 */
function addLog(level: ConsoleEntry['level'], message: string, stack?: string, timestamp?: number): void {
    // Limit message length
    const truncatedMessage = message.length > 2000 ? message.slice(0, 2000) + '...' : message;

    logs.push({
        level,
        message: truncatedMessage,
        timestamp: timestamp || Date.now(),
        stack: stack?.slice(0, 1000),
    });

    // Keep only the most recent logs
    while (logs.length > MAX_CONSOLE_LOGS) {
        logs.shift();
    }
}

/**
 * Get captured console logs
 */
export function getConsoleLogs(): ConsoleEntry[] {
    return [...logs];
}

/**
 * Clear captured logs
 */
export function clearConsoleLogs(): void {
    logs.length = 0;
}
