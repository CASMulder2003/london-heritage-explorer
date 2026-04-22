import { useEffect, useState } from "react";
import { getWikipediaContent } from "../services/wikipedia";

// Generate arrival sounds based on heritage site category
function playArrivalSound(category) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    function note(freq, startTime, duration, peakGain, type, detune) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      if (detune) osc.detune.setValueAtTime(detune, startTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    }

    const t = ctx.currentTime;

    if (category === 'park') {
      // Light cascading chimes — pentatonic, airy
      note(ctx, 1319, t,        0.8, 0.22, 'sine');
      note(ctx, 1568, t + 0.12, 0.7, 0.18, 'sine');
      note(ctx, 2093, t + 0.24, 0.6, 0.14, 'sine');
      note(ctx, 1760, t + 0.36, 0.5, 0.12, 'sine');
    } else if (category === 'memorial') {
      // Single low bell with harmonics — slow, respectful
      note(ctx, 294, t, 2.0, 0.35, 'sine');
      note(ctx, 370, t, 1.6, 0.12, 'sine');
      note(ctx, 588, t, 1.2, 0.06, 'sine');
    } else if (category === 'church') {
      // Organ chord — triangle wave for softness
      note(ctx, 392, t,        1.5, 0.25, 'triangle');
      note(ctx, 494, t,        1.5, 0.20, 'triangle');
      note(ctx, 588, t,        1.5, 0.18, 'triangle');
      note(ctx, 784, t + 0.1,  1.2, 0.12, 'triangle');
    } else if (category === 'listed') {
      // Short brass fanfare — sawtooth for texture
      note(ctx, 523,  t,        0.2, 0.2, 'sawtooth');
      note(ctx, 659,  t + 0.15, 0.2, 0.2, 'sawtooth');
      note(ctx, 784,  t + 0.30, 0.4, 0.2, 'sawtooth');
      note(ctx, 1047, t + 0.45, 0.6, 0.2, 'sawtooth');
    } else {
      // Default — gentle double chime
      note(ctx, 880,  t,        0.2, 0.3, 'sine');
      note(ctx, 1174, t + 0.18, 0.35, 0.3, 'sine');
    }
  } catch {}
}

export default function ArrivalScreen({ site, onContinue, onReadMore, isLastSite = false }) {
  const [wikiContent, setWikiContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!site) return;

    playArrivalSound(site.category);
    const t = setTimeout(() => setVisible(true), 80);

    if (site.enrichedDescription) {
      setWikiContent({
        extract: site.enrichedDescription,
        thumbnail: site.image || null,
        url: site.wikipediaUrl || null,
      });
      if (!site.image && site.wikipedia) {
        getWikipediaContent(site.wikipedia).then((wiki) => {
          if (wiki?.thumbnail) {
            setWikiContent((prev) => prev ? { ...prev, thumbnail: wiki.thumbnail, url: prev.url || wiki.url } : null);
          }
        }).catch(() => {});
      }
    } else if (site.wikipedia) {
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

    return () => clearTimeout(t);
  }, [site]);

  if (!site) return null;

  const CATEGORY_COLORS = {
    park: "#2d8a4e", memorial: "#A5513A", church: "#c9a84c",
    listed: "#1a3a5c", default: "#8E352E",
  };

  const image = wikiContent?.thumbnail || site.image || null;
  const description = wikiContent?.extract || null;
  const wikiUrl = wikiContent?.url || null;

  function handleContinue() {
    setVisible(false);
    setTimeout(() => onContinue?.(), 350);
  }

  return (
    <div
      className="mobile-site-overlay"
      style={{
        background: visible ? "rgba(26, 22, 18, 0.55)" : "rgba(26,22,18,0)",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      <div
        className="mobile-site-sheet"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="mobile-site-handle" />

        {image && (
          <img
            className="mobile-site-image"
            src={image}
            alt={site.name}
            loading="lazy"
            onError={(e) => { e.target.style.display = "none"; }}
            style={{ height: "auto", maxHeight: "220px" }}
          />
        )}

        <div className="mobile-site-content">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "#ede8e0", borderRadius: "20px", padding: "4px 10px",
            fontSize: "11px", color: "#81796f", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: "8px",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: CATEGORY_COLORS[site.category] || CATEGORY_COLORS.default,
            }} />
            {site.period || site.category}
          </div>

          <h2 className="mobile-site-name">{site.name}</h2>

          {loading ? (
            <div style={{ display: "flex", gap: "6px", padding: "8px 0" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="loading-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          ) : description ? (
            <>
              <p className="mobile-site-description">
                {description.length > 200 ? description.slice(0, 200) + "…" : description}
              </p>
              <button
                type="button"
                onClick={() => onReadMore?.({ site, description, image, wikiUrl })}
                style={{
                  background: "none", border: "none", padding: 0,
                  fontSize: "13px", color: "#A5513A", fontWeight: 600,
                  cursor: "pointer", textDecoration: "underline",
                  textUnderlineOffset: "3px", marginBottom: "4px", display: "block",
                }}
              >
                Read more about this place →
              </button>
            </>
          ) : site.category ? (
            <p className="mobile-site-description" style={{ fontStyle: "italic", color: "#81796f" }}>
              A place worth pausing at on your journey through the city.
            </p>
          ) : null}
        </div>

        <div className="mobile-site-footer">
          <button type="button" className="mobile-site-continue-btn" onClick={handleContinue}>
          {isLastSite ? "Head to destination →" : "Continue journey →"}
          </button>
        </div>
      </div>
    </div>
  );
}
