interface Props {
    issueUrl: string;
}

export function SuccessScreen({ issueUrl }: Props) {
    const handleClose = () => {
        window.close();
    };

    return (
        <div className="success-screen">
            <div className="success-content">
                <div className="success-animation">
                    <span className="success-icon">🎉</span>
                </div>
                <h1>Issue Created!</h1>
                <p>Your issue has been successfully created on GitHub.</p>

                <div className="success-actions">
                    <a
                        href={issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-large"
                    >
                        <span>🔗</span>
                        View Issue on GitHub
                    </a>

                    <button onClick={handleClose} className="btn btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
