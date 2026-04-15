const tabs = ["Journey", "Landmarks", "Saved"];

function formatTime(minutes) {
  const total = Number(minutes) || 0;
  const h = Math.floor(total / 60);
  const m = total % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${m} min`;
}

function SidebarSection({ title, children, className = "" }) {
  return (
    <section className={`sidebar-section ${className}`.trim()}>
      {title ? <div className="section-label">{title}</div> : null}
      {children}
    </section>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span className="summary-label">{label}</span>
      <span className="summary-value">{value}</span>
    </div>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  start,
  setStart,
  end,
  setEnd,
  travelMode,
  setTravelMode,
  routeType,
  setRouteType,
  timeMinutes,
  handleTimeChange,
  stats,
  locations = ["Camden Town", "UCL"],
}) {
  const routeSummary = {
    distance: stats?.distance ?? "4.8 km",
    duration:
      stats?.durationText ??
      formatTime(stats?.durationMinutes ?? timeMinutes ?? 120),
    heritageStops: stats?.heritageStops ?? 6,
    urbanFeatures: stats?.urbanFeatures ?? 14,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-title">London</div>
        <div className="app-subtitle">Heritage Explorer</div>
        <div className="app-caption">
          Explore route-based heritage stories across the city
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Journey" && (
        <>
          <SidebarSection title="Route inputs">
            <div className="control-group">
              <label className="control-label" htmlFor="start-select">
                Start
              </label>
              <div className="select-row">
                <select
                  id="start-select"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                >
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
                <span className="location-dot start-dot" />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="end-select">
                End
              </label>
              <div className="select-row">
                <select
                  id="end-select"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                >
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
                <span className="location-dot end-dot" />
              </div>
            </div>
          </SidebarSection>

          <SidebarSection title="Travel preferences">
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-pill ${
                  travelMode === "walk" ? "active" : ""
                }`}
                onClick={() => setTravelMode("walk")}
              >
                Walk
              </button>
              <button
                type="button"
                className={`toggle-pill ${
                  travelMode === "cycle" ? "active" : ""
                }`}
                onClick={() => setTravelMode("cycle")}
              >
                Cycle
              </button>
            </div>

            <div className="control-subtitle">Route type</div>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-pill ${
                  routeType === "direct" ? "active" : ""
                }`}
                onClick={() => setRouteType("direct")}
              >
                Direct
              </button>
              <button
                type="button"
                className={`toggle-pill ${
                  routeType === "adventure" ? "active" : ""
                }`}
                onClick={() => setRouteType("adventure")}
              >
                Adventure
              </button>
            </div>
          </SidebarSection>

          {routeType === "adventure" && (
            <SidebarSection title="Available time" className="time-card">
              <div className="time-stepper">
                <button
                  type="button"
                  className="step-button"
                  onClick={() => handleTimeChange(-30)}
                  aria-label="Decrease available time"
                >
                  −
                </button>

                <div className="time-display">{formatTime(timeMinutes)}</div>

                <button
                  type="button"
                  className="step-button"
                  onClick={() => handleTimeChange(30)}
                  aria-label="Increase available time"
                >
                  +
                </button>
              </div>
            </SidebarSection>
          )}

          <SidebarSection title="Route summary" className="summary-card">
            <SummaryRow label="Distance" value={routeSummary.distance} />
            <SummaryRow label="Duration" value={routeSummary.duration} />
            <SummaryRow
              label="Heritage stops"
              value={routeSummary.heritageStops}
            />
            <SummaryRow
              label="Urban features"
              value={routeSummary.urbanFeatures}
            />

            <div className="route-note">
              {routeType === "direct"
                ? "Direct prioritises a faster, more functional route."
                : "Adventure prioritises a richer, more exploratory journey."}
            </div>
          </SidebarSection>

          <SidebarSection title="Map legend">
            <div className="legend-group primary">
              <div className="legend-item">
                <span className="legend-dot heritage-dot" />
                <span>Heritage sites</span>
              </div>
            </div>

            <div className="legend-group">
              <div className="legend-item">
                <span className="legend-dot bus-dot" />
                <span>Bus stops</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot tree-dot" />
                <span>Trees</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot bench-dot" />
                <span>Benches</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot signal-dot" />
                <span>Signals</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot lamp-dot" />
                <span>Street lamps</span>
              </div>
            </div>
          </SidebarSection>
        </>
      )}

      {activeTab === "Landmarks" && (
        <div className="tab-panel-placeholder">
          <h3>Landmarks</h3>
          <p>Browse heritage sites along the selected route.</p>
        </div>
      )}

      {activeTab === "Saved" && (
        <div className="tab-panel-placeholder">
          <h3>Saved</h3>
          <p>Keep favourite places and routes here.</p>
        </div>
      )}
    </aside>
  );
}