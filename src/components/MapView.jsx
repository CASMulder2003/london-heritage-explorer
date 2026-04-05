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
  
  const trees = [
    { x: 140, y: 585 },
    { x: 160, y: 570 },
    { x: 245, y: 430 },
    { x: 305, y: 365 },
    { x: 390, y: 260 },
    { x: 515, y: 165 },
  ];
  
  const busStops = [
    { x: 180, y: 510 },
    { x: 250, y: 455 },
    { x: 340, y: 350 },
    { x: 470, y: 180 },
  ];
  
  const signals = [
    { x: 150, y: 500 },
    { x: 235, y: 418 },
    { x: 355, y: 325 },
    { x: 455, y: 205 },
  ];
  
  const benches = [
    { x: 175, y: 565 },
    { x: 285, y: 390 },
    { x: 420, y: 245 },
  ];
  
  const lamps = [
    { x: 130, y: 610 },
    { x: 220, y: 470 },
    { x: 325, y: 335 },
    { x: 530, y: 145 },
  ];
  
  export default function MapView({
    routeType,
    heritageSites,
    selectedSite,
    showPopup,
    onSelectSite,
  }) {
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
  
        <path
          d="M100 600 C150 540, 190 500, 200 450 S255 425, 290 405 S340 340, 370 300 S450 180, 500 120"
          fill="none"
          stroke="#7F77DD"
          strokeWidth="5"
          strokeDasharray={routeType === "adventure" ? "10 9" : "0"}
          strokeLinecap="round"
        />
  
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
  
        {heritageSites.map((site) => {
          const isActive = selectedSite?.id === site.id && showPopup;
  
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
                {site.id}
              </text>
            </g>
          );
        })}
  
        <circle cx="100" cy="600" r="6" fill="white" stroke="#3B6D11" strokeWidth="2" />
        <circle cx="500" cy="120" r="6" fill="white" stroke="#A32D2D" strokeWidth="2" />
  
        <circle cx="200" cy="500" r="10" fill="none" stroke="#7F77DD" strokeWidth="2" opacity="0.5">
          <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    );
  }