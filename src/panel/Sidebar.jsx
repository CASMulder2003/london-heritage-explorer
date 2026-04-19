const tabs = ["Journey", "Anchors"];

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
  locations = [],
  routeStops = [],
  anchorItems = [],
  selectedHeritage,
  setSelectedHeritage,
  selectedCue,
  setSelectedCue,
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

{activeTab === "Anchors" && (
  <div className="tab-panel-placeholder">
    <h3>Anchors</h3>
    <p>Key heritage stops and spatial cues along this route.</p>

    {anchorItems.length > 0 ? (
      <div className="landmark-list">
        {anchorItems.map((item) => {
          if (item.kind === "heritage") {
            const site = item.raw;
            const isActive = selectedHeritage?.id === site?.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`landmark-row ${isActive ? "active" : ""}`}
                onClick={() => {
                  setSelectedCue?.(null);
                  setSelectedHeritage?.(site);
                }}
              >
                <span className="landmark-number">{item.order}</span>

                <span className="landmark-copy">
                  <span className="landmark-name">{item.name}</span>
                  <span className="landmark-meta">{item.period}</span>
                  <span className="landmark-desc">{item.description}</span>
                </span>
              </button>
            );
          }

          return (
<button
  key={item.id}
  type="button"
  className={`landmark-row cue-row ${
    selectedCue?.id === item.raw?.id ? "active" : ""
  }`}
  onClick={() => {
    setSelectedHeritage?.(null);
    setSelectedCue?.(item.raw);
  }}
>
  <span className="landmark-number cue-number">•</span>

  <span className="landmark-copy">
    <span className="landmark-name cue-name">{item.name}</span>
    <span className="landmark-meta">{item.period}</span>
    <span className="landmark-desc">{item.description}</span>
  </span>
</button>
          );
        })}
      </div>
    ) : (
      <p className="empty-state">No anchors available for this route.</p>
    )}
  </div>
)}
    </aside>
  );
}