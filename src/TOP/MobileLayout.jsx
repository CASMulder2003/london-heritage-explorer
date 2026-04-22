import { useState } from "react";
import MapView from "../MAP/MapView";
import { heritageSites } from "../data/heritageSites";

export default function MobileLayout({
  startSite,
  endSite,
  safeTravelMode,
  safeRouteType,
  timeMinutes,
  stats,
  routeStops = [],
  narrativeSteps = [],
  selectedNarrativeStep,
  setSelectedNarrativeStep,
  selectedHeritage,
  setSelectedHeritage,
  selectedCue,
  setSelectedCue,
  routeType,
  setRouteType,
  handleTimeChange,
  timeStep = 30,
}) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);

  return (
    <div className="mobile-shell">
      <div className="mobile-map">
        <MapView
          startSite={startSite}
          endSite={endSite}
          heritageSites={heritageSites}
          routeStops={routeStops}
          travelMode={safeTravelMode}
          routeType={safeRouteType}
          timeMinutes={timeMinutes}
          stats={stats}
          narrativeSteps={narrativeSteps}
          selectedNarrativeStep={selectedNarrativeStep}
          setSelectedNarrativeStep={setSelectedNarrativeStep}
          selectedHeritage={selectedHeritage}
          onSelectHeritage={setSelectedHeritage}
          selectedCue={selectedCue}
          setSelectedCue={setSelectedCue}
          sourceLabel={stats?.sourceLabel}
          storyOpen={storyOpen}
          setStoryOpen={setStoryOpen}
        />
      </div>

      <div className="mobile-header">
        <div className="mobile-pill">
          {safeRouteType === "adventure" ? "Explore freely" : "Guided exploration"} ·{" "}
          {safeTravelMode === "cycle" ? "Cycle" : "Walk"}
        </div>
      </div>

      <button
        type="button"
        className="mobile-controls-toggle"
        onClick={() => setControlsOpen((prev) => !prev)}
      >
        {controlsOpen ? "Hide controls" : "Controls"}
      </button>

      {controlsOpen && (
        <div className="mobile-controls-sheet">
          <div className="mobile-controls-card">
            <div className="mobile-controls-section">
              <div className="mobile-controls-label">Route style</div>
              <div className="mobile-segmented">
                <button
                  type="button"
                  className={safeRouteType === "direct" ? "active" : ""}
                  onClick={() => setRouteType?.("direct")}
                >
                  Guided
                </button>
                <button
                  type="button"
                  className={safeRouteType === "adventure" ? "active" : ""}
                  onClick={() => setRouteType?.("adventure")}
                >
                  Exploratory
                </button>
              </div>
            </div>

            <div className="mobile-controls-section">
              <div className="mobile-controls-label">Time</div>
              <div className="mobile-time-row">
                <button type="button" onClick={() => handleTimeChange?.(-timeStep)}>
                  −
                </button>
                <div className="mobile-time-value">{timeMinutes} min</div>
                <button type="button" onClick={() => handleTimeChange?.(timeStep)}>
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mobile-bottom">
        <div className="mobile-card">
          <div>{stats?.distance}</div>
          <div>{stats?.durationMinutes} min</div>
        </div>
      </div>
    </div>
  );
}