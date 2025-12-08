import { useState } from 'react';
import type { IssueDraft, GitHubLabel } from '@/types';

interface Props {
    draft: IssueDraft;
    labels: GitHubLabel[];
    loading: boolean;
    error: string | null;
    onBack: () => void;
    onCreateIssue: (title: string, body: string, labels: string[]) => void;
}

export function ReviewScreen({
    draft,
    labels,
    loading,
    error,
    onBack,
    onCreateIssue,
}: Props) {
    const [title, setTitle] = useState(draft.aiDraft?.title || '');
    const [body, setBody] = useState(draft.aiDraft?.body || '');
    const [selectedLabels, setSelectedLabels] = useState<string[]>(draft.labels);
    const [showPreview, setShowPreview] = useState(true);
    const [copied, setCopied] = useState(false);

    const handleLabelToggle = (labelName: string) => {
        setSelectedLabels((prev) =>
            prev.includes(labelName) ? prev.filter((l) => l !== labelName) : [...prev, labelName]
        );
    };

    const handleCopy = async () => {
        const markdown = `# ${title}\n\n${body}`;
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreate = () => {
        onCreateIssue(title, body, selectedLabels);
    };

    return (
        <div className="review-screen">
            <header className="review-header">
                <div className="header-left">
                    <button onClick={onBack} className="btn btn-ghost back-btn">
                        ← Back
                    </button>
                    <h1>Review Issue</h1>
                </div>
                <div className="header-right">
                    <button onClick={handleCopy} className="btn btn-secondary">
                        {copied ? '✓ Copied!' : '📋 Copy Markdown'}
                    </button>
                </div>
            </header>

            <div className="review-body">
                <div className="review-main">
                    {/* Title */}
                    <div className="review-section">
                        <label htmlFor="issueTitle" className="section-label">
                            Title
                        </label>
                        <input
                            id="issueTitle"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="form-input title-input"
                        />
                    </div>

                    {/* Body */}
                    <div className="review-section body-section">
                        <div className="section-header">
                            <label className="section-label">Body</label>
                            <div className="view-toggle">
                                <button
                                    className={`toggle-btn ${!showPreview ? 'active' : ''}`}
                                    onClick={() => setShowPreview(false)}
                                >
                                    Edit
                                </button>
                                <button
                                    className={`toggle-btn ${showPreview ? 'active' : ''}`}
                                    onClick={() => setShowPreview(true)}
                                >
                                    Preview
                                </button>
                            </div>
                        </div>

                        {showPreview ? (
                            <div className="markdown-preview">
                                <MarkdownRenderer content={body} />
                            </div>
                        ) : (
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                className="form-textarea body-textarea"
                                rows={20}
                            />
                        )}
                    </div>
                </div>

                <div className="review-sidebar">
                    {/* Labels */}
                    <div className="sidebar-section">
                        <h3 className="sidebar-title">Labels</h3>
                        <div className="labels-list">
                            {labels.map((label) => (
                                <button
                                    key={label.id}
                                    className={`label-btn ${selectedLabels.includes(label.name) ? 'active' : ''}`}
                                    onClick={() => handleLabelToggle(label.name)}
                                    style={{
                                        '--label-color': `#${label.color}`,
                                    } as React.CSSProperties}
                                >
                                    <span className="label-dot" />
                                    {label.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Environment Info */}
                    {draft.includeEnvironment && (
                        <div className="sidebar-section">
                            <h3 className="sidebar-title">Environment</h3>
                            <div className="environment-info">
                                <div className="env-item">
                                    <span className="env-label">URL:</span>
                                    <span className="env-value">{draft.context.environment.url}</span>
                                </div>
                                <div className="env-item">
                                    <span className="env-label">Viewport:</span>
                                    <span className="env-value">
                                        {draft.context.environment.viewportWidth}x
                                        {draft.context.environment.viewportHeight}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Context Summary */}
                    <div className="sidebar-section">
                        <h3 className="sidebar-title">Included Context</h3>
                        <ul className="context-summary">
                            <li className={draft.includeEnvironment ? 'included' : 'excluded'}>
                                {draft.includeEnvironment ? '✓' : '✗'} Environment info
                            </li>
                            <li className={draft.includeConsoleLogs ? 'included' : 'excluded'}>
                                {draft.includeConsoleLogs ? '✓' : '✗'} Console logs (
                                {draft.context.consoleLogs.length})
                            </li>
                            <li className={draft.includeNetworkErrors ? 'included' : 'excluded'}>
                                {draft.includeNetworkErrors ? '✓' : '✗'} Network errors (
                                {draft.context.networkErrors.length})
                            </li>
                            <li className="included">
                                ✓ Screenshot{draft.attachments[0]?.annotations?.length ? ' (annotated)' : ''}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="review-error">
                    <span>❌</span>
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="review-actions">
                <button onClick={onBack} className="btn btn-secondary">
                    ← Edit Details
                </button>
                <button
                    onClick={handleCreate}
                    disabled={loading || !title.trim() || !body.trim()}
                    className="btn btn-primary btn-large"
                >
                    {loading ? (
                        <>
                            <span className="spinner" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <span>🚀</span>
                            Create GitHub Issue
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

// Simple markdown renderer (basic implementation)
function MarkdownRenderer({ content }: { content: string }) {
    // Very basic markdown to HTML conversion
    const html = content
        // Headers
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Lists
        .replace(/^- (.*$)/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
        // Task lists
        .replace(/- \[ \] (.*$)/gm, '<li class="task">☐ $1</li>')
        .replace(/- \[x\] (.*$)/gm, '<li class="task done">☑ $1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return (
        <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
        />
    );
}
