import { useEffect, useState } from "react";

// Renders before anything else.
// Background matches body (#2c2318) so there is never a white flash.
// Text fades in, then fades out — the overlay itself never changes opacity,
// so the background underneath is always the same dark colour.
export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState("in"); // in | visible | out | done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 100);
    const t2 = setTimeout(() => setPhase("out"), 2600);
    const t3 = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  // Once done, render nothing — background colour on body handles the gap
  if (phase === "done") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#2c2318",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "2rem",
          opacity: phase === "in" || phase === "out" ? 0 : 1,
          transform: phase === "in" ? "translateY(10px)" : "translateY(0)",
          transition: phase === "out"
            ? "opacity 0.5s ease"
            : "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
        }}
      >
        <div style={{
          fontFamily: "Georgia, serif",
          fontSize: "0.65rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#8b7355",
          marginBottom: "1.2rem",
        }}>
          Spatial Data Story
        </div>

        <h1 style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(2.2rem, 8vw, 3.6rem)",
          fontWeight: 400,
          color: "#f3ede3",
          lineHeight: 1.1,
          margin: "0 0 1.2rem",
        }}>
          London<br />Heritage<br />Explorer
        </h1>

        <p style={{
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          fontSize: "0.92rem",
          color: "#8b7355",
          margin: "0 0 1.6rem",
        }}>
          Your city, seen slowly.
        </p>

        <div style={{ width: "28px", height: "1px", background: "#8b7355", margin: "0 auto" }} />
      </div>
    </div>
  );
}
