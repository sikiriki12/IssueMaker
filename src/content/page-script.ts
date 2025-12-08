// This script runs in the MAIN world (page context), not the isolated content script world.
// It patches console methods and sends captured logs to the content script via custom events.

(function () {
    const originalConsole = {
        log: console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console),
    };

    const createWrapper = (level: string) => {
        return (...args: unknown[]) => {
            // Send log to content script via custom event
            const message = args.map(arg => {
                if (typeof arg === 'string') return arg;
                if (arg instanceof Error) return arg.name + ': ' + arg.message;
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }).join(' ');

            const stack = (level === 'error' && args[0] instanceof Error)
                ? (args[0] as Error).stack
                : undefined;

            window.dispatchEvent(new CustomEvent('__issuemaker_console__', {
                detail: { level, message, stack, timestamp: Date.now() }
            }));

            // Call original console method
            (originalConsole as Record<string, (...args: unknown[]) => void>)[level](...args);
        };
    };

    console.log = createWrapper('log');
    console.warn = createWrapper('warn');
    console.error = createWrapper('error');
    console.info = createWrapper('info');
    console.debug = createWrapper('debug');

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
        window.dispatchEvent(new CustomEvent('__issuemaker_console__', {
            detail: {
                level: 'error',
                message: event.message,
                stack: event.error?.stack,
                timestamp: Date.now()
            }
        }));
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason instanceof Error
            ? event.reason.message
            : String(event.reason);
        window.dispatchEvent(new CustomEvent('__issuemaker_console__', {
            detail: {
                level: 'error',
                message: 'Unhandled Promise Rejection: ' + reason,
                stack: event.reason instanceof Error ? event.reason.stack : undefined,
                timestamp: Date.now()
            }
        }));
    });
})();
