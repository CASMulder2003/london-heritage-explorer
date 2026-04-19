import { useMemo } from "react";
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
  const visibleHeritageSites = useMemo(() => {
    if (!startSite || !endSite) return [];

    const uniqueSites = (sites) =>
      sites.filter(
        (site, index, arr) =>
          arr.findIndex((s) => s.lng === site.lng && s.lat === site.lat) === index
      );

    const routeLength = Math.hypot(
      endSite.lng - startSite.lng,
      endSite.lat - startSite.lat
    );

    const rankedSites = heritageSites
      .filter((site) => site.name !== startSite.name && site.name !== endSite.name)
      .map((site) => {
        const distToStart = Math.hypot(
          site.lng - startSite.lng,
          site.lat - startSite.lat
        );
        const distToEnd = Math.hypot(
          site.lng - endSite.lng,
          site.lat - endSite.lat
        );
        const routeBalance = Math.abs(distToStart - distToEnd);
        const baseWeight = site.cueWeight || 0;
        const adventureBoost = site.adventure ? 2.5 : 0;
        const guidedPenalty = site.adventure ? 0.6 : 0;

        const directionBias =
          ((site.lat - startSite.lat) * (endSite.lat - startSite.lat) +
            (site.lng - startSite.lng) * (endSite.lng - startSite.lng)) *
          0.3;

        return {
          ...site,
          routeScore:
            routeType === "adventure"
              ? routeBalance - baseWeight * 0.08 - adventureBoost - directionBias
              : routeBalance + guidedPenalty - baseWeight * 0.01,
        };
      })
      .sort((a, b) => a.routeScore - b.routeScore);

    if (routeType === "direct") {
      const guidedCount =
        timeMinutes <= 60 ? 1 : timeMinutes <= 120 ? 2 : 3;

      return uniqueSites([
        startSite,
        ...rankedSites.slice(0, guidedCount),
        endSite,
      ]);
    }

    const exploratoryCount =
      timeMinutes <= 30
        ? 1
        : timeMinutes <= 60
        ? 2
        : timeMinutes <= 90
        ? 3
        : timeMinutes <= 120
        ? 4
        : timeMinutes <= 180
        ? 5
        : 6;

    const exploratoryCandidates = rankedSites.filter(
      (site) => site.adventure || site.cueWeight >= 2 || routeLength > 0.025
    );

    return uniqueSites([
      startSite,
      ...exploratoryCandidates.slice(0, exploratoryCount),
      endSite,
    ]);
  }, [startSite, endSite, routeType, timeMinutes]);

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
            visibleHeritageSites={visibleHeritageSites}
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
          sourceLabel={stats?.sourceLabel || "Mapbox"}
        />
      </main>
    </div>
  );
}