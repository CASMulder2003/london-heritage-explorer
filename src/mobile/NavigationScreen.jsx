import { useRef } from "react";
import DirectionArrow from "../components/DirectionArrow";

function getDistanceMeters(from, to) {
  if (!from || !to) return null;
  const R = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Smooth a value using exponential moving average
// alpha: 0 = no smoothing, 1 = instant update. 0.15 gives gentle smoothing.
function useSmoothedValue(raw, alpha = 0.15) {
  const smoothedRef = useRef(null);
  if (raw == null) { smoothedRef.current = null; return null; }
  if (smoothedRef.current == null) { smoothedRef.current = raw; return raw; }
  smoothedRef.current = smoothedRef.current + alpha * (raw - smoothedRef.current);
  return smoothedRef.current;
}

export default function NavigationScreen({
  map, mapReady, userCoords, deviceHeading, currentTarget,
  manualMode, onManualArrive, travelMode,
  currentAnchorIndex, totalStops, routeStops = [],
}) {
  const rawDistance = getDistanceMeters(userCoords, currentTarget);
  const smoothedDistance = useSmoothedValue(rawDistance, 0.12);

  const distLabel =
    smoothedDistance == null ? null
    : smoothedDistance < 1000 ? `${Math.round(smoothedDistance)}m away`
    : `${(smoothedDistance / 1000).toFixed(1)}km away`;

  return (
    <>
      {!manualMode && userCoords && currentTarget && (
        <DirectionArrow
          userCoords={userCoords}
          targetSite={currentTarget}
          deviceHeading={deviceHeading}
        />
      )}

      <div className="mobile-nav-top-bar">
        <div className="mobile-nav-badge">
          {travelMode === "cycle" ? "Cycle" : "Walk"} · Stop {currentAnchorIndex} of {totalStops - 2}
        </div>
      </div>

      {currentTarget && (
        <div className="mobile-nav-next-bar">
          <div className="mobile-nav-next-info">
            <div className="mobile-nav-next-label">
              {manualMode ? "Navigate to" : currentTarget?.name === routeStops?.[routeStops.length - 1]?.name ? "Destination" : "Next stop"}
            </div>
            <div className="mobile-nav-next-name">{currentTarget.name}</div>
            {distLabel && !manualMode && (
              <div className="mobile-nav-next-distance">{distLabel}</div>
            )}
          </div>

          {manualMode && (
            <button type="button" className="mobile-nav-manual-btn" onClick={onManualArrive}>
              I'm here →
            </button>
          )}
        </div>
      )}
    </>
  );
}
