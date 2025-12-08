import { useEffect, useState } from 'react';
import type { ExtensionSettings } from '@/types';

export default function App() {
    const [settings, setSettings] = useState<ExtensionSettings | null>(null);
    const [repos, setRepos] = useState<string[]>([]);
    const [selectedRepo, setSelectedRepo] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [loadingRepos, setLoadingRepos] = useState(false);

    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (response) => {
            if (response?.success) {
                setSettings(response.data);

                // If we have a GitHub token, fetch repos
                if (response.data?.githubToken) {
                    setLoadingRepos(true);
                    const reposResponse = await chrome.runtime.sendMessage({ type: 'GET_USER_REPOS' });
                    if (reposResponse?.success && reposResponse.data) {
                        setRepos(reposResponse.data);
                        if (reposResponse.data.length > 0) {
                            setSelectedRepo(reposResponse.data[0]);
                        }
                    }
                    setLoadingRepos(false);
                }
            }
            setLoading(false);
        });
    }, []);

    const isConfigured = Boolean(settings?.geminiApiKey && settings?.githubToken);

    const handleNewIssue = async () => {
        if (!selectedRepo) return;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id && tab?.windowId) {
                // Capture screenshot BEFORE opening editor (while this tab is still visible)
                const screenshotResponse = await chrome.runtime.sendMessage({
                    type: 'CAPTURE_SCREENSHOT_NOW',
                    payload: { windowId: tab.windowId },
                });

                if (screenshotResponse?.success) {
                    // Try to inject content script first
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['dist/content.js'],
                        });
                    } catch {
                        // Content script might already be injected
                    }

                    // Try to get context from content script
                    let contextData = null;
                    try {
                        contextData = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
                    } catch {
                        // Content script not available
                    }

                    // Build context from tab info as fallback if content script failed
                    const finalContext = contextData?.success ? contextData.data : {
                        environment: {
                            url: tab.url || 'Unknown',
                            pageTitle: tab.title || 'Unknown',
                            userAgent: navigator.userAgent,
                            viewportWidth: tab.width || 0,
                            viewportHeight: tab.height || 0,
                            timestamp: Date.now()
                        },
                        consoleLogs: [],
                        networkErrors: []
                    };

                    // Store screenshot, context, and selected repo, then open editor
                    await chrome.storage.session.set({
                        issuemaker_pending_screenshot: screenshotResponse.data,
                        issuemaker_pending_tab_id: tab.id,
                        issuemaker_pending_context: finalContext,
                        issuemaker_pending_repo: selectedRepo,
                    });

                    chrome.tabs.create({
                        url: chrome.runtime.getURL(`dist/src/editor/index.html?tabId=${tab.id}`),
                    });
                    window.close();
                }
            }
        } catch (error) {
            console.error('Failed to open editor:', error);
        }
    };

    const handleOpenSettings = () => {
        chrome.runtime.openOptionsPage();
        window.close();
    };

    if (loading) {
        return (
            <div className="popup">
                <div className="popup-loading">
                    <div className="spinner" />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="popup">
            <header className="popup-header">
                <div className="logo">
                    <span className="logo-icon">🐛</span>
                    <h1>IssueMaker</h1>
                </div>
            </header>

            {!isConfigured ? (
                <div className="popup-content unconfigured">
                    <div className="warning-icon">⚠️</div>
                    <p>Please configure your GitHub and Gemini API keys to get started.</p>
                    <button onClick={handleOpenSettings} className="btn btn-primary">
                        Open Settings
                    </button>
                </div>
            ) : (
                <div className="popup-content configured">
                    {loadingRepos ? (
                        <div className="repo-loading">
                            <div className="spinner-small" />
                            <span>Loading repositories...</span>
                        </div>
                    ) : repos.length === 0 ? (
                        <div className="repo-empty">
                            <p>No repositories found. Make sure your GitHub token has repo access.</p>
                        </div>
                    ) : (
                        <div className="repo-selector">
                            <label htmlFor="repo-select">Create issue in:</label>
                            <select
                                id="repo-select"
                                value={selectedRepo}
                                onChange={(e) => setSelectedRepo(e.target.value)}
                                className="repo-dropdown"
                            >
                                {repos.map((repo) => (
                                    <option key={repo} value={repo}>{repo}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={handleNewIssue}
                        className="btn btn-primary btn-large"
                        disabled={!selectedRepo}
                    >
                        <span className="btn-icon">✨</span>
                        <span className="btn-text">
                            New Issue from This Page
                            <span className="btn-shortcut">Alt + Shift + I</span>
                        </span>
                    </button>

                    <button onClick={handleOpenSettings} className="btn btn-secondary">
                        Settings
                    </button>
                </div>
            )}

            <footer className="popup-footer">
                <span>AI-powered GitHub issues</span>
            </footer>
        </div>
    );
}
