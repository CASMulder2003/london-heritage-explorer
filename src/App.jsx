import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./App.css";
import { loadHeritageSites } from "./data/heritageSites";
import { preloadBoundary, isWithinCoverage, nearestBoundaryPoint } from "./services/boundary";
import SplashScreen from "./components/SplashScreen";
import DesktopSetupOverlay from "./TOP/DesktopSetupOverlay";
import DesktopLayout from "./TOP/DesktopLayout";
import MobileLayout from "./TOP/MobileLayout";
import BoundsWarning from "./components/BoundsWarning";

// ─── Mobile detection ─────────────────────────────────────────────────────────

function checkIsMobile() {
  return (
    window.innerWidth <= 1024 ||
    /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function toRad(deg) { return (deg * Math.PI) / 180; }

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

// Perpendicular distance from point P to segment A→B, in metres
// Also returns t (0–1) = how far along the segment the nearest point is
function distToSegment(p, a, b) {
  const cosLat = Math.cos(toRad((a.lat + b.lat) / 2));
  const ax = a.lng * cosLat, ay = a.lat;
  const bx = b.lng * cosLat, by = b.lat;
  const px = p.lng * cosLat, py = p.lat;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const nx = ax + t * dx, ny = ay + t * dy;
  const degDist = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
  // Convert degrees to metres (approx)
  const metersPerDeg = 111320 * Math.cos(toRad(p.lat));
  return { distMeters: degDist * metersPerDeg, t };
}

// Minimum perpendicular distance from point to a polyline
// Returns {distMeters, progress (0–1 along polyline)}
function distToPolyline(p, coords) {
  if (!coords || coords.length < 2) {
    // Fall back to straight line from first to last
    return { distMeters: Infinity, progress: 0 };
  }
  let best = Infinity, bestProgress = 0;
  let totalLen = 0;
  const segLens = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][1], lng: coords[i][0] };
    const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const len = haversineMeters(a, b);
    segLens.push(len);
    totalLen += len;
  }
  let traversed = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = { lat: coords[i][1], lng: coords[i][0] };
    const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const { distMeters, t } = distToSegment(p, a, b);
    if (distMeters < best) {
      best = distMeters;
      bestProgress = totalLen === 0 ? 0 : (traversed + segLens[i] * t) / totalLen;
    }
    traversed += segLens[i];
  }
  return { distMeters: best, progress: bestProgress };
}

// Straight-line corridor distance (no polyline available yet)
function distToStraightLine(p, a, b) {
  return distToSegment(p, a, b).distMeters;
}

function progressAlongLine(p, a, b) {
  return distToSegment(p, a, b).t;
}

// ─── Route building ───────────────────────────────────────────────────────────

const WALK_SPEED_KMH = 4.8;
const CYCLE_SPEED_KMH = 14;

function walkingMinutes(meters, travelMode) {
  const speed = travelMode === "cycle" ? CYCLE_SPEED_KMH : WALK_SPEED_KMH;
  return Math.round((meters / 1000 / speed) * 60);
}

function estimateTotalDistance(startSite, endSite, routeType) {
  if (!startSite || !endSite) return 0;
  const straight = haversineMeters(startSite, endSite);
  // Road network is typically 1.3–1.5× straight line
  return straight * (routeType === "direct" ? 1.3 : 1.45);
}

function buildStats(startSite, endSite, travelMode, routeType, timeMinutes, routeStops) {
  if (!startSite || !endSite) return { distance: "—", durationMinutes: 0 };

  // Calculate total distance through all stops
  const stops = routeStops.length > 0 ? routeStops : [startSite, endSite];
  let totalMeters = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    totalMeters += haversineMeters(stops[i], stops[i + 1]) * 1.35;
  }

  const speed = travelMode === "cycle" ? CYCLE_SPEED_KMH : WALK_SPEED_KMH;
  const durationMinutes = Math.round((totalMeters / 1000 / speed) * 60);

  return {
    distance: `${(totalMeters / 1000).toFixed(1)} km`,
    durationMinutes,
  };
}

// ─── CORRIDOR ROUTING ─────────────────────────────────────────────────────────
//
// Strategy:
// 1. Find all heritage sites within a corridor around the route line
// 2. For DIRECT: use very tight corridor (150m), order by progress along route
// 3. For EXPLORATORY: wider corridor (400m for direct path, with small diversions),
//    select evenly spaced stops based on time available
// 4. No site should make the route wildly longer — cap detour distance

function buildRouteStops(startSite, endSite, routeType, timeMinutes, travelMode, heritageSites, routeGeometry) {
  if (!startSite || !endSite || !heritageSites?.length) return [];

  const directDistMeters = haversineMeters(startSite, endSite);
  const hasRealRoute = routeGeometry && routeGeometry.length >= 2;

  // Corridor widths
  const corridorWidth = routeType === "direct" ? 180 : 450;

  // Score and filter sites
  const candidates = heritageSites
    .filter((s) => {
      const sameAsStart = s.name === startSite.name || (s.id && s.id === startSite.id);
      const sameAsEnd = s.name === endSite.name || (s.id && s.id === endSite.id);
      return !sameAsStart && !sameAsEnd;
    })
    .map((site) => {
      let distMeters, progress;

      if (hasRealRoute) {
        const result = distToPolyline(site, routeGeometry);
        distMeters = result.distMeters;
        progress = result.progress;
      } else {
        // Fall back to straight-line corridor
        distMeters = distToStraightLine(site, startSite, endSite);
        progress = progressAlongLine(site, startSite, endSite);
      }

      // How much does visiting this site add to the total journey distance?
      const prevStop = startSite; // simplified — in full impl we'd chain these
      const detourMeters = haversineMeters(site, startSite) + haversineMeters(site, endSite) - directDistMeters;

      return { ...site, distMeters, progress, detourMeters };
    })
    .filter((s) => {
      // Must be within corridor
      if (s.distMeters > corridorWidth) return false;
      // Must lie between start and end (progress 0–1), with small buffer
      if (s.progress < 0.02 || s.progress > 0.98) return false;
      // For direct mode, no large detours
      if (routeType === "direct" && s.detourMeters > 500) return false;
      return true;
    })
    .sort((a, b) => a.progress - b.progress); // sort by position along route

  if (routeType === "direct") {
    // Direct: just take all sites in the corridor, ordered by route progress
    // Cap at 8 stops max regardless
    const stops = [startSite, ...candidates.slice(0, 8), endSite];
    return deduplicateStops(stops);
  }

  // Exploratory: select stops based on time available
  // Estimate how many stops fit in the time
  const speed = travelMode === "cycle" ? CYCLE_SPEED_KMH : WALK_SPEED_KMH;
  const totalDistKm = (directDistMeters * 1.45) / 1000;
  const travelTimeMinutes = (totalDistKm / speed) * 60;
  const pauseTimePerStop = 8; // minutes spent at each heritage stop
  const availableForStops = timeMinutes - travelTimeMinutes;
  const maxStopsFromTime = Math.max(1, Math.floor(availableForStops / pauseTimePerStop));

  // Cap between 1 and 6 (2h max, ~5 sites is realistic)
  const targetCount = Math.min(6, Math.max(1, maxStopsFromTime));

  // Pick evenly spaced stops along the corridor
  const selected = pickEvenlySpaced(candidates, targetCount);

  const stops = [startSite, ...selected, endSite];
  return deduplicateStops(stops);
}

// Pick N sites that are as evenly spaced as possible along the route
function pickEvenlySpaced(candidates, n) {
  if (candidates.length === 0) return [];
  if (candidates.length <= n) return candidates;

  // Divide the route (0–1) into n+1 equal segments, pick closest site to each division point
  const selected = [];
  const used = new Set();

  for (let i = 1; i <= n; i++) {
    const targetProgress = i / (n + 1);
    let best = null, bestDist = Infinity;
    candidates.forEach((site) => {
      if (used.has(site.id || site.name)) return;
      const d = Math.abs(site.progress - targetProgress);
      if (d < bestDist) { bestDist = d; best = site; }
    });
    if (best) {
      selected.push(best);
      used.add(best.id || best.name);
    }
  }

  return selected.sort((a, b) => a.progress - b.progress);
}

function deduplicateStops(stops) {
  const seen = new Set();
  return stops.filter((s) => {
    const key = s.id || s.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Calculate walking times between consecutive stops
function buildStopTimes(stops, travelMode) {
  return stops.map((stop, i) => {
    if (i === 0) return { ...stop, minutesFromPrev: 0, distFromPrev: 0 };
    const prev = stops[i - 1];
    const meters = haversineMeters(prev, stop) * 1.35; // road factor
    const minutes = walkingMinutes(meters, travelMode);
    return { ...stop, minutesFromPrev: minutes, distFromPrev: Math.round(meters) };
  });
}

function buildAnchorItems(routeStops, travelMode) {
  const timed = buildStopTimes(routeStops, travelMode);
  return timed.map((site, i) => ({
    kind: "heritage",
    id: `heritage-${site.id || site.name}`,
    order: i,
    heritageId: site.id,
    name: site.name,
    period: site.period || "Heritage stop",
    description: site.enrichedDescription || site.description || "",
    minutesFromPrev: site.minutesFromPrev,
    distFromPrev: site.distFromPrev,
    raw: site,
  }));
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [heritageSites, setHeritageSites] = useState([]);
  const [isMobile, setIsMobile] = useState(() => checkIsMobile());

  // Route geometry from MapView — used to refine stop selection
  const [routeGeometry, setRouteGeometry] = useState(null);

  // Load data
  useEffect(() => {
    Promise.all([loadHeritageSites(), preloadBoundary()])
      .then(([sites]) => { setHeritageSites(sites); setDataReady(true); })
      .catch(() => setDataReady(true));
  }, []);

  useEffect(() => {
    function onResize() { setIsMobile(checkIsMobile()); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Desktop state
  const [desktopJourney, setDesktopJourney] = useState(null);
  const [desktopBoundsWarning, setDesktopBoundsWarning] = useState(null);

  // Shared journey state
  const [startSite, setStartSite] = useState(null);
  const [endSite, setEndSite] = useState(null);
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("exploratory");
  const [timeMinutes, setTimeMinutes] = useState(60);
  const [selectedSite, setSelectedSite] = useState(null);

  // Called by MapView when route geometry is loaded
  const handleRouteGeometry = useCallback((coords) => {
    setRouteGeometry(coords);
  }, []);

  function handleDesktopStart({ start, end, travelMode: tm, routeType: rt, timeMinutes: time }) {
    if (end?.lat && !isWithinCoverage(end.lat, end.lng)) {
      const bp = nearestBoundaryPoint(end.lat, end.lng);
      setDesktopBoundsWarning({ start, end, travelMode: tm, routeType: rt, timeMinutes: time, boundaryPoint: bp });
      return;
    }
    applyDesktopJourney({ start, end, travelMode: tm, routeType: rt, timeMinutes: time });
  }

  function applyDesktopJourney({ start, end, travelMode: tm, routeType: rt, timeMinutes: time }) {
    setStartSite(start);
    setEndSite(end);
    setTravelMode(tm);
    setRouteType(rt);
    setTimeMinutes(time);
    setRouteGeometry(null); // reset — MapView will repopulate
    setDesktopJourney({ start, end });
    setDesktopBoundsWarning(null);
    setSelectedSite(null);
  }

  function handleDesktopRouteToBoundary() {
    if (!desktopBoundsWarning) return;
    const { start, travelMode: tm, routeType: rt, timeMinutes: time, boundaryPoint } = desktopBoundsWarning;
    applyDesktopJourney({ start, end: { name: "Edge of coverage area", lat: boundaryPoint.lat, lng: boundaryPoint.lng }, travelMode: tm, routeType: rt, timeMinutes: time });
  }

  function handleMobileJourneyStart({ startCoords, endCoords, endName, travelMode: tm, routeType: rt, timeMinutes: time }) {
    setStartSite(startCoords ? { name: "Start", lat: startCoords.lat, lng: startCoords.lng } : null);
    setEndSite({ name: endName, lat: endCoords.lat, lng: endCoords.lng });
    setTravelMode(tm);
    setRouteType(rt || "exploratory");
    setTimeMinutes(time || 60);
    setRouteGeometry(null);
  }

  function handleTimeChange(delta) {
    setTimeMinutes((p) => Math.min(120, Math.max(15, p + delta)));
  }

  function swapLocations() {
    const tmp = startSite; setStartSite(endSite); setEndSite(tmp);
    setRouteGeometry(null);
  }

  // Route stops — recalculate when route geometry arrives from MapView
  const routeStops = useMemo(
    () => buildRouteStops(startSite, endSite, routeType, timeMinutes, travelMode, heritageSites, routeGeometry),
    [startSite, endSite, routeType, timeMinutes, travelMode, heritageSites, routeGeometry]
  );

  const anchorItems = useMemo(
    () => buildAnchorItems(routeStops, travelMode),
    [routeStops, travelMode]
  );

  const stats = useMemo(
    () => buildStats(startSite, endSite, travelMode, routeType, timeMinutes, routeStops),
    [startSite, endSite, travelMode, routeType, timeMinutes, routeStops]
  );

  useEffect(() => { setSelectedSite(null); }, [startSite, endSite, routeType, travelMode, timeMinutes]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!splashDone) return <SplashScreen onComplete={() => setSplashDone(true)} />;

  if (!dataReady) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#2c2318", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
        {[0, 1, 2].map((i) => <span key={i} className="loading-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
      </div>
    );
  }

  if (isMobile) {
    return (
      <MobileLayout
        routeStops={routeStops}
        stats={stats}
        onJourneyStart={handleMobileJourneyStart}
        heritageSites={heritageSites}
        onRouteGeometry={handleRouteGeometry}
      />
    );
  }

  if (!desktopJourney) {
    return (
      <>
        <DesktopSetupOverlay onStart={handleDesktopStart} />
        {desktopBoundsWarning && (
          <BoundsWarning onRouteToBoundary={handleDesktopRouteToBoundary} onCancel={() => setDesktopBoundsWarning(null)} />
        )}
      </>
    );
  }

  return (
    <>
      <DesktopLayout
        startSite={startSite} endSite={endSite}
        travelMode={travelMode} setTravelMode={setTravelMode}
        routeType={routeType} setRouteType={setRouteType}
        timeMinutes={timeMinutes} handleTimeChange={handleTimeChange} timeStep={15}
        routeStops={routeStops} anchorItems={anchorItems} stats={stats}
        selectedSite={selectedSite} setSelectedSite={setSelectedSite}
        start={startSite} setStart={setStartSite}
        end={endSite} setEnd={setEndSite}
        swapLocations={swapLocations}
        onRouteGeometry={handleRouteGeometry}
      />
      {desktopBoundsWarning && (
        <BoundsWarning onRouteToBoundary={handleDesktopRouteToBoundary} onCancel={() => setDesktopBoundsWarning(null)} />
      )}
    </>
  );
}
