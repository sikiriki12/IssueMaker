import type {
    ExtensionMessage,
    MessageResponse,
    IssueDraft,
    ExtensionSettings,
    CreateIssueParams,
    Attachment,
} from '@/types';
import { getSettings, saveSettings, getDraft, saveDraft, clearDraft } from '@/core/storage';

import { generateIssue } from './gemini';
import { getRepoLabels, createIssue, uploadImageToRepo, fetchUserRepos } from './github';

/**
 * Handle incoming messages from popup, editor, and content scripts
 */
export async function handleMessage(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
    try {
        switch (message.type) {
            case 'GET_SETTINGS':
                return handleGetSettings();

            case 'SAVE_SETTINGS':
                return handleSaveSettings(message.payload as ExtensionSettings);

            case 'CAPTURE_SCREENSHOT':
                return handleCaptureScreenshot(message.payload as { tabId: number });

            case 'CAPTURE_SCREENSHOT_NOW':
                return handleCaptureScreenshotNow(message.payload as { windowId: number });

            case 'GENERATE_ISSUE':
                return handleGenerateIssue(message.payload as IssueDraft);

            case 'CREATE_GITHUB_ISSUE':
                return handleCreateGitHubIssue(message.payload as CreateIssueParams);

            case 'CREATE_GITHUB_ISSUE_WITH_IMAGES':
                return handleCreateGitHubIssueWithImages(
                    message.payload as CreateIssueParams & { attachments: Attachment[] }
                );

            case 'GET_REPO_LABELS':
                return handleGetRepoLabels(message.payload as { owner: string; repo: string });

            case 'GET_USER_REPOS':
                return handleGetUserRepos();

            case 'SAVE_DRAFT':
                return handleSaveDraft(message.payload as IssueDraft);

            case 'GET_DRAFT':
                return handleGetDraft();

            case 'CLEAR_DRAFT':
                return handleClearDraft();

            default:
                return { success: false, error: `Unknown message type: ${message.type}` };
        }
    } catch (error) {
        console.error('[IssueMaker] Handler error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
}

async function handleGetSettings(): Promise<MessageResponse<ExtensionSettings>> {
    const settings = await getSettings();
    return { success: true, data: settings };
}

async function handleSaveSettings(settings: ExtensionSettings): Promise<MessageResponse> {
    await saveSettings(settings);
    return { success: true };
}

async function handleCaptureScreenshot(
    payload: { tabId: number }
): Promise<MessageResponse<string>> {
    try {
        // Get the tab's window to make sure we capture the right one
        const tab = await chrome.tabs.get(payload.tabId);
        if (!tab.windowId) {
            throw new Error('Cannot determine window for tab');
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'png',
        });

        return { success: true, data: dataUrl };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Screenshot capture failed',
        };
    }
}

async function handleCaptureScreenshotNow(
    payload: { windowId: number }
): Promise<MessageResponse<string>> {
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(payload.windowId, {
            format: 'png',
        });

        return { success: true, data: dataUrl };
    } catch (error) {
        console.error('[IssueMaker] Screenshot capture error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Screenshot capture failed',
        };
    }
}

async function handleGenerateIssue(draft: IssueDraft): Promise<MessageResponse> {
    const settings = await getSettings();

    if (!settings.geminiApiKey) {
        return { success: false, error: 'Gemini API key not configured' };
    }

    const aiDraft = await generateIssue(draft, settings.geminiApiKey);
    return { success: true, data: aiDraft };
}

async function handleCreateGitHubIssue(params: CreateIssueParams): Promise<MessageResponse> {
    const settings = await getSettings();

    if (!settings.githubToken) {
        return { success: false, error: 'GitHub token not configured' };
    }

    const createdIssue = await createIssue(params, settings.githubToken);
    return { success: true, data: createdIssue };
}

async function handleCreateGitHubIssueWithImages(
    params: CreateIssueParams & { attachments: Attachment[] }
): Promise<MessageResponse> {
    const settings = await getSettings();

    if (!settings.githubToken) {
        return { success: false, error: 'GitHub token not configured' };
    }

    const { owner, repo, title, labels, assignees, attachments } = params;
    let { body } = params;

    // Upload each image and collect URLs
    const imageUrls: string[] = [];
    for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        if (!attachment.dataUrl) continue;

        try {
            const url = await uploadImageToRepo(
                owner,
                repo,
                settings.githubToken,
                attachment.dataUrl,
                attachment.filename
            );
            imageUrls.push(url);
        } catch (error) {
            console.error(`[IssueMaker] Failed to upload image ${attachment.filename}:`, error);
            // Continue with other images even if one fails
        }
    }

    // Append image markdown to the issue body
    if (imageUrls.length > 0) {
        body += '\n\n## Screenshots\n\n';
        imageUrls.forEach((url, index) => {
            const label = attachments[index]?.type === 'screenshot' ? 'Screenshot' : 'Image';
            body += `![${label} ${index + 1}](${url})\n\n`;
        });
    }

    // Create the issue with the updated body
    const createdIssue = await createIssue(
        { owner, repo, title, body, labels, assignees },
        settings.githubToken
    );

    return { success: true, data: createdIssue };
}

async function handleGetRepoLabels(
    payload: { owner: string; repo: string }
): Promise<MessageResponse> {
    const settings = await getSettings();

    if (!settings.githubToken) {
        return { success: false, error: 'GitHub token not configured' };
    }

    const labels = await getRepoLabels(payload.owner, payload.repo, settings.githubToken);
    return { success: true, data: labels };
}

async function handleSaveDraft(draft: IssueDraft): Promise<MessageResponse> {
    await saveDraft(draft);
    return { success: true };
}

async function handleGetDraft(): Promise<MessageResponse<IssueDraft | null>> {
    const draft = await getDraft();
    return { success: true, data: draft };
}

async function handleClearDraft(): Promise<MessageResponse> {
    await clearDraft();
    return { success: true };
}

async function handleGetUserRepos(): Promise<MessageResponse<string[]>> {
    const settings = await getSettings();

    if (!settings.githubToken) {
        return { success: false, error: 'GitHub token not configured' };
    }

    const repos = await fetchUserRepos(settings.githubToken);
    return { success: true, data: repos };
}
