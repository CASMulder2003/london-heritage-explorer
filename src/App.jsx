import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import MapView from "./components/MapView";
import HeritagePopup from "./components/HeritagePopup";
import { heritageSites } from "./data/heritageSites";

const DEFAULT_TAB = "Journey";
const DEFAULT_START = "St Pancras Old Church";
const DEFAULT_END = "Senate House";
const MIN_TIME = 30;
const MAX_TIME = 240;
const TIME_STEP = 30;

function normalizeRouteType(routeType) {
  const value = String(routeType || "").toLowerCase();
  return value === "direct" ? "direct" : "adventure";
}

function normalizeTravelMode(travelMode) {
  const value = String(travelMode || "").toLowerCase();
  return value === "cycle" ? "cycle" : "walk";
}

function findSiteByName(name) {
  return heritageSites.find((site) => site.name === name) || null;
}

function estimateDistanceKm(startSite, endSite, routeType) {
  if (!startSite || !endSite) return routeType === "adventure" ? 4.8 : 2.6;

  const latKm = (startSite.lat - endSite.lat) * 111;
  const lngKm = (startSite.lng - endSite.lng) * 69;
  const straightLineKm = Math.sqrt(latKm ** 2 + lngKm ** 2);

  const routeMultiplier = routeType === "adventure" ? 1.45 : 1.12;
  return Math.max(1.2, straightLineKm * routeMultiplier);
}

function estimateDurationMinutes(distanceKm, travelMode) {
  const speedKmh = travelMode === "cycle" ? 14 : 4.8;
  return Math.round((distanceKm / speedKmh) * 60);
}

function getAdventureStopCount(timeMinutes) {
  if (timeMinutes <= 30) return 2;
  if (timeMinutes <= 60) return 3;
  if (timeMinutes <= 90) return 4;
  if (timeMinutes <= 120) return 5;
  return heritageSites.length;
}

function pointToSegmentDistance(site, startSite, endSite) {
  const x = site.lng;
  const y = site.lat;
  const x1 = startSite.lng;
  const y1 = startSite.lat;
  const x2 = endSite.lng;
  const y2 = endSite.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
  }

  const t = Math.max(
    0,
    Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy))
  );

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return Math.sqrt((x - nearestX) ** 2 + (y - nearestY) ** 2);
}

function pointProgressAlongSegment(site, startSite, endSite) {
  const x = site.lng;
  const y = site.lat;
  const x1 = startSite.lng;
  const y1 = startSite.lat;
  const x2 = endSite.lng;
  const y2 = endSite.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) return 0;

  return ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
}

function getVisibleHeritageSites(start, end, routeType, timeMinutes) {
  const startSite = findSiteByName(start);
  const endSite = findSiteByName(end);

  if (!startSite || !endSite) return heritageSites;

  if (routeType === "direct") {
    return heritageSites.filter(
      (site) => site.name === start || site.name === end
    );
  }

  // --- Narrative presets for key commuting corridors ---
  const presetRoutes = {
    "Camden Lock->Senate House": [
      "Camden Lock",
      "British Library",
      "The Foundling Museum",
      "Charles Dickens Museum",
      "Senate House",
    ],
    "Camden Lock->British Museum": [
      "Camden Lock",
      "British Library",
      "The Foundling Museum",
      "British Museum",
    ],
    "St Pancras Old Church->Senate House": [
      "St Pancras Old Church",
      "British Library",
      "The Foundling Museum",
      "Charles Dickens Museum",
      "Senate House",
    ],
    "St Pancras Old Church->British Museum": [
      "St Pancras Old Church",
      "British Library",
      "The Foundling Museum",
      "British Museum",
    ],
  };

  const presetKey = `${start}->${end}`;
  const presetNames = presetRoutes[presetKey];

  if (presetNames) {
    const maxStops = getAdventureStopCount(timeMinutes);

    const orderedPresetSites = presetNames
      .map((name) => findSiteByName(name))
      .filter(Boolean);

    // 根据 timeMinutes 截断，但始终保留起点和终点
    if (orderedPresetSites.length <= 2) {
      return orderedPresetSites;
    }

    const targetCount = Math.max(2, maxStops);
    if (orderedPresetSites.length <= targetCount) {
      return orderedPresetSites;
    }

    const middleSites = orderedPresetSites.slice(1, -1);
    const middleTarget = Math.max(0, targetCount - 2);
    const sampledMiddle = [];

    for (let i = 1; i <= middleTarget; i += 1) {
      const index = Math.floor((i / (middleTarget + 1)) * middleSites.length);
      if (middleSites[index]) {
        const alreadyIncluded = sampledMiddle.some(
          (site) => site.name === middleSites[index].name
        );
        if (!alreadyIncluded) {
          sampledMiddle.push(middleSites[index]);
        }
      }
    }

    return [orderedPresetSites[0], ...sampledMiddle, orderedPresetSites.at(-1)];
  }

  // --- Generic fallback for all other routes ---
  const maxStops = getAdventureStopCount(timeMinutes);

  const additionalSites = heritageSites
    .filter(
      (site) =>
        site.name !== start &&
        site.name !== end &&
        site.adventure !== false
    )
    .map((site) => {
      const corridorDistance = pointToSegmentDistance(site, startSite, endSite);
      const progress = pointProgressAlongSegment(site, startSite, endSite);

      const startIsCamden = start === "Camden Lock";
      const cueWeight = site.cueWeight || 0;

      const baseDistance = startIsCamden
        ? corridorDistance * 0.7 + Math.abs(progress - 0.5) * 0.01
        : corridorDistance;

      const adjustedDistance = baseDistance - cueWeight * 0.002;

      return {
        ...site,
        corridorDistance: adjustedDistance,
        progress,
      };
    })
    .filter(
      (site) =>
        site.progress > 0.05 &&
        site.progress < 0.95 &&
        site.corridorDistance < 0.025
    )
    .sort((a, b) => a.progress - b.progress);

  const targetCount = Math.max(0, maxStops - 2);
  const sampledSites = [];

  for (let i = 1; i <= targetCount; i += 1) {
    const index = Math.floor((i / (targetCount + 1)) * additionalSites.length);
    if (additionalSites[index]) {
      const alreadyIncluded = sampledSites.some(
        (site) => site.name === additionalSites[index].name
      );
      if (!alreadyIncluded) {
        sampledSites.push(additionalSites[index]);
      }
    }
  }

  return [startSite, ...sampledSites, endSite];
}

function buildStats(
  startSite,
  endSite,
  travelMode,
  routeType,
  timeMinutes,
  visibleSites
) {
  const distanceKm = estimateDistanceKm(startSite, endSite, routeType);
  const estimatedDuration = estimateDurationMinutes(distanceKm, travelMode);

  const durationMinutes =
    routeType === "adventure"
      ? Math.max(estimatedDuration, Math.min(timeMinutes, estimatedDuration + 25))
      : estimatedDuration;

  const heritageStops = visibleSites.length;

  const urbanFeatures =
    routeType === "adventure"
      ? 10 + heritageStops * 3
      : 5 + heritageStops * 2;

  return {
    distance: `${distanceKm.toFixed(1)} km`,
    durationMinutes,
    heritageStops,
    urbanFeatures,
    sourceLabel: "Mapbox",
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("adventure");
  const [timeMinutes, setTimeMinutes] = useState(90);
  const [selectedHeritage, setSelectedHeritage] = useState(null);

  const safeRouteType = useMemo(
    () => normalizeRouteType(routeType),
    [routeType]
  );
  const safeTravelMode = useMemo(
    () => normalizeTravelMode(travelMode),
    [travelMode]
  );

  const locations = useMemo(
    () =>
      heritageSites
        .filter((site) => site.startEnd !== false)
        .map((site) => site.name),
    []
  );

  const startSite = useMemo(() => findSiteByName(start), [start]);
  const endSite = useMemo(() => findSiteByName(end), [end]);

  const visibleHeritageSites = useMemo(() => {
    return getVisibleHeritageSites(start, end, safeRouteType, timeMinutes);
  }, [start, end, safeRouteType, timeMinutes]);

  const stats = useMemo(() => {
    return buildStats(
      startSite,
      endSite,
      safeTravelMode,
      safeRouteType,
      timeMinutes,
      visibleHeritageSites
    );
  }, [
    startSite,
    endSite,
    safeTravelMode,
    safeRouteType,
    timeMinutes,
    visibleHeritageSites,
  ]);

  function handleTimeChange(delta) {
    setTimeMinutes((prev) => {
      const next = prev + delta;
      return Math.min(MAX_TIME, Math.max(MIN_TIME, next));
    });
  }

  function handleStartChange(nextStart) {
    if (!nextStart || nextStart === end) return;
    setStart(nextStart);
  }

  function handleEndChange(nextEnd) {
    if (!nextEnd || nextEnd === start) return;
    setEnd(nextEnd);
  }

  function swapLocations() {
    setStart(end);
    setEnd(start);
  }

  useEffect(() => {
    if (!selectedHeritage) return;

    const stillVisible = visibleHeritageSites.some(
      (site) => site.name === selectedHeritage.name
    );

    if (!stillVisible) {
      setSelectedHeritage(null);
    }
  }, [selectedHeritage, visibleHeritageSites]);

  useEffect(() => {
    if (!["Journey", "Landmarks", "Saved"].includes(activeTab)) {
      setActiveTab("Journey");
    }
  }, [activeTab]);

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        start={start}
        setStart={handleStartChange}
        end={end}
        setEnd={handleEndChange}
        swapLocations={swapLocations}
        travelMode={safeTravelMode}
        setTravelMode={setTravelMode}
        routeType={safeRouteType}
        setRouteType={setRouteType}
        timeMinutes={timeMinutes}
        handleTimeChange={handleTimeChange}
        timeStep={TIME_STEP}
        stats={stats}
        locations={locations}
        visibleHeritageSites={visibleHeritageSites}
        selectedHeritage={selectedHeritage}
        onSelectHeritage={setSelectedHeritage}
      />

      <main className="map-panel">
        <MapView
          startSite={startSite}
          endSite={endSite}
          heritageSites={visibleHeritageSites}
          travelMode={safeTravelMode}
          routeType={safeRouteType}
          timeMinutes={timeMinutes}
          stats={stats}
          onSelectHeritage={setSelectedHeritage}
          selectedHeritage={selectedHeritage}
          sourceLabel={stats.sourceLabel}
        />

        <HeritagePopup
          site={selectedHeritage}
          onClose={() => setSelectedHeritage(null)}
        />
      </main>
    </div>
  );
}