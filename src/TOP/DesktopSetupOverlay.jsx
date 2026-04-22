import { useState } from "react";
import AddressSearch from "../components/AddressSearch";

const TIME_OPTIONS = [30, 45, 60, 90, 120];

function formatTime(m) {
  const h = Math.floor(m / 60), min = m % 60;
  if (h > 0) return min > 0 ? `${h}h ${min}m` : `${h}h`;
  return `${min}m`;
}

export default function DesktopSetupOverlay({ onStart }) {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("exploratory");
  const [timeMinutes, setTimeMinutes] = useState(60);
  const [locationStatus, setLocationStatus] = useState("idle");

  function requestLiveLocation() {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationStatus("granted");
        setStart({ name: "Your current location", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    setLocationStatus("requesting");
  }

  const isLive = typeof start === "object" && start?.name === "Your current location";
  const isDirect = routeType === "direct";
  const canStart = start && end && typeof end === "object" && end.lat;

  return (
    <div className="desktop-overlay">
      <div className="desktop-overlay-card">
        <h1 className="desktop-overlay-title">London Heritage Explorer</h1>
        <p className="desktop-overlay-subtitle">Discover the city through its everyday cues and heritage</p>

        <div className="desktop-overlay-fields">

          {/* FROM */}
          <div>
            <div className="control-label">From</div>
            {isLive ? (
              <div className="address-confirmed">
                <span className="address-confirmed-dot" style={{ background: "#4a8c6a", boxShadow: "0 0 0 3px #4a8c6a22" }} />
                <span className="address-confirmed-name">Your current location</span>
                <button type="button" className="address-change-btn" onClick={() => { setStart(null); setLocationStatus("idle"); }}>Change</button>
              </div>
            ) : (
              <>
                <button type="button" className="live-location-btn" onClick={requestLiveLocation} disabled={locationStatus === "requesting"}>
                  <span className="location-status-dot" style={{ background: locationStatus === "denied" ? "#A5513A" : "#c4b89e", animation: locationStatus === "requesting" ? "pulse 1.2s ease infinite" : "none" }} />
                  {locationStatus === "requesting" ? "Finding location…" : locationStatus === "denied" ? "Location unavailable — try again" : "Use my current location"}
                </button>
                <AddressSearch value={start} onChange={setStart} placeholder="Or type a starting address…" dotColor="#5A7A8C" />
              </>
            )}
          </div>

          {/* TO */}
          <div>
            <div className="control-label">To</div>
            <AddressSearch value={end} onChange={setEnd} placeholder="Where are you heading?" dotColor="#A5513A" />
          </div>

          {/* HOW */}
          <div>
            <div className="control-subtitle">How</div>
            <div className="toggle-group">
              <button type="button" className={`toggle-pill ${travelMode === "walk" ? "active" : ""}`} onClick={() => setTravelMode("walk")}>Walk</button>
              <button type="button" className={`toggle-pill ${travelMode === "cycle" ? "active" : ""}`} onClick={() => setTravelMode("cycle")}>Cycle</button>
            </div>
          </div>

          {/* ROUTE TYPE */}
          <div>
            <div className="control-subtitle">Route type</div>
            <div className="toggle-group">
              <button type="button" className={`toggle-pill ${routeType === "exploratory" ? "active" : ""}`} onClick={() => setRouteType("exploratory")}>Exploratory</button>
              <button type="button" className={`toggle-pill ${routeType === "direct" ? "active" : ""}`} onClick={() => setRouteType("direct")}>Direct</button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#81796f", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
              {isDirect
                ? "Shortest route — shows sites directly on your path."
                : "Wanders through heritage sites within your time budget."}
            </p>
          </div>

          {/* TIME — greyed in direct mode */}
          <div style={{ opacity: isDirect ? 0.4 : 1, pointerEvents: isDirect ? "none" : "auto", transition: "opacity 0.2s" }}>
            <div className="control-subtitle" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              Time available
              {isDirect && (
                <span style={{ fontSize: "10px", color: "#A5513A", background: "#fdf0eb", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                  Not used in Direct
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {TIME_OPTIONS.map((t) => (
                <button key={t} type="button"
                  className={`toggle-pill ${timeMinutes === t ? "active" : ""}`}
                  style={{ flex: "none", padding: "8px 14px" }}
                  onClick={() => setTimeMinutes(t)}
                  tabIndex={isDirect ? -1 : 0}
                >
                  {formatTime(t)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="desktop-overlay-plan-btn"
            onClick={() => canStart && onStart({ start, end, travelMode, routeType, timeMinutes })}
            disabled={!canStart}
          >
            Plan route
          </button>
        </div>
      </div>
    </div>
  );
}
