import {
  trees,
  busStops,
  signals,
  benches,
  lamps,
} from "../data/mapFeatures";

function SmallCircle({ x, y, fill, r = 5 }) {
  return <circle cx={x} cy={y} r={r} fill={fill} opacity="0.95" />;
}

function SmallSquare({ x, y, fill, size = 9 }) {
  return (
    <rect
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      rx="2"
      fill={fill}
      opacity="0.95"
    />
  );
}

/**
 * Convert lat/lng points into SVG x/y points based on current route bounds.
 * Keeps everything inside the 620x680 canvas with padding.
 */
function projectGeoToSvg(points = [], width = 620, height = 680, padding = 60) {
  if (!points.length) return [];

  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);

  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  return points.map((p) => {
    const x =
      maxLng === minLng
        ? width / 2
        : padding + ((p.lng - minLng) / (maxLng - minLng)) * drawableWidth;

    // SVG y axis goes downward, so latitude needs reversing
    const y =
      maxLat === minLat
        ? height / 2
        : padding + ((maxLat - p.lat) / (maxLat - minLat)) * drawableHeight;

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

  for (let i = 1; i < points.length; i++) {
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

export default function MapView({
  routeType,
  heritageSites,
  routeData,
  routeStops = [],
  selectedSite,
  showPopup,
  onSelectSite,
}) {
  const geometry = routeData?.geometry || [];

  // 1. 把真实路线经纬度转成 SVG 坐标
  const projectedGeometry = projectGeoToSvg(geometry);

  // 2. stops 如果已经有 lat/lng，就跟着路线一起投影
  const projectedStops =
    routeStops.length && geometry.length
      ? projectGeoToSvg(routeStops)
      : routeStops;

  const routePath = buildRoutePath(projectedGeometry);

  const startPoint = projectedGeometry[0];
  const endPoint = projectedGeometry[projectedGeometry.length - 1];

  const visibleSites = projectedStops.length ? projectedStops : heritageSites;

  // 让 selectedSite 能对应到投影后的 site
  const selectedProjectedSite =
    visibleSites.find((site) => site.id === selectedSite?.id) || null;

  return (
    <svg
      className="map-canvas"
      viewBox="0 0 620 680"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="620" height="680" fill="#F0EBE0" />

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
        <path
          d={routePath}
          fill="none"
          stroke="#7F77DD"
          strokeWidth="5"
          strokeDasharray={routeType === "adventure" ? "10 9" : "0"}
          strokeLinecap="round"
        />
      )}

      {trees.map((item, i) => (
        <SmallCircle key={`tree-${i}`} x={item.x} y={item.y} fill="#3B6D11" />
      ))}

      {busStops.map((item, i) => (
        <SmallCircle key={`bus-${i}`} x={item.x} y={item.y} fill="#A32D2D" />
      ))}

      {signals.map((item, i) => (
        <SmallCircle key={`signal-${i}`} x={item.x} y={item.y} fill="#BA7517" />
      ))}

      {benches.map((item, i) => (
        <SmallSquare key={`bench-${i}`} x={item.x} y={item.y} fill="#5F5E5A" />
      ))}

      {lamps.map((item, i) => (
        <SmallCircle key={`lamp-${i}`} x={item.x} y={item.y} fill="#185FA5" />
      ))}

      {visibleSites.map((site, index) => {
        const isActive = selectedProjectedSite?.id === site.id && showPopup;

        return (
          <g
            key={site.id}
            onClick={() => onSelectSite(site)}
            style={{ cursor: "pointer" }}
          >
            <circle
              cx={site.x}
              cy={site.y}
              r={isActive ? 20 : 16}
              fill={isActive ? "#534AB7" : "#7F77DD"}
              opacity="0.95"
            />

            {isActive && (
              <circle
                cx={site.x}
                cy={site.y}
                r="23"
                fill="none"
                stroke="#534AB7"
                strokeWidth="1.5"
                opacity="0.4"
              />
            )}

            <text
              x={site.x}
              y={site.y + 5}
              textAnchor="middle"
              fontSize={isActive ? "13" : "12"}
              fontWeight="600"
              fill="white"
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
          fill="white"
          stroke="#3B6D11"
          strokeWidth="2"
        />
      )}

      {endPoint && (
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r="6"
          fill="white"
          stroke="#A32D2D"
          strokeWidth="2"
        />
      )}

      {selectedProjectedSite && showPopup && (
        <circle
          cx={selectedProjectedSite.x}
          cy={selectedProjectedSite.y}
          r="10"
          fill="none"
          stroke="#7F77DD"
          strokeWidth="2"
          opacity="0.5"
        >
          <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}