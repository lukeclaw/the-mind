import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="lobby-container" style={{ flexDirection: 'column', textAlign: 'center', color: '#fff' }}>
                    <div className="panel panel-glow">
                        <h2 className="mb-md text-danger">Something went wrong</h2>
                        <p className="mb-lg text-muted">The game encountered a critical error.</p>
                        <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                            {this.state.error && this.state.error.toString()}
                        </details>
                        <button className="btn btn-primary" onClick={() => window.location.reload()}>
                            Reload Game
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
