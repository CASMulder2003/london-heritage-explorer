import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { heritageSites } from "./data/heritageSites";
import DesktopLayout from "./components/DesktopLayout";
import MobileLayout from "./components/MobileLayout";

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

function estimateDistanceKm(startSite, endSite, routeType, timeMinutes = 90) {
  if (!startSite || !endSite) {
    return routeType === "adventure" ? 5.4 : 2.6;
  }

  const latKm = (startSite.lat - endSite.lat) * 111;
  const lngKm = (startSite.lng - endSite.lng) * 69;
  const straightLineKm = Math.sqrt(latKm ** 2 + lngKm ** 2);

  if (routeType === "adventure") {
    let multiplier = 1.42;

    if (timeMinutes <= 60) multiplier = 1.35;
    else if (timeMinutes <= 90) multiplier = 1.46;
    else if (timeMinutes <= 120) multiplier = 1.58;
    else if (timeMinutes <= 150) multiplier = 1.7;
    else if (timeMinutes <= 180) multiplier = 1.82;
    else multiplier = 1.95;

    return Math.max(1.8, straightLineKm * multiplier);
  }

  return Math.max(1.2, straightLineKm * 1.12);
}

function estimateDurationMinutes(distanceKm, travelMode) {
  const speedKmh = travelMode === "cycle" ? 14 : 4.8;
  return Math.round((distanceKm / speedKmh) * 60);
}

function buildStats(startSite, endSite, travelMode, routeType, timeMinutes) {
  const distanceKm = estimateDistanceKm(
    startSite,
    endSite,
    routeType,
    timeMinutes
  );

  const estimatedDuration = estimateDurationMinutes(distanceKm, travelMode);

  const durationMinutes =
    routeType === "adventure"
      ? Math.max(
          estimatedDuration,
          Math.min(timeMinutes, estimatedDuration + 25)
        )
      : estimatedDuration;

  return {
    distance: `${distanceKm.toFixed(1)} km`,
    durationMinutes,
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
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const safeRouteType = useMemo(
    () => normalizeRouteType(routeType),
    [routeType]
  );

  const safeTravelMode = useMemo(
    () => normalizeTravelMode(travelMode),
    [travelMode]
  );

  const locations = useMemo(
    () => heritageSites.map((site) => site.name),
    []
  );

  const startSite = useMemo(() => findSiteByName(start), [start]);
  const endSite = useMemo(() => findSiteByName(end), [end]);

  const stats = useMemo(() => {
    return buildStats(
      startSite,
      endSite,
      safeTravelMode,
      safeRouteType,
      timeMinutes
    );
  }, [startSite, endSite, safeTravelMode, safeRouteType, timeMinutes]);

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
    if (!["Journey", "Landmarks"].includes(activeTab)) {
      setActiveTab("Journey");
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedHeritage) {
      setIsPanelOpen(false);
    }
  }, [selectedHeritage]);

  useEffect(() => {
    setIsPanelOpen(true);
  }, [activeTab]);

  useEffect(() => {
    setSelectedHeritage(null);
  }, [start, end, safeRouteType, safeTravelMode, timeMinutes]);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  return isMobile ? (
    <MobileLayout
      heritageSites={heritageSites}
      startSite={startSite}
      endSite={endSite}
      safeTravelMode={safeTravelMode}
      safeRouteType={safeRouteType}
      timeMinutes={timeMinutes}
      stats={stats}
      selectedHeritage={selectedHeritage}
      setSelectedHeritage={setSelectedHeritage}
    />
  ) : (
    <DesktopLayout
      heritageSites={heritageSites}
      isPanelOpen={isPanelOpen}
      setIsPanelOpen={setIsPanelOpen}
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
      selectedHeritage={selectedHeritage}
      setSelectedHeritage={setSelectedHeritage}
      startSite={startSite}
      endSite={endSite}
      safeTravelMode={safeTravelMode}
      safeRouteType={safeRouteType}
    />
  );
}