export default function HeritagePopup({ site, onClose }) {
  if (!site) return null;

  return (
    <div className="heritage-popup">
      <button
        type="button"
        className="popup-close"
        onClick={onClose}
        aria-label="Close heritage popup"
      >
        ×
      </button>

      <div className="popup-num">{site.id}</div>

      <div className="popup-img">
        {site.image ? (
          <img
            src={site.image}
            alt={site.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "12px",
            }}
          />
        ) : (
          "Heritage image"
        )}
      </div>

      <div className="popup-meta">{site.period || "Historic site"}</div>
      <div className="popup-name">{site.name}</div>
      <div className="popup-desc">{site.description}</div>

      <button type="button" className="popup-link">
        Read more
      </button>
    </div>
  );
}