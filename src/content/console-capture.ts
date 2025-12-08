import type { ConsoleEntry } from '@/types';
import { MAX_CONSOLE_LOGS } from '@/core/constants';

const logs: ConsoleEntry[] = [];

/**
 * Patch console methods to capture logs
 */
export function captureConsoleLogs(): void {
    const originalConsole = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
    };

    const createWrapper = (level: ConsoleEntry['level']) => {
        return (...args: unknown[]) => {
            addLog(level, args);
            originalConsole[level](...args);
        };
    };

    console.log = createWrapper('log');
    console.warn = createWrapper('warn');
    console.error = createWrapper('error');
    console.info = createWrapper('info');
    console.debug = createWrapper('debug');

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
        addLog('error', [event.message], event.error?.stack);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason instanceof Error
            ? event.reason.message
            : String(event.reason);
        addLog('error', [`Unhandled Promise Rejection: ${reason}`],
            event.reason instanceof Error ? event.reason.stack : undefined);
    });
}

/**
 * Add a log entry to the buffer
 */
function addLog(level: ConsoleEntry['level'], args: unknown[], stack?: string): void {
    const message = args
        .map((arg) => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
            try {
                return JSON.stringify(arg);
            } catch {
                return String(arg);
            }
        })
        .join(' ');

    // Limit message length
    const truncatedMessage = message.length > 2000 ? message.slice(0, 2000) + '...' : message;

    logs.push({
        level,
        message: truncatedMessage,
        timestamp: Date.now(),
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
