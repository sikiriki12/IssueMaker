import { useState, useEffect, useCallback, useRef } from 'react';
import { AnnotationCanvas, AnnotationCanvasRef } from './components/AnnotationCanvas';
import { IssueForm } from './components/IssueForm';
import { ReviewScreen } from './components/ReviewScreen';
import { SuccessScreen } from './components/SuccessScreen';
import type { IssueDraft, IssueContext, Attachment, ExtensionSettings, GitHubLabel } from '@/types';
import { generateId } from '@/core/utils';

type EditorStep = 'capture' | 'review' | 'success';

export default function App() {
    const [step, setStep] = useState<EditorStep>('capture');
    const [settings, setSettings] = useState<ExtensionSettings | null>(null);
    const [repos, setRepos] = useState<string[]>([]);
    const [selectedRepo, setSelectedRepo] = useState<string>('');
    const [labels, setLabels] = useState<GitHubLabel[]>([]);
    const [draft, setDraft] = useState<IssueDraft | null>(null);
    const [createdIssueUrl, setCreatedIssueUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, setTabId] = useState<number | null>(null);

    const canvasRef = useRef<AnnotationCanvasRef>(null);

    useEffect(() => {
        initializeEditor();
    }, []);

    const initializeEditor = async () => {
        try {
            // Get settings
            const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (!settingsResponse?.success) throw new Error('Failed to load settings');
            setSettings(settingsResponse.data);

            // Get tab ID from URL params
            const params = new URLSearchParams(window.location.search);
            const tid = parseInt(params.get('tabId') || '', 10);
            if (!tid) throw new Error('No tab ID provided');
            setTabId(tid);

            // Get screenshot, context, and selected repo from session storage
            const storage = await chrome.storage.session.get([
                'issuemaker_pending_screenshot',
                'issuemaker_pending_tab_id',
                'issuemaker_pending_context',
                'issuemaker_pending_repo'
            ]);

            const screenshotData = storage.issuemaker_pending_screenshot;
            if (!screenshotData) {
                throw new Error('No screenshot found. Please try again from the popup.');
            }

            // Get the selected repo from popup
            const storedRepo = storage.issuemaker_pending_repo || '';
            setSelectedRepo(storedRepo);

            // Clear the pending data
            await chrome.storage.session.remove([
                'issuemaker_pending_screenshot',
                'issuemaker_pending_tab_id',
                'issuemaker_pending_context',
                'issuemaker_pending_repo'
            ]);

            // Use pre-captured context if available, otherwise try to get from content script
            let context: IssueContext;
            if (storage.issuemaker_pending_context) {
                context = storage.issuemaker_pending_context;
            } else {
                // Fallback: try to get from content script (may fail if tab changed)
                try {
                    const contextResponse = await chrome.tabs.sendMessage(tid, { type: 'GET_PAGE_CONTEXT' });
                    if (contextResponse?.success) {
                        context = contextResponse.data;
                    } else {
                        context = createFallbackContext();
                    }
                } catch (e) {
                    console.warn('Could not get page context:', e);
                    context = createFallbackContext();
                }
            }

            // Fetch all user repos for the dropdown
            const reposResponse = await chrome.runtime.sendMessage({ type: 'GET_USER_REPOS' });
            if (reposResponse?.success && reposResponse.data) {
                setRepos(reposResponse.data);
                // Use stored repo or first from list
                if (!storedRepo && reposResponse.data.length > 0) {
                    setSelectedRepo(reposResponse.data[0]);
                }
            }

            // Fetch labels for the selected repo
            const repoToUse = storedRepo || reposResponse?.data?.[0] || '';
            if (repoToUse) {
                const [owner, repo] = repoToUse.split('/');
                const labelsResponse = await chrome.runtime.sendMessage({
                    type: 'GET_REPO_LABELS',
                    payload: { owner, repo },
                });
                if (labelsResponse?.success) {
                    setLabels(labelsResponse.data);
                }
            }

            // Initialize draft - console logs and network errors are TRUE by default
            const initialDraft: IssueDraft = {
                id: generateId(),
                createdAt: Date.now(),
                type: 'bug',
                userTitle: '',
                userDescription: '',
                stepsToReproduce: [''],
                expectedBehavior: '',
                actualBehavior: '',
                labels: [],
                attachments: [
                    {
                        id: generateId(),
                        type: 'screenshot',
                        dataUrl: screenshotData,
                        filename: 'screenshot.png',
                    },
                ],
                context,
                includeConsoleLogs: true,
                includeNetworkErrors: true,
                includeEnvironment: true,
            };

            setDraft(initialDraft);
            setLoading(false);
        } catch (err) {
            console.error('Initialization error:', err);
            setError(err instanceof Error ? err.message : 'Initialization failed');
            setLoading(false);
        }
    };

    const createFallbackContext = (): IssueContext => ({
        environment: {
            url: 'Unknown',
            pageTitle: 'Unknown',
            userAgent: navigator.userAgent,
            viewportWidth: 0,
            viewportHeight: 0,
            timestamp: Date.now(),
        },
        consoleLogs: [],
        networkErrors: [],
    });

    const handleUpdateDraft = useCallback((updates: Partial<IssueDraft>) => {
        setDraft((prev) => (prev ? { ...prev, ...updates } : null));
    }, []);

    const handleUpdateAttachment = useCallback((attachment: Attachment) => {
        setDraft((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                attachments: prev.attachments.map((a) => (a.id === attachment.id ? attachment : a)),
            };
        });
    }, []);

    const handleAddAttachment = useCallback((attachment: Attachment) => {
        setDraft((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                attachments: [...prev.attachments, attachment],
            };
        });
    }, []);

    const handleGenerateIssue = async () => {
        if (!draft || !settings) return;

        setGenerating(true);
        setError(null);

        try {
            // Get the annotated image from the canvas
            const annotatedImage = canvasRef.current?.getAnnotatedImage();

            // Update the main screenshot with annotated version
            let draftToSend = draft;
            if (annotatedImage && draft.attachments.length > 0) {
                const updatedAttachments = [...draft.attachments];
                updatedAttachments[0] = {
                    ...updatedAttachments[0],
                    dataUrl: annotatedImage,
                };
                draftToSend = { ...draft, attachments: updatedAttachments };
                handleUpdateDraft({ attachments: updatedAttachments });
            }

            const response = await chrome.runtime.sendMessage({
                type: 'GENERATE_ISSUE',
                payload: draftToSend,
            });

            if (!response?.success) throw new Error(response?.error || 'AI generation failed');

            handleUpdateDraft({ aiDraft: response.data });
            setStep('review');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleCreateIssue = async (title: string, body: string, issueLabels: string[]) => {
        if (!settings || !draft || !selectedRepo) return;

        setCreating(true);
        setError(null);

        try {
            const [owner, repo] = selectedRepo.split('/');

            // Use the new message type that handles image uploads
            const response = await chrome.runtime.sendMessage({
                type: 'CREATE_GITHUB_ISSUE_WITH_IMAGES',
                payload: {
                    owner,
                    repo,
                    title,
                    body,
                    labels: issueLabels,
                    attachments: draft.attachments,
                },
            });

            if (!response?.success) throw new Error(response?.error || 'Failed to create issue');

            // Clear draft
            await chrome.runtime.sendMessage({ type: 'CLEAR_DRAFT' });

            setCreatedIssueUrl(response.data.html_url);
            setStep('success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Issue creation failed');
        } finally {
            setCreating(false);
        }
    };

    const handleBack = () => {
        setStep('capture');
        setError(null);
    };

    const handleDiscard = async () => {
        if (confirm('Are you sure you want to discard this issue? All changes will be lost.')) {
            await chrome.runtime.sendMessage({ type: 'CLEAR_DRAFT' });
            window.close();
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="editor-loading">
                <div className="loading-content">
                    <div className="spinner large" />
                    <h2>Capturing page...</h2>
                    <p>Getting screenshot and collecting context</p>
                </div>
            </div>
        );
    }

    // Error state (fatal)
    if (error && !draft) {
        return (
            <div className="editor-error">
                <div className="error-content">
                    <span className="error-icon">❌</span>
                    <h2>Something went wrong</h2>
                    <p>{error}</p>
                    <button onClick={() => window.close()} className="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // Success state
    if (step === 'success' && createdIssueUrl) {
        return <SuccessScreen issueUrl={createdIssueUrl} />;
    }

    // Review state
    if (step === 'review' && draft?.aiDraft) {
        return (
            <ReviewScreen
                draft={draft}
                labels={labels}
                loading={creating}
                error={error}
                onBack={handleBack}
                onCreateIssue={handleCreateIssue}
            />
        );
    }

    // Capture/Edit state
    return (
        <div className="editor">
            <header className="editor-header">
                <div className="header-left">
                    <span className="logo-icon">🐛</span>
                    <h1>Create Issue</h1>
                </div>
                <div className="header-right">
                    <select
                        className="repo-select"
                        value={selectedRepo}
                        onChange={async (e) => {
                            const newRepo = e.target.value;
                            setSelectedRepo(newRepo);
                            // Fetch labels for new repo
                            if (newRepo) {
                                const [owner, repo] = newRepo.split('/');
                                const labelsResponse = await chrome.runtime.sendMessage({
                                    type: 'GET_REPO_LABELS',
                                    payload: { owner, repo },
                                });
                                if (labelsResponse?.success) {
                                    setLabels(labelsResponse.data);
                                }
                            }
                        }}
                    >
                        {repos.map((repo) => (
                            <option key={repo} value={repo}>{repo}</option>
                        ))}
                    </select>
                    <button onClick={handleDiscard} className="btn btn-ghost">
                        Discard
                    </button>
                </div>
            </header>

            <div className="editor-body">
                <div className="editor-left">
                    {draft?.context?.environment?.url && (
                        <div className="screenshot-url">
                            <span className="url-icon">🔗</span>
                            <span className="url-text">{draft.context.environment.url}</span>
                        </div>
                    )}
                    <AnnotationCanvas
                        ref={canvasRef}
                        attachment={draft?.attachments[0] || null}
                        onUpdate={handleUpdateAttachment}
                    />
                </div>

                <div className="editor-right">
                    <IssueForm
                        draft={draft!}
                        labels={labels}
                        onUpdate={handleUpdateDraft}
                        onAddAttachment={handleAddAttachment}
                        onGenerate={handleGenerateIssue}
                        loading={generating}
                        error={error}
                    />
                </div>
            </div>
        </div>
    );
}
