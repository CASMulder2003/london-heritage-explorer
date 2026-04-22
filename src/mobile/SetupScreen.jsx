import { useRef, useState, useEffect } from "react";
import { searchAddress } from "../services/geocode";
import { isWithinCoverageAsync, nearestBoundaryPoint } from "../services/boundary";
import BoundsWarning from "../components/BoundsWarning";

const TIME_OPTIONS = [15, 30, 45, 60, 90, 120];

function MobileAddressSearch({ value, onChange, placeholder }) {
  const isConfirmed = typeof value === "object" && value?.lat;
  const [inputValue, setInputValue] = useState(isConfirmed ? value.name : "");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof value === "object" && value?.lat) { setInputValue(value.name || ""); setSuggestions([]); }
    else if (!value) { setInputValue(""); setSuggestions([]); }
  }, [value]);

  useEffect(() => {
    if (!inputValue || inputValue.length < 2) { setSuggestions([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try { setSuggestions((await searchAddress(inputValue)).slice(0, 5)); }
      catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [inputValue]);

  function handleSelect(s) {
    setInputValue(s.shortName);
    setSuggestions([]);
    onChange({ name: s.shortName, lat: s.lat, lng: s.lng });
  }

  if (isConfirmed) {
    return (
      <div className="mobile-location-confirmed">
        <span className="mobile-location-dot" style={{ background: "#A5513A", boxShadow: "0 0 0 3px #A5513A22" }} />
        <span className="mobile-location-name">{value.name}</span>
        <button type="button" className="mobile-location-change" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        className="mobile-input"
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); onChange(null); }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
      {searching && (
        <span style={{
          position: "absolute", right: "14px", top: "50%",
          transform: "translateY(-50%)", width: 14, height: 14,
          border: "2px solid #d9d2c7", borderTopColor: "#8b7355",
          borderRadius: "50%", animation: "spin 0.7s linear infinite",
          display: "inline-block",
        }} />
      )}
      {suggestions.length > 0 && (
        <ul className="mobile-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} style={{ listStyle: "none" }}>
              <button type="button" className="mobile-suggestion-item" onClick={() => handleSelect(s)}>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "#1f1f1f", display: "block" }}>{s.shortName}</span>
                <span style={{ fontSize: "12px", color: "#81796f", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                  {s.displayName.split(",").slice(1, 3).join(",")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SetupScreen({ onStart }) {
  const [locationStatus, setLocationStatus] = useState("idle");
  const [startCoords, setStartCoords] = useState(null);
  const [startAddress, setStartAddress] = useState(null);
  const [destination, setDestination] = useState(null);
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("exploratory");
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [showBoundsWarning, setShowBoundsWarning] = useState(false);
  const [boundaryPoint, setBoundaryPoint] = useState(null);

  // ── iOS Safari GPS fix ───────────────────────────────────────────────────
  // getCurrentPosition MUST be the very first call — no state updates before it.
  // setLocationStatus("requesting") comes after.
  function handleLocationRequest() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationStatus("granted");
        setStartCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStartAddress(null);
      },
      () => {
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    // State update after the geolocation call
    setLocationStatus("requesting");
  }

  // ── Destination change with async boundary check ────────────────────────
  // Uses isWithinCoverageAsync because the boundary may not have been preloaded
  // yet when the user first selects a destination on mobile
  async function handleDestinationChange(dest) {
    setDestination(dest);
    setShowBoundsWarning(false);
    setBoundaryPoint(null);

    if (!dest?.lat) return;

    const withinCoverage = await isWithinCoverageAsync(dest.lat, dest.lng);
    if (!withinCoverage) {
      const bp = nearestBoundaryPoint(dest.lat, dest.lng);
      setBoundaryPoint(bp);
      setShowBoundsWarning(true);
    }
  }

  function handleStartAddressChange(addr) {
    setStartAddress(addr);
    if (addr) {
      setStartCoords(null);
      setLocationStatus("idle");
    }
  }

  function handleRouteToBoundary() {
    setShowBoundsWarning(false);
    if (boundaryPoint) {
      setDestination({
        name: "Edge of coverage area",
        lat: boundaryPoint.lat,
        lng: boundaryPoint.lng,
        isBoundary: true,
      });
    }
  }

  function handleCancelBounds() {
    setShowBoundsWarning(false);
    setDestination(null);
    setBoundaryPoint(null);
  }

  const isLiveGranted = locationStatus === "granted";
  const isManualStart = typeof startAddress === "object" && startAddress?.lat;
  const hasStart = isLiveGranted || isManualStart;
  const canStart = destination?.lat && hasStart;

  function handleStart() {
    if (!canStart) return;
    const sc = isLiveGranted
      ? startCoords
      : { lat: startAddress.lat, lng: startAddress.lng };

    onStart({
      startCoords: sc,
      endCoords: { lat: destination.lat, lng: destination.lng },
      endName: destination.name,
      travelMode,
      routeType,
      timeMinutes,
      hasLiveLocation: isLiveGranted,
    });
  }

  return (
    <>
      <div className="mobile-setup">
        <div className="mobile-setup-header">
          <div className="mobile-setup-eyebrow">Spatial Data Story</div>
          <h1 className="mobile-setup-title">London Heritage<br />Explorer</h1>
          <p className="mobile-setup-subtitle">Your city, seen slowly.</p>
        </div>

        <div className="mobile-setup-body">

          {/* ── FROM ── */}
          <div className="mobile-setup-field">
            <div className="mobile-setup-label">From</div>

            {isLiveGranted ? (
              <div className="mobile-location-confirmed" style={{ marginBottom: "8px" }}>
                <span className="mobile-location-dot" style={{ background: "#4a8c6a", boxShadow: "0 0 0 3px #4a8c6a22" }} />
                <span className="mobile-location-name">Your current location</span>
                <button type="button" className="mobile-location-change" onClick={() => { setLocationStatus("idle"); setStartCoords(null); }}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="mobile-location-request-btn"
                  style={{ marginBottom: "12px" }}
                  onClick={handleLocationRequest}
                  disabled={locationStatus === "requesting"}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                    background: locationStatus === "denied" ? "#A5513A" : "#4a8c6a",
                    animation: locationStatus === "requesting" ? "pulse 1.2s ease infinite" : "none",
                  }} />
                  {locationStatus === "requesting"
                    ? "Finding your location…"
                    : locationStatus === "denied"
                    ? "Location unavailable. Tap to retry"
                    : "Use my current location"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ flex: 1, height: "1px", background: "#e0d8cc" }} />
                  <span style={{ fontSize: "11px", color: "#c4b89e", textTransform: "uppercase", letterSpacing: "0.08em" }}>or</span>
                  <div style={{ flex: 1, height: "1px", background: "#e0d8cc" }} />
                </div>

                <MobileAddressSearch
                  value={startAddress}
                  onChange={handleStartAddressChange}
                  placeholder="Type a starting address…"
                />
              </>
            )}
          </div>

          {/* ── TO ── */}
          <div className="mobile-setup-field">
            <div className="mobile-setup-label">To</div>
            <MobileAddressSearch
              value={destination}
              onChange={handleDestinationChange}
              placeholder="Where are you heading?"
            />
          </div>

          {/* ── ROUTE TYPE ── */}
          <div className="mobile-setup-field">
            <div className="mobile-setup-label">Route type</div>
            <div className="mobile-mode-group">
              <button type="button" className={`mobile-mode-pill ${routeType === "exploratory" ? "active" : ""}`} onClick={() => setRouteType("exploratory")}>Exploratory</button>
              <button type="button" className={`mobile-mode-pill ${routeType === "direct" ? "active" : ""}`} onClick={() => setRouteType("direct")}>Direct</button>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#81796f", fontFamily: "Georgia, serif", fontStyle: "italic" }}>
              {routeType === "direct"
                ? "Shortest route — sites directly on your path."
                : "Wanders through sites within your time budget."}
            </p>
          </div>

          {/* ── HOW ── */}
          <div className="mobile-setup-field">
            <div className="mobile-setup-label">How</div>
            <div className="mobile-mode-group">
              <button type="button" className={`mobile-mode-pill ${travelMode === "walk" ? "active" : ""}`} onClick={() => setTravelMode("walk")}>Walk</button>
              <button type="button" className={`mobile-mode-pill ${travelMode === "cycle" ? "active" : ""}`} onClick={() => setTravelMode("cycle")}>Cycle</button>
            </div>
          </div>

          {/* ── TIME ── */}
          <div className="mobile-setup-field" style={{ opacity: routeType === "direct" ? 0.4 : 1, transition: "opacity 0.2s", pointerEvents: routeType === "direct" ? "none" : "auto" }}>
            <div className="mobile-setup-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              Time available
              {routeType === "direct" && (
                <span style={{ fontSize: "10px", color: "#A5513A", background: "#fdf0eb", padding: "2px 7px", borderRadius: "10px", fontWeight: 600 }}>Not used</span>
              )}
            </div>
            <div className="mobile-time-chips">
              {TIME_OPTIONS.map((t) => (
                <button key={t} type="button" className={`mobile-time-chip ${timeMinutes === t ? "active" : ""}`} onClick={() => setTimeMinutes(t)}>
                  {t < 60 ? `${t}m` : `${t / 60}h`}
                </button>
              ))}
            </div>
          </div>

          {/* ── START ── */}
          <button type="button" className="mobile-begin-btn" onClick={handleStart} disabled={!canStart}>
            Start journey
          </button>

          {!canStart && (
            <p style={{
              fontFamily: "Georgia, serif", fontStyle: "italic",
              fontSize: "12px", color: "#81796f",
              textAlign: "center", margin: 0, lineHeight: 1.5,
            }}>
              {!hasStart && !destination?.lat
                ? "Add a starting point and destination to begin"
                : !hasStart
                ? "Add a starting point above"
                : "Add a destination to begin"}
            </p>
          )}

        </div>
      </div>

      {showBoundsWarning && (
        <BoundsWarning
          onRouteToBoundary={handleRouteToBoundary}
          onCancel={handleCancelBounds}
        />
      )}
    </>
  );
}
