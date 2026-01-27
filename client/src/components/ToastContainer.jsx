import { useEffect } from 'react';

export default function ToastContainer({ toasts, removeToast }) {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none' // Allow clicks to pass through container
        }}>
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    style={{
                        pointerEvents: 'auto',
                        animation: 'slideIn 0.3s ease-out'
                    }}
                >
                    <div className="toast-content">
                        {toast.type === 'error' && <span style={{ marginRight: '8px' }}>⚠️</span>}
                        {toast.type === 'success' && <span style={{ marginRight: '8px' }}>✅</span>}
                        {toast.message}
                    </div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            opacity: 0.7,
                            cursor: 'pointer',
                            marginLeft: '12px',
                            padding: '0 4px'
                        }}
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
