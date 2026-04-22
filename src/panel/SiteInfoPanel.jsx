import { useEffect, useState } from "react";
import { getWikipediaContent } from "../services/wikipedia";

const CATEGORY_COLORS = {
  park:     "#2d8a4e",
  memorial: "#A5513A",
  church:   "#c9a84c",
  listed:   "#1a3a5c",
  default:  "#8E352E",
};

export default function SiteInfoPanel({ site, onClose }) {
  const [wikiContent, setWikiContent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!site) return;
    setWikiContent(null);

    // Use pre-written description if available
    if (site.enrichedDescription) {
      setWikiContent({
        extract: site.enrichedDescription,
        thumbnail: site.image || null,
        url: site.wikipediaUrl || null,
      });
      // Still fetch image from Wikipedia if we don't have one
      if (!site.image && site.wikipedia) {
        getWikipediaContent(site.wikipedia).then((wiki) => {
          if (wiki?.thumbnail) {
            setWikiContent((prev) => prev ? { ...prev, thumbnail: wiki.thumbnail, url: prev.url || wiki.url } : null);
          }
        }).catch(() => {});
      }
      return;
    }

    // Otherwise fetch from Wikipedia
    if (site.wikipedia) {
      setLoading(true);
      getWikipediaContent(site.wikipedia)
        .then((wiki) => {
          setWikiContent({
            extract: wiki?.extract || null,
            thumbnail: site.image || wiki?.thumbnail || null,
            url: site.wikipediaUrl || wiki?.url || null,
          });
        })
        .finally(() => setLoading(false));
    }
  }, [site]);

  if (!site) {
    return (
      <div style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        color: "#81796f",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "16px", opacity: 0.4 }}>✦</div>
        <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
          Click any numbered marker on the map to explore a heritage site.
        </p>
      </div>
    );
  }

  const color = CATEGORY_COLORS[site.category] || CATEGORY_COLORS.default;
  const image = wikiContent?.thumbnail || site.image || null;
  const description = wikiContent?.extract || null;
  const wikiUrl = wikiContent?.url || null;

  return (
    <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "#ede8e0", borderRadius: "20px", padding: "4px 10px",
            fontSize: "11px", color: "#81796f", textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: color }} />
            {site.period || site.category}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#81796f", fontSize: "20px", padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.4rem",
          fontWeight: 400,
          color: "#2f2418",
          margin: "0 0 12px",
          lineHeight: 1.2,
        }}>
          {site.name}
        </h2>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {/* Image */}
        {image && (
          <img
            src={image}
            alt={site.name}
            loading="lazy"
            onError={(e) => { e.target.style.display = "none"; }}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "220px",
              objectFit: "cover",
              borderRadius: "14px",
              marginBottom: "14px",
              display: "block",
            }}
          />
        )}

        {loading ? (
          <div style={{ display: "flex", gap: "6px", padding: "8px 0" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className="loading-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        ) : description ? (
          <p style={{
            fontFamily: "Georgia, serif",
            fontSize: "0.88rem",
            color: "#5b4b3a",
            lineHeight: 1.75,
            margin: "0 0 14px",
          }}>
            {description}
          </p>
        ) : site.category ? (
          <p style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: "0.88rem",
            color: "#81796f",
            lineHeight: 1.7,
            margin: "0 0 14px",
          }}>
            A place worth pausing at on your journey through the city.
          </p>
        ) : null}

        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              color: "#A5513A",
              textDecoration: "none",
              borderBottom: "1px solid #d4c9b8",
              paddingBottom: "2px",
            }}
          >
            Read more on Wikipedia ↗
          </a>
        )}
      </div>
    </div>
  );
}
