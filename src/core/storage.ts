import type { ExtensionSettings, IssueDraft } from '@/types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';

/**
 * Get extension settings from Chrome storage
 */
export async function getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

/**
 * Save extension settings to Chrome storage
 */
export async function saveSettings(settings: ExtensionSettings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

/**
 * Get current draft from session storage
 */
export async function getDraft(): Promise<IssueDraft | null> {
    const result = await chrome.storage.session.get(STORAGE_KEYS.DRAFT);
    return result[STORAGE_KEYS.DRAFT] || null;
}

/**
 * Save draft to session storage
 */
export async function saveDraft(draft: IssueDraft): Promise<void> {
    await chrome.storage.session.set({ [STORAGE_KEYS.DRAFT]: draft });
}

/**
 * Clear the current draft from session storage
 */
export async function clearDraft(): Promise<void> {
    await chrome.storage.session.remove(STORAGE_KEYS.DRAFT);
}
