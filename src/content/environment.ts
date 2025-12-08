import type { EnvironmentInfo } from '@/types';

/**
 * Collect current environment information
 */
export function getEnvironmentInfo(): EnvironmentInfo {
    return {
        url: window.location.href,
        pageTitle: document.title,
        userAgent: navigator.userAgent,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        timestamp: Date.now(),
    };
}
