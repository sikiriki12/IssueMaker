/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Format a timestamp as ISO string
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

/**
 * Parse owner/repo string into components
 */
export function parseRepoString(repo: string): { owner: string; repo: string } | null {
    const parts = repo.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return null;
    }
    return { owner: parts[0], repo: parts[1] };
}

/**
 * Safely stringify any value for logging
 */
export function safeStringify(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
