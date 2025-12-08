import type { ExtensionSettings } from '@/types';

// Storage keys
export const STORAGE_KEYS = {
    SETTINGS: 'issuemaker_settings',
    DRAFT: 'issuemaker_draft',
} as const;

// API endpoints
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';
export const GITHUB_API_URL = 'https://api.github.com';

// Limits
export const MAX_CONSOLE_LOGS = 100;
export const MAX_NETWORK_ERRORS = 50;
export const MAX_MESSAGE_LENGTH = 2000;

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
    geminiApiKey: '',
    githubToken: '',
};

// Colors for annotations
export const ANNOTATION_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
] as const;
