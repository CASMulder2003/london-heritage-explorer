import Sidebar from "../panel/Sidebar";
import MapView from "../MAP/MapView";

export default function DesktopLayout({
  isPanelOpen,
  setIsPanelOpen,
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
  locations,
  selectedHeritage,
  setSelectedHeritage,
  startSite,
  endSite,
  safeTravelMode,
  safeRouteType,
  heritageSites,
  routeStops,
  anchorItems,
  segments,
  cueGroups,
  narrativeSteps,
  selectedNarrativeStep,
  setSelectedNarrativeStep,
  selectedCue,
  setSelectedCue,
  storyOpen,
  setStoryOpen,
}) {
  return (
    <div className="app-shell">
      <div className={`panel-shell ${isPanelOpen ? "open" : "closed"}`}>
        <button
          type="button"
          className="panel-toggle"
          onClick={() => setIsPanelOpen((prev) => !prev)}
          aria-label={isPanelOpen ? "Close controls" : "Open controls"}
        >
          {isPanelOpen ? "Close" : "Journey"}
        </button>

        {isPanelOpen && (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            start={start}
            setStart={setStart}
            end={end}
            setEnd={setEnd}
            swapLocations={swapLocations}
            travelMode={travelMode}
            setTravelMode={setTravelMode}
            routeType={routeType}
            setRouteType={setRouteType}
            timeMinutes={timeMinutes}
            handleTimeChange={handleTimeChange}
            timeStep={timeStep}
            stats={stats}
            locations={locations}
            selectedHeritage={selectedHeritage}
            setSelectedHeritage={setSelectedHeritage}
            heritageSites={heritageSites}
            routeStops={routeStops}
            anchorItems={anchorItems}
            segments={segments}
            cueGroups={cueGroups}
            narrativeSteps={narrativeSteps}
            selectedNarrativeStep={selectedNarrativeStep}
            setSelectedNarrativeStep={setSelectedNarrativeStep}
            selectedCue={selectedCue}
            setSelectedCue={setSelectedCue}
            startSite={startSite}
            endSite={endSite}
            safeTravelMode={safeTravelMode}
            safeRouteType={safeRouteType}
          />
        )}
      </div>

      <div className="map-panel">
      <MapView
  startSite={startSite}
  endSite={endSite}
  heritageSites={heritageSites}
  routeStops={routeStops}
  travelMode={safeTravelMode}
  routeType={safeRouteType}
  timeMinutes={timeMinutes}
  stats={stats}
  onSelectHeritage={setSelectedHeritage}
  selectedHeritage={selectedHeritage}
  narrativeSteps={narrativeSteps}
  selectedNarrativeStep={selectedNarrativeStep}
  setSelectedNarrativeStep={setSelectedNarrativeStep}
  sourceLabel={stats?.sourceLabel || "Mapbox"}
  storyOpen={storyOpen}
  setStoryOpen={setStoryOpen}
/>
      </div>
    </div>
  );
}