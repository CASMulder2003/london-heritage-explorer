// Full site detail page shown after tapping "Read more" on the arrival card.
// Shows the full description, image, and Wikipedia link.
// User taps "Continue journey" to return to navigation.
export default function SiteDetailScreen({ site, description, image, wikiUrl, onContinue }) {
  if (!site) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 300,
      background: "#faf7f2",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Hero image */}
      {image ? (
        <img
          src={image}
          alt={site.name}
          style={{ width: "100%", height: "auto", maxHeight: "280px", objectFit: "cover", flexShrink: 0 }}
          loading="lazy"
        />
      ) : (
        <div style={{
          width: "100%", height: "180px", background: "#ede8e0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "3rem", color: "#c4b89e", flexShrink: 0,
        }}>✦</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: "24px 20px 0" }}>
        {/* Category pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: "#ede8e0", borderRadius: "20px", padding: "4px 10px",
          fontSize: "11px", color: "#81796f", textTransform: "uppercase",
          letterSpacing: "0.08em", marginBottom: "10px",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background:
              site.category === "park" ? "#2d8a4e"
              : site.category === "memorial" ? "#A5513A"
              : site.category === "church" ? "#c9a84c"
              : site.category === "listed" ? "#1a3a5c"
              : "#8E352E",
          }} />
          {site.period || site.category}
        </div>

        <h1 style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.8rem",
          fontWeight: 400,
          color: "#2f2418",
          margin: "0 0 16px",
          lineHeight: 1.2,
        }}>
          {site.name}
        </h1>

        {description ? (
          <p style={{
            fontFamily: "Georgia, serif",
            fontSize: "0.95rem",
            color: "#5b4b3a",
            lineHeight: 1.75,
            margin: "0 0 16px",
          }}>
            {description}
          </p>
        ) : (
          <p style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: "0.9rem",
            color: "#81796f",
            lineHeight: 1.7,
            margin: "0 0 16px",
          }}>
            A place worth pausing at on your journey through the city.
          </p>
        )}

        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: "#81796f",
              textDecoration: "none",
              borderBottom: "1px solid #d4c9b8",
              paddingBottom: "2px",
              marginBottom: "24px",
            }}
          >
            Read full article on Wikipedia ↗
          </a>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 20px 48px", flexShrink: 0 }}>
        <button
          type="button"
          className="mobile-site-continue-btn"
          onClick={onContinue}
        >
          Continue journey →
        </button>
      </div>
    </div>
  );
}
