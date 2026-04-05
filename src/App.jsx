import { useMemo, useState } from "react";
import HeritagePopup from "./components/HeritagePopup";
import MapView from "./components/MapView";
import { heritageSites } from "./data/heritageSites";

const tabs = ["Journey", "Landmarks", "Saved"];

const css = `
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f3f1ec;
    color: #1f1f1f;
  }

  button,
  input {
    font: inherit;
  }

  .app {
    min-height: 100vh;
    display: flex;
    background: #f3f1ec;
  }

  .sidebar {
    width: 340px;
    background: #fcfbf8;
    border-right: 1px solid #ddd6ca;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 22px 20px 12px;
    border-bottom: 1px solid #e3ddd2;
  }

  .app-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .app-subtitle {
    margin-top: 2px;
    color: #6d675f;
    font-size: 15px;
  }

  .tab-bar {
    display: flex;
    gap: 12px;
    padding: 0 20px;
    border-bottom: 1px solid #e3ddd2;
  }

  .tab {
    padding: 12px 0;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: #7b746a;
    cursor: pointer;
  }

  .tab.active {
    color: #222;
    border-bottom-color: #222;
    font-weight: 600;
  }

  .panel {
    padding: 18px 20px;
    border-bottom: 1px solid #ece6dc;
  }

  .field-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #81796f;
    margin-bottom: 6px;
  }

  .field-input {
    width: 100%;
    border: 1px solid #d7d0c5;
    border-radius: 12px;
    background: white;
    padding: 12px 14px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .field-input input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: #252525;
  }

  .pin {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .pin-start {
    background: #3b6d11;
  }

  .pin-end {
    background: #a32d2d;
  }

  .section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #81796f;
    margin-bottom: 8px;
  }

  .segmented {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
  }

  .segmented button {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #d7d0c5;
    background: white;
    cursor: pointer;
    color: #4f4a43;
  }

  .segmented button.active {
    background: #222;
    color: white;
    border-color: #222;
    font-weight: 600;
  }

  .time-box {
    border: 1px solid #d7d0c5;
    border-radius: 12px;
    padding: 12px;
    background: white;
    transition: opacity 0.2s ease;
  }

  .time-box.disabled {
    opacity: 0.35;
  }

  .time-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .time-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .time-btn {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid #d7d0c5;
    background: #faf8f5;
    cursor: pointer;
  }

  .time-display {
    min-width: 90px;
    text-align: center;
    font-weight: 600;
    color: #534ab7;
  }

  .legend-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .legend-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #5d564f;
  }

  .legend-dot,
  .legend-square {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }

  .legend-dot {
    border-radius: 999px;
  }

  .legend-square {
    border-radius: 2px;
  }

  .ld-tree { background: #3b6d11; }
  .ld-bus { background: #a32d2d; }
  .ld-signal { background: #ba7517; }
  .ld-bench { background: #5f5e5a; }
  .ld-lamp { background: #185fa5; }
  .ld-heritage { background: #7f77dd; }

  .route-info {
    margin-top: auto;
    padding: 18px 20px 20px;
  }

  .route-stats {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .stat-card {
    flex: 1;
    padding: 10px;
    background: #f4f1eb;
    border: 1px solid #e2dbcf;
    border-radius: 12px;
    text-align: center;
  }

  .stat-val {
    font-size: 16px;
    font-weight: 700;
    color: #222;
  }

  .stat-lbl {
    margin-top: 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7d766e;
  }

  .go-btn {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #d7d0c5;
    background: white;
    cursor: pointer;
    font-weight: 600;
  }

  .map-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #f5f0e8;
  }

  .map-canvas {
    width: 100%;
    height: 100vh;
    display: block;
  }

  .heritage-popup {
    position: absolute;
    right: 20px;
    bottom: 20px;
    width: 260px;
    background: white;
    border: 1px solid #ddd6ca;
    border-radius: 16px;
    padding: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  }

  .popup-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 999px;
    background: #f2efe8;
    cursor: pointer;
    color: #615b54;
  }

  .popup-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #eeedfe;
    color: #534ab7;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .popup-img {
    width: 100%;
    height: 82px;
    border-radius: 12px;
    background: #f3f0e9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8a8379;
    font-size: 12px;
    margin-bottom: 10px;
  }

  .popup-name {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 6px;
  }

  .popup-desc {
    font-size: 12px;
    line-height: 1.55;
    color: #5d564f;
  }

  @media (max-width: 900px) {
    .app {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
    }

    .map-canvas {
      height: 72vh;
    }

    .route-stats {
      flex-direction: column;
    }

    .legend-items {
      grid-template-columns: 1fr;
    }
  }
`;

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h} hrs`;
  }
  return `${m} min`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Journey");
  const [start, setStart] = useState("9 Approach Road, Camden");
  const [end, setEnd] = useState("UCL, Gower Street, WC1");
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("adventure");
  const [timeMinutes, setTimeMinutes] = useState(120);
  const [selectedSite, setSelectedSite] = useState(heritageSites[4]);
  const [showPopup, setShowPopup] = useState(true);

  const stats = useMemo(() => {
    const stops =
      routeType === "adventure" ? Math.min(8, Math.floor(timeMinutes / 25)) : 2;

    const time =
      travelMode === "walk"
        ? Math.round(timeMinutes * 0.8)
        : Math.round(timeMinutes * 0.5);

    const distance =
      travelMode === "walk"
        ? (stops * 0.5).toFixed(1)
        : (stops * 0.8).toFixed(1);

    return {
      stops,
      time,
      distance,
    };
  }, [travelMode, routeType, timeMinutes]);

  const handleTimeChange = (delta) => {
    setTimeMinutes((prev) => Math.max(30, Math.min(300, prev + delta)));
  };

  const handleSelectSite = (site) => {
    setSelectedSite(site);
    setShowPopup(true);
  };

  return (
    <>
      <style>{css}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="app-title">London</div>
            <div className="app-subtitle">Heritage Explorer</div>
          </div>

          <div className="tab-bar">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="panel">
            <div className="field-label">Start</div>
            <div className="field-input">
              <input value={start} onChange={(e) => setStart(e.target.value)} />
              <div className="pin pin-start" />
            </div>

            <div className="field-label">End</div>
            <div className="field-input" style={{ marginBottom: 0 }}>
              <input value={end} onChange={(e) => setEnd(e.target.value)} />
              <div className="pin pin-end" />
            </div>
          </div>

          <div className="panel">
            <div className="section-title">Travel mode</div>
            <div className="segmented">
              <button
                className={travelMode === "walk" ? "active" : ""}
                onClick={() => setTravelMode("walk")}
              >
                Walk
              </button>
              <button
                className={travelMode === "cycle" ? "active" : ""}
                onClick={() => setTravelMode("cycle")}
              >
                Cycle
              </button>
            </div>

            <div className="section-title">Route type</div>
            <div className="segmented" style={{ marginBottom: 12 }}>
              <button
                className={routeType === "direct" ? "active" : ""}
                onClick={() => setRouteType("direct")}
              >
                Direct
              </button>
              <button
                className={routeType === "adventure" ? "active" : ""}
                onClick={() => setRouteType("adventure")}
              >
                Adventure
              </button>
            </div>

            <div
              className={`time-box ${
                routeType === "direct" ? "disabled" : ""
              }`}
            >
              <div className="section-title" style={{ marginBottom: 10 }}>
                Available time
              </div>
              <div className="time-row">
                <div className="time-controls">
                  <button
                    className="time-btn"
                    onClick={() => handleTimeChange(-30)}
                    disabled={routeType === "direct"}
                  >
                    −
                  </button>
                  <div className="time-display">{formatTime(timeMinutes)}</div>
                  <button
                    className="time-btn"
                    onClick={() => handleTimeChange(30)}
                    disabled={routeType === "direct"}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="legend-title">Map legend</div>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-dot ld-heritage" />
                Heritage sites
              </div>
              <div className="legend-item">
                <div className="legend-dot ld-tree" />
                Trees
              </div>
              <div className="legend-item">
                <div className="legend-dot ld-bus" />
                Bus stops
              </div>
              <div className="legend-item">
                <div className="legend-dot ld-signal" />
                Signals
              </div>
              <div className="legend-item">
                <div className="legend-square ld-bench" />
                Benches
              </div>
              <div className="legend-item">
                <div className="legend-dot ld-lamp" />
                Street lamps
              </div>
            </div>
          </div>

          <div className="route-info">
            <div className="route-stats">
              <div className="stat-card">
                <div className="stat-val">{stats.stops}</div>
                <div className="stat-lbl">Heritage stops</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.time} min</div>
                <div className="stat-lbl">Est. time</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{stats.distance} km</div>
                <div className="stat-lbl">Distance</div>
              </div>
            </div>

            <button
              className="go-btn"
              onClick={() =>
                alert(
                  "Later you can connect this button to route generation, external APIs, or a detail panel."
                )
              }
            >
              Generate route ↗
            </button>
          </div>
        </aside>

        <main className="map-area">
          <MapView
            routeType={routeType}
            heritageSites={heritageSites}
            selectedSite={selectedSite}
            showPopup={showPopup}
            onSelectSite={handleSelectSite}
          />

          <HeritagePopup
            site={selectedSite}
            showPopup={showPopup}
            onClose={() => setShowPopup(false)}
          />
        </main>
      </div>
    </>
  );
}