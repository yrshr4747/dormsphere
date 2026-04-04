import { useEffect } from 'react';

export default function SelectionFeedback({ type, message, roomInfo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, type === 'success' ? 4000 : 3000);
    return () => clearTimeout(timer);
  }, [type, onClose]);

  return (
    <div className="selection-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {type === 'success' ? (
          <div className="selection-success">
            <div className="selection-success-icon">🎉</div>
            <h2 style={{ marginBottom: 'var(--space-md)' }}>Room Secured!</h2>
            {roomInfo && (
              <div className="glass-card-static" style={{ display: 'inline-block', marginBottom: 'var(--space-lg)' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>
                  Room {roomInfo.roomNumber}
                </p>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Floor {roomInfo.floor}
                </p>
              </div>
            )}
            <p className="text-muted">{message}</p>
            <button className="btn btn-gold mt-lg" onClick={onClose}>
              Continue
            </button>
          </div>
        ) : (
          <div className="selection-fail">
            <div className="selection-success-icon">😔</div>
            <h2 style={{ marginBottom: 'var(--space-md)', color: 'var(--danger)' }}>
              Selection Failed
            </h2>
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)' }}>{message}</p>
            <button className="btn btn-ghost" onClick={onClose}>
              Try Another Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
