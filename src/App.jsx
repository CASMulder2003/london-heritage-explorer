import { useMemo, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import MapView from "./components/MapView";
import HeritagePopup from "./components/HeritagePopup";

import { heritageSites } from "./data/heritageSites";
import { getMockRoute } from "./data/mockRoute";

const DEFAULT_START = "Camden Town";
const DEFAULT_END = "UCL";
const DEFAULT_TAB = "Journey";

function normalizeRouteType(routeType) {
  const value = String(routeType || "").toLowerCase();
  return value === "direct" ? "direct" : "adventure";
}

function normalizeTravelMode(travelMode) {
  const value = String(travelMode || "").toLowerCase();
  return value === "cycle" ? "cycle" : "walk";
}

function toMockTravelMode(mode) {
  return mode === "cycle" ? "cycling" : "walking";
}

export default function App() {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("adventure");
  const [timeMinutes, setTimeMinutes] = useState(120);
  const [selectedHeritage, setSelectedHeritage] = useState(null);

  const safeRouteType = normalizeRouteType(routeType);
  const safeTravelMode = normalizeTravelMode(travelMode);

  const handleTimeChange = (delta) => {
    setTimeMinutes((prev) => {
      const next = prev + delta;
      return Math.min(240, Math.max(30, next));
    });
  };

  const routeResult = useMemo(() => {
    return getMockRoute({
      startText: start,
      endText: end,
      travelMode: toMockTravelMode(safeTravelMode),
      routeType: safeRouteType,
      availableTime: timeMinutes,
    });
  }, [start, end, safeTravelMode, safeRouteType, timeMinutes]);

  const displayedRoute = routeResult?.geometry ?? [];

  const displayedHeritageSites = useMemo(() => {
    if (!Array.isArray(heritageSites)) return [];

    if (safeRouteType === "direct") {
      return heritageSites.slice(0, 4);
    }

    return heritageSites;
  }, [safeRouteType]);

  const routeStats = useMemo(() => {
    const distanceKm = routeResult?.summary?.distance
      ? `${(routeResult.summary.distance / 1000).toFixed(1)} km`
      : "4.8 km";

    const durationMinutes = routeResult?.summary?.duration
      ? Math.round(routeResult.summary.duration / 60)
      : timeMinutes;

    return {
      distance: distanceKm,
      durationMinutes,
      heritageStops: displayedHeritageSites.length,
      urbanFeatures: 16,
      sourceLabel: routeResult?.meta?.source ?? "mock",
    };
  }, [routeResult, displayedHeritageSites.length, timeMinutes]);

  const locations = useMemo(() => {
    const fixedLocations = [DEFAULT_START, DEFAULT_END];
    const siteNames = Array.isArray(heritageSites)
      ? heritageSites.map((site) => site?.name).filter(Boolean)
      : [];

    return [...new Set([...fixedLocations, ...siteNames])];
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        start={start}
        setStart={setStart}
        end={end}
        setEnd={setEnd}
        travelMode={safeTravelMode}
        setTravelMode={setTravelMode}
        routeType={safeRouteType}
        setRouteType={setRouteType}
        timeMinutes={timeMinutes}
        handleTimeChange={handleTimeChange}
        stats={routeStats}
        locations={locations}
      />

      <main className="map-panel">
        <MapView
          start={start}
          end={end}
          travelMode={safeTravelMode}
          routeType={safeRouteType}
          route={displayedRoute}
          heritageSites={displayedHeritageSites}
          selectedHeritage={selectedHeritage}
          onSelectHeritage={setSelectedHeritage}
          sourceLabel={routeStats.sourceLabel}
        />

        <HeritagePopup
          site={selectedHeritage}
          onClose={() => setSelectedHeritage(null)}
        />
      </main>
    </div>
  );
}