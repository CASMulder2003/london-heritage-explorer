import { useState } from "react";
import AddressSearch from "../components/AddressSearch";

const TABS = ["Your Journey", "Sites"];

const CATEGORY_COLORS = {
  park:     "#2d8a4e",
  memorial: "#A5513A",
  church:   "#c9a84c",
  listed:   "#1a3a5c",
  default:  "#8E352E",
};

function formatTime(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

function formatWalkTime(minutes) {
  if (!minutes) return null;
  if (minutes < 1) return "< 1 min walk";
  return `${minutes} min walk`;
}

export default function Sidebar({
  activeTab, setActiveTab, start, setStart, end, setEnd,
  swapLocations, travelMode, setTravelMode, routeType, setRouteType,
  timeMinutes, handleTimeChange, timeStep = 15,
  routeStops = [], anchorItems = [], selectedSite, setSelectedSite,
  stats,
}) {
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-title">London Heritage Explorer</div>
        <div className="app-subtitle">Explore the city through everyday cues</div>
      </div>

      <div className="tab-bar">
        {TABS.map((tab) => (
          <button key={tab} type="button" className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Your Journey" && (
        <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1 }}>

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
                  <span className="location-status-dot" style={{ background: locationStatus === "denied" ? "#A5513A" : locationStatus === "granted" ? "#4a8c6a" : "#c4b89e", animation: locationStatus === "requesting" ? "pulse 1.2s ease infinite" : "none" }} />
                  {locationStatus === "requesting" ? "Finding location…" : locationStatus === "denied" ? "Location unavailable — try again" : "Use my current location"}
                </button>
                <AddressSearch value={start} onChange={setStart} placeholder="Or type a start address…" dotColor="#5A7A8C" />
              </>
            )}
          </div>

          {/* SWAP */}
          <div className="swap-row">
            <button type="button" className="swap-button" onClick={swapLocations}>Change direction</button>
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
          </div>

          {/* TIME — greyed out in direct mode */}
          <div style={{ opacity: isDirect ? 0.4 : 1, pointerEvents: isDirect ? "none" : "auto", transition: "opacity 0.2s" }}>
            <div className="control-subtitle" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              Time available
              {isDirect && (
                <span style={{ fontSize: "10px", color: "#A5513A", background: "#fdf0eb", padding: "2px 8px", borderRadius: "10px", fontWeight: 600, letterSpacing: "0.04em" }}>
                  Not used in Direct mode
                </span>
              )}
            </div>
            <div className="time-stepper">
              <button type="button" className="step-button" onClick={() => handleTimeChange(-timeStep)} tabIndex={isDirect ? -1 : 0}>−</button>
              <div className="time-display">{formatTime(timeMinutes)}</div>
              <button type="button" className="step-button" onClick={() => handleTimeChange(timeStep)} tabIndex={isDirect ? -1 : 0} disabled={timeMinutes >= 120}>+</button>
            </div>
          </div>

          {/* Route summary */}
          {stats?.distance && stats.distance !== "—" && (
            <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.6)", borderRadius: "12px", border: "1px solid #e0d8cc", fontSize: "12px", color: "#5d564f" }}>
              {stats.distance}
              {stats.durationMinutes > 0 && ` · approx ${formatTime(stats.durationMinutes)}`}
              {routeStops.length > 2 && ` · ${routeStops.length - 2} site${routeStops.length - 2 !== 1 ? "s" : ""} on route`}
            </div>
          )}
        </div>
      )}

      {activeTab === "Sites" && (
        <>
          {/* Sticky header — does not scroll */}
          <div style={{ padding: "14px 18px 8px", flexShrink: 0, borderBottom: "1px solid rgba(228,221,209,0.6)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", color: "#1f1f1f" }}>Sites on your route</h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#81796f", lineHeight: 1.5, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
              Tap a site to explore it on the map.
            </p>
          </div>

          {/* Scrollable list only */}
          <div style={{ overflowY: "auto", flex: 1, padding: "10px 18px 18px" }}>
            {routeStops.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {anchorItems.map((item, i) => {
                  const site = item.raw;
                  const isActive = selectedSite?.id === site.id || selectedSite?.name === site.name;
                  const color = CATEGORY_COLORS[site.category] || CATEGORY_COLORS.default;
                  const label = item.order === 0 ? "S" : item.order === routeStops.length - 1 ? "E" : String(item.order);

                  return (
                    <div key={item.id}>
                      {i > 0 && item.minutesFromPrev > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0 4px 14px" }}>
                          <div style={{ width: "1px", height: "20px", background: "#e0d8cc", flexShrink: 0 }} />
                          <span style={{ fontSize: "11px", color: "#c4b89e", fontStyle: "italic" }}>
                            {formatWalkTime(item.minutesFromPrev)}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedSite?.(site)}
                        style={{
                          display: "flex", gap: "10px", alignItems: "flex-start",
                          padding: "10px 12px",
                          border: `1px solid ${isActive ? color + "66" : "#e1dbcf"}`,
                          borderRadius: "14px",
                          background: isActive ? `${color}0d` : "rgba(255,253,250,0.88)",
                          cursor: "pointer", textAlign: "left", width: "100%",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span style={{
                          minWidth: "26px", height: "26px", borderRadius: "50%",
                          background: color, color: "white",
                          fontSize: "11px", fontWeight: 700,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f1f1f", marginBottom: "2px" }}>{site.name}</div>
                          <div style={{ fontSize: "11px", color: "#7a7268", textTransform: "uppercase", letterSpacing: "0.06em" }}>{site.period}</div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#736c63", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                Plan a route to see heritage sites.
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
