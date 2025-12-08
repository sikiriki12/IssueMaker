import type { NetworkError } from '@/types';
import { MAX_NETWORK_ERRORS } from '@/core/constants';

const networkErrors: NetworkError[] = [];

// Store original methods to avoid infinite loops
const originalFetch = window.fetch.bind(window);
const OriginalXHR = window.XMLHttpRequest;

/**
 * Patch fetch and XMLHttpRequest to capture network errors
 */
export function captureNetworkErrors(): void {
    // Patch fetch
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method || 'GET';

        try {
            const response = await originalFetch(input, init);

            // Capture 4xx and 5xx responses
            if (response.status >= 400) {
                addNetworkError({
                    url,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    timestamp: Date.now(),
                });
            }

            return response;
        } catch (error) {
            addNetworkError({
                url,
                method,
                errorMessage: error instanceof Error ? error.message : 'Network request failed',
                timestamp: Date.now(),
            });
            throw error;
        }
    };

    // Patch XMLHttpRequest
    class PatchedXHR extends OriginalXHR {
        private _method: string = 'GET';
        private _url: string = '';

        open(method: string, url: string | URL, async: boolean = true, username?: string | null, password?: string | null): void {
            this._method = method;
            this._url = typeof url === 'string' ? url : url.href;
            super.open(method, url, async, username ?? null, password ?? null);
        }

        send(body?: Document | XMLHttpRequestBodyInit | null): void {
            this.addEventListener('loadend', () => {
                if (this.status >= 400 || this.status === 0) {
                    addNetworkError({
                        url: this._url,
                        method: this._method,
                        status: this.status || undefined,
                        statusText: this.statusText || undefined,
                        errorMessage: this.status === 0 ? 'Network request failed' : undefined,
                        timestamp: Date.now(),
                    });
                }
            });
            super.send(body);
        }
    }

    window.XMLHttpRequest = PatchedXHR as typeof XMLHttpRequest;
}

/**
 * Add a network error to the buffer
 */
function addNetworkError(error: NetworkError): void {
    // Don't capture errors for extension URLs
    if (error.url.startsWith('chrome-extension://')) {
        return;
    }

    networkErrors.push(error);

    // Keep only the most recent errors
    while (networkErrors.length > MAX_NETWORK_ERRORS) {
        networkErrors.shift();
    }
}

/**
 * Get captured network errors
 */
export function getNetworkErrors(): NetworkError[] {
    return [...networkErrors];
}

/**
 * Clear captured network errors
 */
export function clearNetworkErrors(): void {
    networkErrors.length = 0;
}
