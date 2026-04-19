const tabs = ["Journey", "Landmarks"];

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

export default function Sidebar({
  activeTab,
  setActiveTab,
  start,
  setStart,
  end,
  setEnd,
  swapLocations,
  travelMode,
  setTravelMode,
  routeType,
  setRouteType,
  timeMinutes,
  handleTimeChange,
  timeStep = 30,
  stats,
  locations = [],
  visibleHeritageSites = [],
  selectedHeritage,
  onSelectHeritage,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-title">London Heritage Explorer</div>
        <div className="app-subtitle">Explore the city through everyday cues</div>
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
          <SidebarSection title="Explore area">
            <div className="control-group">
              <label className="control-label" htmlFor="start-select">
                From
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

            <div className="swap-row">
              <button
                type="button"
                className="swap-button"
                onClick={swapLocations}
              >
                Change direction
              </button>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="end-select">
                To
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

          <SidebarSection title="How you explore">
            <div className="control-subtitle">Move</div>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-pill ${travelMode === "walk" ? "active" : ""}`}
                onClick={() => setTravelMode("walk")}
              >
                Walk
              </button>
              <button
                type="button"
                className={`toggle-pill ${travelMode === "cycle" ? "active" : ""}`}
                onClick={() => setTravelMode("cycle")}
              >
                Cycle
              </button>
            </div>

            <div className="control-subtitle route-type-label">Exploration style</div>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-pill ${routeType === "direct" ? "active" : ""}`}
                onClick={() => setRouteType("direct")}
              >
                Guided
              </button>
              <button
                type="button"
                className={`toggle-pill ${routeType === "adventure" ? "active" : ""}`}
                onClick={() => setRouteType("adventure")}
              >
                Exploratory
              </button>
            </div>
          </SidebarSection>

          {routeType === "adventure" && (
            <SidebarSection
              title="How much time do you have?"
              className="time-card"
            >
              <div className="time-stepper">
                <button
                  type="button"
                  className="step-button"
                  onClick={() => handleTimeChange(-timeStep)}
                  aria-label="Decrease available time"
                >
                  −
                </button>

                <div className="time-display">{formatTime(timeMinutes)}</div>

                <button
                  type="button"
                  className="step-button"
                  onClick={() => handleTimeChange(timeStep)}
                  aria-label="Increase available time"
                >
                  +
                </button>
              </div>
            </SidebarSection>
          )}
        </>
      )}

      {activeTab === "Landmarks" && (
        <div className="tab-panel-placeholder">
          <h3>Landmarks</h3>
          <p>Tap a place to uncover its story.</p>

          <div className="landmark-list">
            {visibleHeritageSites.length > 0 ? (
              visibleHeritageSites.map((site, index) => (
                <div
                  key={site.id || site.name}
                  className={`landmark-row ${
                    selectedHeritage?.name === site.name ? "active" : ""
                  }`}
                  onClick={() => onSelectHeritage?.(site)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onSelectHeritage?.(site);
                    }
                  }}
                >
                  <span className="landmark-number">{index + 1}</span>
                  <div className="landmark-copy">
                    <div className="landmark-name">{site.name}</div>
                    <div className="landmark-meta">{site.period}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">No landmarks available.</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}