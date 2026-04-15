import {
  trees,
  busStops,
  signals,
  benches,
  lamps,
} from "../data/mapFeatures";

function SmallCircle({ x, y, fill, r = 5, opacity = 0.9 }) {
  return <circle cx={x} cy={y} r={r} fill={fill} opacity={opacity} />;
}

function SmallSquare({ x, y, fill, size = 9, opacity = 0.9 }) {
  return (
    <rect
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      rx="2"
      fill={fill}
      opacity={opacity}
    />
  );
}

function projectGeoToSvg(points = [], width = 620, height = 680, padding = 90) {
  if (!points.length) return [];

  const lngs = points
    .map((p) => p?.lng)
    .filter((value) => typeof value === "number");
  const lats = points
    .map((p) => p?.lat)
    .filter((value) => typeof value === "number");

  if (!lngs.length || !lats.length) return [];

  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  return points.map((p) => {
    const lng = typeof p?.lng === "number" ? p.lng : minLng;
    const lat = typeof p?.lat === "number" ? p.lat : minLat;

    const x =
      maxLng === minLng
        ? width / 2
        : padding + ((lng - minLng) / (maxLng - minLng)) * drawableWidth;

    const y =
      maxLat === minLat
        ? height / 2
        : padding + ((maxLat - lat) / (maxLat - minLat)) * drawableHeight;

    return {
      ...p,
      x,
      y,
    };
  });
}

function buildRoutePath(points = []) {
  if (!points.length) return "";

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;

    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  d += ` T ${last.x} ${last.y}`;

  return d;
}

function normalizeRoutePoints(route = []) {
  if (!Array.isArray(route)) return [];

  return route
    .map((point, index) => {
      if (
        point &&
        typeof point.lat === "number" &&
        typeof point.lng === "number"
      ) {
        return {
          id: point.id ?? `route-${index}`,
          ...point,
        };
      }

      if (
        point &&
        Array.isArray(point) &&
        typeof point[0] === "number" &&
        typeof point[1] === "number"
      ) {
        return {
          id: `route-${index}`,
          lng: point[0],
          lat: point[1],
        };
      }

      return null;
    })
    .filter(Boolean);
}

function normalizeHeritageSites(sites = [], projectedRoute = []) {
  if (!Array.isArray(sites)) return [];

  const routeCount = projectedRoute.length;

  return sites
    .map((site, index) => {
      const fallbackPoint =
        routeCount > 0
          ? projectedRoute[
              Math.min(
                Math.round(((index + 1) / (sites.length + 1)) * (routeCount - 1)),
                routeCount - 1
              )
            ]
          : null;

      const id = site?.id ?? `heritage-${index}`;

      if (typeof site?.x === "number" && typeof site?.y === "number") {
        return {
          ...site,
          id,
        };
      }

      if (
        typeof site?.lat === "number" &&
        typeof site?.lng === "number" &&
        projectedRoute.length
      ) {
        const projected = projectGeoToSvg([{ ...site, id }])[0];
        return projected ? projected : { ...site, id };
      }

      return {
        ...site,
        id,
        x: fallbackPoint?.x ?? 120 + index * 60,
        y: fallbackPoint?.y ?? 120 + index * 50,
      };
    })
    .filter((site) => typeof site.x === "number" && typeof site.y === "number");
}

function getFeatureSetFromProps(mapFeatures = []) {
  if (!Array.isArray(mapFeatures) || mapFeatures.length === 0) {
    return {
      trees,
      busStops,
      signals,
      benches,
      lamps,
    };
  }

  const grouped = {
    trees: [],
    busStops: [],
    signals: [],
    benches: [],
    lamps: [],
  };

  mapFeatures.forEach((item) => {
    const type = String(item?.type || "").toLowerCase();

    if (type === "tree" || type === "trees") grouped.trees.push(item);
    else if (type === "bus" || type === "busstop" || type === "bus_stop" || type === "bus-stop") grouped.busStops.push(item);
    else if (type === "signal" || type === "signals") grouped.signals.push(item);
    else if (type === "bench" || type === "benches") grouped.benches.push(item);
    else if (type === "lamp" || type === "lamps" || type === "streetlamp" || type === "street_lamp" || type === "street-lamp")
      grouped.lamps.push(item);
  });

  const hasAny =
    grouped.trees.length ||
    grouped.busStops.length ||
    grouped.signals.length ||
    grouped.benches.length ||
    grouped.lamps.length;

  if (!hasAny) {
    return {
      trees,
      busStops,
      signals,
      benches,
      lamps,
    };
  }

  return grouped;
}

export default function MapView({
  start,
  end,
  travelMode,
  routeType,
  route = [],
  heritageSites = [],
  mapFeatures = [],
  selectedHeritage,
  onSelectHeritage,
  sourceLabel = "mock",
}) {
  const normalizedRoute = normalizeRoutePoints(route);
  const projectedRoute = projectGeoToSvg(normalizedRoute);
  const routePath = buildRoutePath(projectedRoute);

  const startPoint = projectedRoute[0] || null;
  const endPoint = projectedRoute[projectedRoute.length - 1] || null;

  const visibleSites = normalizeHeritageSites(heritageSites, projectedRoute);

  const activeSite =
    visibleSites.find((site) => site.id === selectedHeritage?.id) || null;

  const featureSet = getFeatureSetFromProps(mapFeatures);

  return (
    <div className="map-view">
      <div className="map-meta">
        <span>Source: {sourceLabel}</span>
      </div>

      <svg
        className="map-canvas"
        viewBox="0 0 620 680"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${start} to ${end} heritage route map`}
      >
        <rect width="620" height="680" fill="#F4EFE5" />

        <rect x="30" y="30" width="140" height="90" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="200" y="50" width="180" height="70" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="410" y="40" width="180" height="100" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="30" y="160" width="100" height="120" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="160" y="150" width="130" height="90" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="330" y="170" width="120" height="120" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="470" y="180" width="100" height="90" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="70" y="330" width="110" height="120" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="220" y="320" width="140" height="100" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="390" y="330" width="160" height="120" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="100" y="500" width="150" height="110" rx="2" fill="#E8E2D4" opacity="0.8" />
        <rect x="300" y="500" width="180" height="100" rx="2" fill="#E8E2D4" opacity="0.8" />

        {routePath && (
  <>
    <path
      d={routePath}
      fill="none"
      stroke={routeType === "direct" ? "#6C63D9" : "#7F77DD"}
      strokeWidth={travelMode === "cycle" ? "3.8" : "4.4"}
      strokeDasharray={routeType === "adventure" ? "10 10" : "0"}
      strokeLinecap="round"
      opacity="0.14"
    />
    <path
      d={routePath}
      fill="none"
      stroke={routeType === "direct" ? "#6C63D9" : "#7F77DD"}
      strokeWidth={travelMode === "cycle" ? "2.6" : "3.1"}
      strokeDasharray={routeType === "adventure" ? "10 10" : "0"}
      strokeLinecap="round"
      opacity="0.9"
    />
  </>
)}

        {featureSet.trees.map((item, i) => (
          <SmallCircle
            key={`tree-${i}`}
            x={item.x}
            y={item.y}
            fill="#4E7D2B"
            r={4.5}
            opacity={0.85}
          />
        ))}

        {featureSet.busStops.map((item, i) => (
          <SmallCircle
            key={`bus-${i}`}
            x={item.x}
            y={item.y}
            fill="#B53A3A"
            r={4.8}
            opacity={0.85}
          />
        ))}

        {featureSet.signals.map((item, i) => (
          <SmallCircle
            key={`signal-${i}`}
            x={item.x}
            y={item.y}
            fill="#C68526"
            r={4.8}
            opacity={0.85}
          />
        ))}

        {featureSet.benches.map((item, i) => (
          <SmallSquare
            key={`bench-${i}`}
            x={item.x}
            y={item.y}
            fill="#6E6A64"
            size={8}
            opacity={0.82}
          />
        ))}

        {featureSet.lamps.map((item, i) => (
          <SmallCircle
            key={`lamp-${i}`}
            x={item.x}
            y={item.y}
            fill="#2A6FB5"
            r={4.8}
            opacity={0.85}
          />
        ))}

        {visibleSites.map((site, index) => {
          const isActive = activeSite?.id === site.id;

          return (
            <g
              key={site.id}
              onClick={() => onSelectHeritage?.(site)}
              style={{ cursor: "pointer" }}
            >
<circle
  cx={site.x}
  cy={site.y}
  r={isActive ? 16 : 12}
  fill={isActive ? "#5D52CF" : "#7F77DD"}
  opacity="0.96"
/>

<circle
  cx={site.x}
  cy={site.y}
  r={isActive ? 6.5 : 5.5}
  fill="#F8F7FF"
  stroke="#486F26"
  strokeWidth="2"
/>
{isActive && (
  <circle
    cx={site.x}
    cy={site.y}
    r="20"
    fill="none"
    stroke="#5D52CF"
    strokeWidth="1.5"
    opacity="0.28"
  />
)}
<text
  x={site.x}
  y={site.y + 24}
  textAnchor="middle"
  fontSize="10"
  fontWeight="600"
  fill="#6E675E"
  opacity="0.9"
>
  {index + 1}
</text>
            </g>
          );
        })}

        {startPoint && (
          <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r="6"
            fill="#FFFFFF"
            stroke="#3F6A1E"
            strokeWidth="2"
          />
        )}

        {endPoint && (
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r="6"
            fill="#FFFFFF"
            stroke="#B53A3A"
            strokeWidth="2"
          />
        )}

{activeSite && (
  <circle
    cx={activeSite.x}
    cy={activeSite.y}
    r="8"
    fill="none"
    stroke="#7F77DD"
    strokeWidth="1.8"
    opacity="0.4"
  >
<animate
  attributeName="r"
  values="8;13;8"
  dur="2s"
  repeatCount="indefinite"
/>
<animate
  attributeName="opacity"
  values="0.4;0;0.4"
  dur="2s"
  repeatCount="indefinite"
/>
          </circle>
        )}
      </svg>
    </div>
  );
}