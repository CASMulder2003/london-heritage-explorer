// Borough boundary loaded from real GeoJSON exported from R
// Replaces the rough bounding box approximation

let _boundaryCache = null;
let _boundaryPolygon = null;

async function loadBoundary() {
  if (_boundaryCache) return _boundaryCache;
  const res = await fetch("/boundary.geojson");
  const data = await res.json();
  _boundaryCache = data;

  // Extract the polygon coordinates
  const feature = data.features[0];
  if (feature.geometry.type === "Polygon") {
    _boundaryPolygon = feature.geometry.coordinates[0];
  } else if (feature.geometry.type === "MultiPolygon") {
    // Flatten multipolygon into single ring list for point-in-polygon
    _boundaryPolygon = feature.geometry.coordinates.map((p) => p[0]);
  }

  return _boundaryCache;
}

// Ray casting point-in-polygon
function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function isWithinCoverageAsync(lat, lng) {
  await loadBoundary();
  if (!_boundaryPolygon) return true; // fail open if boundary didn't load

  if (Array.isArray(_boundaryPolygon[0][0])) {
    // MultiPolygon — point must be in at least one ring
    return _boundaryPolygon.some((ring) => pointInRing([lng, lat], ring));
  }
  return pointInRing([lng, lat], _boundaryPolygon);
}

// Synchronous version using cached polygon — call after loadBoundary() has resolved
export function isWithinCoverage(lat, lng) {
  if (!_boundaryPolygon) return true; // fail open

  if (Array.isArray(_boundaryPolygon[0][0])) {
    return _boundaryPolygon.some((ring) => pointInRing([lng, lat], ring));
  }
  return pointInRing([lng, lat], _boundaryPolygon);
}

// Find nearest point on boundary to a given coordinate
export function nearestBoundaryPoint(lat, lng) {
  if (!_boundaryPolygon) return null;

  const rings = Array.isArray(_boundaryPolygon[0][0])
    ? _boundaryPolygon
    : [_boundaryPolygon];

  let bestDist = Infinity;
  let bestPoint = null;

  rings.forEach((ring) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const result = nearestOnSegmentGeo([lng, lat], ring[i], ring[i + 1]);
      const dist = haversineMeters(lat, lng, result[1], result[0]);
      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = result;
      }
    }
  });

  return bestPoint ? { lat: bestPoint[1], lng: bestPoint[0] } : null;
}

// Pre-load boundary on startup so isWithinCoverage() works synchronously
export function preloadBoundary() {
  return loadBoundary();
}

function nearestOnSegmentGeo(point, start, end) {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return start;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return [x1 + t * dx, y1 + t * dy];
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
