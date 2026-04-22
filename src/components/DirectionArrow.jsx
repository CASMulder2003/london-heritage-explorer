import { useEffect, useRef, useState } from "react";

function getBearing(from, to) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getDistanceMeters(from, to) {
  const R = 6371000;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DirectionArrow({ userCoords, targetSite, deviceHeading }) {
  const [rotation, setRotation] = useState(0);
  const [distance, setDistance] = useState(null);
  const prevRotation = useRef(0);

  useEffect(() => {
    if (!userCoords || !targetSite) return;
    const bearing = getBearing(userCoords, { lat: targetSite.lat, lng: targetSite.lng });
    const dist = getDistanceMeters(userCoords, { lat: targetSite.lat, lng: targetSite.lng });
    const relative = deviceHeading != null ? (bearing - deviceHeading + 360) % 360 : bearing;
    let delta = relative - prevRotation.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const smoothed = prevRotation.current + delta;
    prevRotation.current = smoothed;
    setRotation(smoothed);
    setDistance(dist);
  }, [userCoords, targetSite, deviceHeading]);

  if (!userCoords || !targetSite) return null;

  const distLabel = distance == null ? null : distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;

  return (
    <div className="direction-arrow">
      <div className="direction-arrow-ring" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="direction-arrow-pointer" />
      </div>
      {distLabel && <div className="direction-arrow-distance">{distLabel}</div>}
      <div className="direction-arrow-label">{targetSite.name}</div>
    </div>
  );
}
