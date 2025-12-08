import { useEffect, useState } from 'react';
import type { ExtensionSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/core/constants';

export default function App() {
    const [settings, setSettings] = useState<ExtensionSettings>({ ...DEFAULT_SETTINGS });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTokens, setShowTokens] = useState({ github: false, gemini: false });

    useEffect(() => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
            if (response?.success && response.data) {
                setSettings({ ...DEFAULT_SETTINGS, ...response.data });
            }
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);

        try {
            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'SAVE_SETTINGS', payload: settings },
                    resolve
                );
            });

            if (!response?.success) {
                throw new Error(response?.error || 'Failed to save settings');
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="options-page">
            <div className="options-container">
                <header className="options-header">
                    <div className="logo">
                        <span className="logo-icon">🐛</span>
                        <div>
                            <h1>IssueMaker</h1>
                            <p className="tagline">AI-powered GitHub issue creation</p>
                        </div>
                    </div>
                </header>

                <main className="options-main">
                    {/* GitHub Section */}
                    <section className="settings-section">
                        <div className="section-header">
                            <h2>
                                <span className="section-icon">🔐</span>
                                GitHub Configuration
                            </h2>
                        </div>

                        <div className="form-group">
                            <label htmlFor="githubToken">Personal Access Token</label>
                            <div className="input-with-toggle">
                                <input
                                    id="githubToken"
                                    type={showTokens.github ? 'text' : 'password'}
                                    value={settings.githubToken}
                                    onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                                    placeholder="ghp_xxxxxxxxxxxx"
                                />
                                <button
                                    type="button"
                                    className="toggle-visibility"
                                    onClick={() => setShowTokens((s) => ({ ...s, github: !s.github }))}
                                >
                                    {showTokens.github ? '🙈' : '👁️'}
                                </button>
                            </div>
                            <p className="help-text">
                                Create a token with <code>repo</code> scope at{' '}
                                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
                                    github.com/settings/tokens
                                </a>
                            </p>
                            <p className="help-text">
                                Your repositories will be automatically fetched from this token.
                            </p>
                        </div>
                    </section>

                    {/* Gemini Section */}
                    <section className="settings-section">
                        <div className="section-header">
                            <h2>
                                <span className="section-icon">🤖</span>
                                AI Configuration
                            </h2>
                        </div>

                        <div className="form-group">
                            <label htmlFor="geminiApiKey">Gemini API Key</label>
                            <div className="input-with-toggle">
                                <input
                                    id="geminiApiKey"
                                    type={showTokens.gemini ? 'text' : 'password'}
                                    value={settings.geminiApiKey}
                                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                                    placeholder="AIza..."
                                />
                                <button
                                    type="button"
                                    className="toggle-visibility"
                                    onClick={() => setShowTokens((s) => ({ ...s, gemini: !s.gemini }))}
                                >
                                    {showTokens.gemini ? '🙈' : '👁️'}
                                </button>
                            </div>
                            <p className="help-text">
                                Get your API key from{' '}
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                                    Google AI Studio
                                </a>
                            </p>
                        </div>
                    </section>

                    {/* Status Messages */}
                    {error && (
                        <div className="message error">
                            <span className="message-icon">❌</span>
                            {error}
                        </div>
                    )}

                    {saved && (
                        <div className="message success">
                            <span className="message-icon">✅</span>
                            Settings saved successfully!
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="actions">
                        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-large">
                            {saving ? (
                                <>
                                    <span className="spinner" />
                                    Saving...
                                </>
                            ) : (
                                'Save Settings'
                            )}
                        </button>
                    </div>
                </main>

                <footer className="options-footer">
                    <p>IssueMaker v1.0.0</p>
                </footer>
            </div>
        </div>
    );
}
