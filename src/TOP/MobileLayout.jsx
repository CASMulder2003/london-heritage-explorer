import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "../MAP/MapView";
import SetupScreen from "../mobile/SetupScreen";
import OverviewScreen from "../mobile/OverviewScreen";
import NavigationScreen from "../mobile/NavigationScreen";
import ArrivalScreen from "../mobile/ArrivalScreen";
import SiteDetailScreen from "../mobile/SiteDetailScreen";
import { unlockAudio, playArrivalSound, playDestinationSound, stopAudio } from "../services/audio";

const ARRIVAL_RADIUS_METERS = 40; // default fallback

function getArrivalRadius(category) {
  switch (category) {
    case 'park':     return 40;
    case 'memorial': return 30;
    case 'church':   return 50;
    case 'listed':   return 80;
    default:         return 40;
  }
}

function getDistanceMeters(from, to) {
  if (!from || !to) return Infinity;
  const R = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Stages: setup | overview | navigating | arrived | siteDetail | finished
export default function MobileLayout({
  routeStops = [],
  stats,
  narrativeSteps = [],
  selectedNarrativeStep,
  setSelectedNarrativeStep,
  onJourneyStart,
}) {
  const [stage, setStage] = useState("setup");
  const [travelMode, setTravelMode] = useState("walk");
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [hasLiveLocation, setHasLiveLocation] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [startSite, setStartSite] = useState(null);
  const [endSite, setEndSite] = useState(null);

  // Live location state
  const [userCoords, setUserCoords] = useState(null);
  const [deviceHeading, setDeviceHeading] = useState(null);
  const watchRef = useRef(null);
  const headingListenerRef = useRef(null);

  // Anchor progression
  const [currentAnchorIndex, setCurrentAnchorIndex] = useState(0);
  const [arrivedSite, setArrivedSite] = useState(null);
  const [siteDetail, setSiteDetail] = useState(null); // {site, description, image, wikiUrl}
  const arrivedIds = useRef(new Set());

  // ── Location tracking ────────────────────────────────────────────────────

  function startLocationTracking() {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        if (pos.coords.heading != null) setDeviceHeading(pos.coords.heading);
      },
      (err) => console.warn("Location watch error:", err),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }

  function startHeadingTracking() {
    function handler(e) {
      const heading =
        e.webkitCompassHeading != null ? e.webkitCompassHeading
        : e.alpha != null ? (360 - e.alpha) % 360
        : null;
      if (heading != null) setDeviceHeading(heading);
    }
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission()
        .then((p) => { if (p === "granted") { window.addEventListener("deviceorientation", handler, true); headingListenerRef.current = handler; } })
        .catch(() => {});
    } else {
      window.addEventListener("deviceorientation", handler, true);
      headingListenerRef.current = handler;
    }
  }

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (headingListenerRef.current) window.removeEventListener("deviceorientation", headingListenerRef.current, true);
    };
  }, []);

  // ── Arrival detection ────────────────────────────────────────────────────

  useEffect(() => {
    if (stage !== "navigating" || manualMode || !userCoords || !routeStops.length) return;
    // Skip start point only
    if (currentAnchorIndex === 0) return;
    const target = routeStops[currentAnchorIndex];
    if (!target || arrivedIds.current.has(target.id || target.name)) return;
    const dist = getDistanceMeters(userCoords, { lat: target.lat, lng: target.lng });
    if (dist <= getArrivalRadius(target.category)) {
      arrivedIds.current.add(target.id || target.name);
      // Resume audio context — iOS may have suspended it since the last tap
      unlockAudio();
      // End destination — go straight to finished screen
      if (currentAnchorIndex >= routeStops.length - 1) {
        playDestinationSound();
        stopAudio();
        setStage("finished");
      } else {
        setArrivedSite(target);
        setStage("arrived");
      }
    }
  }, [userCoords, routeStops, currentAnchorIndex, stage, manualMode]);

  // ── Setup complete ────────────────────────────────────────────────────────

  const handleSetupStart = useCallback(({ startCoords, endCoords, endName, travelMode: tm, routeType: rt, timeMinutes: time, hasLiveLocation: hasLoc }) => {
    setTravelMode(tm);
    setTimeMinutes(time);
    setHasLiveLocation(hasLoc);
    setManualMode(!hasLoc);

    const start = startCoords ? { name: "Your location", lat: startCoords.lat, lng: startCoords.lng } : null;
    const end = { name: endName, lat: endCoords.lat, lng: endCoords.lng };
    setStartSite(start);
    setEndSite(end);

    if (hasLoc && startCoords) {
      setUserCoords(startCoords);
      startLocationTracking();
      startHeadingTracking();
    }

    onJourneyStart?.({ startCoords, endCoords, endName, travelMode: tm, routeType: rt, timeMinutes: time });
    setStage("overview");
  }, [onJourneyStart]);

  // ── Begin navigation ──────────────────────────────────────────────────────

  function handleBegin() {
    // Unlock audio context on this user tap — needed for iOS
    unlockAudio();
    // Start at index 1 — index 0 is the start point, not a heritage stop
    setCurrentAnchorIndex(1);
    arrivedIds.current.clear();
    setArrivedSite(null);
    setStage("navigating");
  }

  // ── Arrived → read more → continue ───────────────────────────────────────

  function handleReadMore(detail) {
    setSiteDetail(detail);
    setStage("siteDetail");
  }

  function handleContinueFromDetail() {
    setSiteDetail(null);
    if (currentAnchorIndex === routeStops.length - 2) {
      setStage("headingToDestination");
    } else {
      advanceToNext();
    }
  }

  function handleContinueFromArrival() {
    setArrivedSite(null);
    // If this was the last heritage stop, show the "heading to destination" message
    if (currentAnchorIndex === routeStops.length - 2) {
      setStage("headingToDestination");
    } else {
      advanceToNext();
    }
  }

  function advanceToNext() {
    const next = currentAnchorIndex + 1;
    if (next >= routeStops.length) {
      setStage("finished");
    } else {
      setCurrentAnchorIndex(next);
      setStage("navigating");
    }
  }

  function handleManualArrive() {
    // Skip start (0) — only arrive at real heritage stops or end
    if (currentAnchorIndex === 0) {
      advanceToNext();
      return;
    }
    // End destination — go straight to finished
    if (currentAnchorIndex >= routeStops.length - 1) {
      playDestinationSound();
      stopAudio();
      setStage("finished");
      return;
    }
    const target = routeStops[currentAnchorIndex];
    if (target) {
      playArrivalSound(target.category);
      arrivedIds.current.add(target.id || target.name);
      setArrivedSite(target);
      setStage("arrived");
    }
  }

  // ── Restart ───────────────────────────────────────────────────────────────

  function handleRestart() {
    setStage("setup");
    setStartSite(null);
    setEndSite(null);
    setUserCoords(null);
    setDeviceHeading(null);
    setCurrentAnchorIndex(0);
    setArrivedSite(null);
    setSiteDetail(null);
    arrivedIds.current.clear();
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
  }

  const currentTarget = routeStops[currentAnchorIndex] || null;
  // isLastSite when at the last real heritage stop (second to last overall)
  const isLastSite = currentAnchorIndex === routeStops.length - 2;

  // ── Setup — no map ────────────────────────────────────────────────────────

  if (stage === "setup") {
    return (
      <div className="mobile-shell">
        <SetupScreen onStart={handleSetupStart} />
      </div>
    );
  }

  // ── Site detail — full screen, no map ─────────────────────────────────────

  if (stage === "siteDetail" && siteDetail) {
    return (
      <div className="mobile-shell">
        <SiteDetailScreen
          site={siteDetail.site}
          description={siteDetail.description}
          image={siteDetail.image}
          wikiUrl={siteDetail.wikiUrl}
          onContinue={handleContinueFromDetail}
        />
      </div>
    );
  }

  // ── All other stages — map present ────────────────────────────────────────

  return (
    <div className="mobile-shell">
      <div className="mobile-map-container">
        <MapView
          startSite={startSite}
          endSite={endSite}
          routeStops={routeStops}
          travelMode={travelMode}
          routeType="adventure"
          timeMinutes={timeMinutes}
          showRoute={false}
          userCoords={userCoords}
          deviceHeading={deviceHeading}
          journeyStage={stage === "headingToDestination" ? "navigating" : stage}
          currentAnchorIndex={currentAnchorIndex}
          narrativeSteps={narrativeSteps}
          selectedNarrativeStep={selectedNarrativeStep}
          setSelectedNarrativeStep={setSelectedNarrativeStep}
        >
          {stage === "overview" && (
            <OverviewScreen
              stats={stats}
              routeStops={routeStops}
              travelMode={travelMode}
              timeMinutes={timeMinutes}
              onBegin={handleBegin}
            />
          )}

          {stage === "headingToDestination" && (
            <div className="mobile-overview-overlay">
              <div className="mobile-overview-handle" />
              <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "12px" }}>✦</div>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", fontWeight: 400, color: "#2f2418", margin: "0 0 12px", textAlign: "center" }}>
                All stops visited
              </h2>
              <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "0.9rem", color: "#81796f", lineHeight: 1.7, textAlign: "center", margin: "0 0 24px" }}>
                You've explored {routeStops.length - 2} heritage {routeStops.length - 2 === 1 ? "site" : "sites"} along the way. Now let's get you to your destination.
              </p>
              <button
                type="button"
                className="mobile-begin-btn"
                onClick={() => {
                  const next = currentAnchorIndex + 1;
                  setCurrentAnchorIndex(next);
                  setStage("navigating");
                }}
              >
                Head to destination →
              </button>
            </div>
          )}

          {stage === "navigating" && (
            <NavigationScreen
              userCoords={userCoords}
              deviceHeading={deviceHeading}
              currentTarget={currentTarget}
              manualMode={manualMode}
              onManualArrive={handleManualArrive}
              travelMode={travelMode}
              currentAnchorIndex={currentAnchorIndex}
              totalStops={routeStops.length}
              routeStops={routeStops}
            />
          )}

          {stage === "finished" && (
            <div className="mobile-finished-overlay">
              <div className="mobile-finished-icon">✦</div>
              <h2 className="mobile-finished-title">You've arrived</h2>
              <p className="mobile-finished-text">
                {routeStops.length > 2
                  ? `You passed ${routeStops.length - 2} heritage site${routeStops.length - 2 !== 1 ? "s" : ""} on your way here. The city looks different when you slow down.`
                  : "The city looks different when you slow down."}
              </p>
              <button type="button" className="mobile-finished-restart" onClick={handleRestart}>
                Plan another journey
              </button>
            </div>
          )}
        </MapView>
      </div>

      {/* Arrival card — above the map */}
      {stage === "arrived" && arrivedSite && (
        <ArrivalScreen
          site={arrivedSite}
          onContinue={handleContinueFromArrival}
          onReadMore={handleReadMore}
          isLastSite={isLastSite}
        />
      )}
    </div>
  );
}
