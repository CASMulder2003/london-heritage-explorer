import Sidebar from "./Sidebar";
import MapView from "./MapView";
import { heritageSites } from "../data/heritageSites";

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

        {isPanelOpen ? (
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
            onSelectHeritage={setSelectedHeritage}
          />
        ) : null}
      </div>

      <main className="map-panel">
        <MapView
          startSite={startSite}
          endSite={endSite}
          heritageSites={heritageSites}
          travelMode={safeTravelMode}
          routeType={safeRouteType}
          timeMinutes={timeMinutes}
          stats={stats}
          onSelectHeritage={setSelectedHeritage}
          selectedHeritage={selectedHeritage}
          sourceLabel={stats.sourceLabel}
        />
      </main>
    </div>
  );
}