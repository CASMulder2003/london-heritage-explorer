export default function OverviewScreen({ stats, routeStops, travelMode, timeMinutes, onBegin }) {
  return (
    <>
      <div className="mobile-nav-top-bar">
        <div className="mobile-nav-badge">
          {travelMode === "cycle" ? "Cycle" : "Walk"} · {timeMinutes}min
        </div>
      </div>

      <div className="mobile-overview-overlay">
        <div className="mobile-overview-handle" />

        <div className="mobile-overview-pill">
          {travelMode === "cycle" ? "Cycle" : "Walk"} · {timeMinutes} min available
        </div>

        <div className="mobile-overview-stats">
          <span>{stats?.distance || "—"}</span>
          <span>·</span>
          <span>{routeStops.length} {routeStops.length === 1 ? "stop" : "stops"}</span>
        </div>

        <p className="mobile-overview-hint">
          You'll be guided by spatial cues. No route line — just the city around you.
          Heritage anchors mark moments worth pausing at.
        </p>

        <button type="button" className="mobile-begin-btn" onClick={onBegin}>
          Begin walking
        </button>
      </div>
    </>
  );
}
