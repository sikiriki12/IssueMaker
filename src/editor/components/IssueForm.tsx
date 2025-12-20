import { useState, useRef, useEffect, useCallback } from 'react';
import type { IssueDraft, GitHubLabel, Attachment } from '@/types';
import { generateId } from '@/core/utils';

interface Props {
    draft: IssueDraft;
    labels: GitHubLabel[];
    onUpdate: (updates: Partial<IssueDraft>) => void;
    onAddAttachment: (attachment: Attachment) => void;
    onGenerate: () => void;
    loading: boolean;
    error: string | null;
}

export function IssueForm({
    draft,
    labels,
    onUpdate,
    onAddAttachment,
    onGenerate,
    loading,
    error,
}: Props) {
    const [showContext, setShowContext] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [pasteToast, setPasteToast] = useState(false);

    const handleTypeChange = (type: 'bug' | 'feature' | 'other') => {
        onUpdate({ type });
    };

    const handleStepChange = (index: number, value: string) => {
        const newSteps = [...draft.stepsToReproduce];
        newSteps[index] = value;
        onUpdate({ stepsToReproduce: newSteps });
    };

    const handleAddStep = () => {
        onUpdate({ stepsToReproduce: [...draft.stepsToReproduce, ''] });
    };

    const handleRemoveStep = (index: number) => {
        const newSteps = draft.stepsToReproduce.filter((_, i) => i !== index);
        onUpdate({ stepsToReproduce: newSteps.length > 0 ? newSteps : [''] });
    };

    const toggleLabel = (labelName: string) => {
        const currentLabels = draft.labels || [];
        const newLabels = currentLabels.includes(labelName)
            ? currentLabels.filter((l) => l !== labelName)
            : [...currentLabels, labelName];
        onUpdate({ labels: newLabels });
    };

    // Handle file selection
    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                const attachment: Attachment = {
                    id: generateId(),
                    type: 'image',
                    dataUrl,
                    filename: file.name,
                };
                onAddAttachment(attachment);
            };
            reader.readAsDataURL(file);
        }
    }, [onAddAttachment]);

    // Handle clipboard paste for images
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            const attachment: Attachment = {
                                id: generateId(),
                                type: 'image',
                                dataUrl,
                                filename: `pasted-image-${Date.now()}.png`,
                            };
                            onAddAttachment(attachment);

                            // Show toast feedback
                            setPasteToast(true);
                            setTimeout(() => setPasteToast(false), 2000);
                        };
                        reader.readAsDataURL(file);
                    }
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [onAddAttachment]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if we're leaving the form entirely
        if (!formRef.current?.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    // Get additional attachments (not the main screenshot)
    const additionalAttachments = draft.attachments.slice(1);

    // Remove an additional attachment
    const handleRemoveAttachment = (attachmentId: string) => {
        const newAttachments = draft.attachments.filter(att => att.id !== attachmentId);
        onUpdate({ attachments: newAttachments });
    };

    return (
        <div
            ref={formRef}
            className={`issue-form ${isDragging ? 'form-dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <div className="form-scroll">
                {/* Issue Type */}
                <div className="form-section">
                    <label className="section-label">Issue Type</label>
                    <div className="type-selector">
                        <button
                            className={`type-btn ${draft.type === 'bug' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('bug')}
                        >
                            🪲 Bug
                        </button>
                        <button
                            className={`type-btn ${draft.type === 'feature' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('feature')}
                        >
                            ✨ Feature
                        </button>
                        <button
                            className={`type-btn ${draft.type === 'other' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('other')}
                        >
                            📝 Other
                        </button>
                    </div>
                </div>

                {/* Description */}
                <div className="form-section">
                    <label className="section-label">Description</label>
                    <textarea
                        className="form-textarea"
                        placeholder="Describe the issue or feature request in detail. The AI will generate a structured title and body from this..."
                        value={draft.userDescription}
                        onChange={(e) => onUpdate({ userDescription: e.target.value })}
                        rows={5}
                    />
                </div>

                {/* Steps to Reproduce (for bugs) */}
                {draft.type === 'bug' && (
                    <>
                        <div className="form-section">
                            <label className="section-label">Steps to Reproduce</label>
                            <div className="steps-list">
                                {draft.stepsToReproduce.map((step, index) => (
                                    <div key={index} className="step-item">
                                        <span className="step-number">{index + 1}.</span>
                                        <input
                                            type="text"
                                            className="form-input step-input"
                                            placeholder={`Step ${index + 1}...`}
                                            value={step}
                                            onChange={(e) => handleStepChange(index, e.target.value)}
                                        />
                                        {draft.stepsToReproduce.length > 1 && (
                                            <button
                                                className="step-remove"
                                                onClick={() => handleRemoveStep(index)}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button className="add-step-btn" onClick={handleAddStep}>
                                    + Add step
                                </button>
                            </div>
                        </div>

                        <div className="form-section">
                            <label className="section-label">Expected Behavior</label>
                            <textarea
                                className="form-textarea"
                                placeholder="What did you expect to happen?"
                                value={draft.expectedBehavior}
                                onChange={(e) => onUpdate({ expectedBehavior: e.target.value })}
                                rows={2}
                            />
                        </div>

                        <div className="form-section">
                            <label className="section-label">Actual Behavior</label>
                            <textarea
                                className="form-textarea"
                                placeholder="What actually happened?"
                                value={draft.actualBehavior}
                                onChange={(e) => onUpdate({ actualBehavior: e.target.value })}
                                rows={2}
                            />
                        </div>
                    </>
                )}

                {/* Labels */}
                <div className="form-section">
                    <label className="section-label">Labels</label>
                    {labels.length > 0 ? (
                        <div className="labels-grid">
                            {labels.map((label) => (
                                <button
                                    key={label.name}
                                    className={`label-btn ${draft.labels?.includes(label.name) ? 'active' : ''}`}
                                    onClick={() => toggleLabel(label.name)}
                                    style={{ '--label-color': `#${label.color}` } as React.CSSProperties}
                                >
                                    <span className="label-dot" />
                                    {label.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="no-labels">No labels available</p>
                    )}
                </div>

                {/* Additional Images */}
                <div className="form-section">
                    <label className="section-label">Additional Images</label>
                    <div
                        className={`image-dropzone ${isDragging ? 'dragging' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFiles(e.target.files)}
                            style={{ display: 'none' }}
                        />
                        <span className="dropzone-icon">📎</span>
                        <span className="dropzone-text">
                            Drop images here or click to upload
                        </span>
                    </div>

                    {additionalAttachments.length > 0 && (
                        <div className="image-thumbnails">
                            {additionalAttachments.map((att) => (
                                <div key={att.id} className="image-thumbnail">
                                    <button
                                        className="thumbnail-remove"
                                        onClick={() => handleRemoveAttachment(att.id)}
                                        title="Remove image"
                                    >
                                        ✕
                                    </button>
                                    <img src={att.dataUrl} alt={att.filename} />
                                    <span className="thumbnail-name">{att.filename}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Context Toggle */}
                <div className="form-section">
                    <button
                        className="context-toggle"
                        onClick={() => setShowContext(!showContext)}
                    >
                        <span>Include Context</span>
                        <span className="toggle-icon">{showContext ? '▲' : '▼'}</span>
                    </button>

                    {showContext && (
                        <div className="context-options">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={draft.includeConsoleLogs}
                                    onChange={(e) => onUpdate({ includeConsoleLogs: e.target.checked })}
                                />
                                Console Logs
                                <span className="context-count">
                                    ({draft.context.consoleLogs.length})
                                </span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={draft.includeNetworkErrors}
                                    onChange={(e) => onUpdate({ includeNetworkErrors: e.target.checked })}
                                />
                                Network Errors
                                <span className="context-count">
                                    ({draft.context.networkErrors.length})
                                </span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={draft.includeEnvironment}
                                    onChange={(e) => onUpdate({ includeEnvironment: e.target.checked })}
                                />
                                Environment Info
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="form-error">
                    <span>⚠️</span>
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="form-actions">
                <button
                    className="btn btn-primary btn-large"
                    onClick={onGenerate}
                    disabled={loading || !draft.userDescription.trim()}
                >
                    {loading ? (
                        <>
                            <span className="spinner" />
                            Generating...
                        </>
                    ) : (
                        '✨ Generate with AI'
                    )}
                </button>
            </div>

            {/* Paste toast notification */}
            {pasteToast && (
                <div className="paste-toast">
                    📎 Image pasted from clipboard
                </div>
            )}
        </div>
    );
}
