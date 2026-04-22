// Shown when the destination is outside Camden & Westminster coverage.
// Offers to route to the nearest boundary point instead.
export default function BoundsWarning({ onRouteToBoundary, onCancel }) {
  return (
    <div className="bounds-warning-overlay">
      <div className="bounds-warning-card">
        <div className="bounds-warning-icon">⚠</div>

        <h3 className="bounds-warning-title">Outside our current area</h3>

        <p className="bounds-warning-text">
          This destination is beyond our Camden and Westminster coverage.
          We'll guide you to the edge of our area. From there you're on your own.
        </p>

        <div className="bounds-warning-actions">
          <button
            type="button"
            className="bounds-warning-primary"
            onClick={onRouteToBoundary}
          >
            Route to boundary
          </button>
          <button
            type="button"
            className="bounds-warning-secondary"
            onClick={onCancel}
          >
            Change destination
          </button>
        </div>
      </div>
    </div>
  );
}
