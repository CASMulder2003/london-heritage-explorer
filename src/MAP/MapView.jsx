import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cues, cueCategories } from "../data/cues";
import NarrativePanel from "../panel/NarrativePanel";
import SegmentLayer from "./SegmentLayer";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const LONDON_CENTER = [-0.131, 51.5205];

function createHeritageMarker(
  isActive = false,
  isEndpoint = false,
  isMuted = false
) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `heritage-marker${isActive ? " active" : ""}${
    isEndpoint ? " endpoint" : ""
  }${isMuted ? " muted" : ""}`;
  el.setAttribute("aria-label", "Heritage site marker");
  return el;
}

function featureCollectionFromDirections(data) {
  return {
    type: "Feature",
    properties: {},
    geometry: data.routes[0].geometry,
  };
}

function buildFallbackRoute(
  startSite,
  endSite,
  routeType = "direct",
  visibleHeritageSites = []
) {
  if (!startSite || !endSite) {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [],
      },
    };
  }

  const coordinates = [[startSite.lng, startSite.lat]];

  if (routeType === "adventure") {
    const middleSites = visibleHeritageSites.filter(
      (site) => site.name !== startSite.name && site.name !== endSite.name
    );

    middleSites.forEach((site) => {
      coordinates.push([site.lng, site.lat]);
    });
  }

  coordinates.push([endSite.lng, endSite.lat]);

  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

function getNarrativeCopy(routeType, travelMode, timeMinutes, stopCount, cueCount) {
  const modeLabel = travelMode === "cycle" ? "cycle" : "walk";

  if (routeType === "adventure") {
    if (timeMinutes <= 60) {
      return {
        title: "Explore through urban cues",
        description: `A short exploratory ${modeLabel} that begins to loosen the commute. Heritage stops and everyday cues work together to shift attention away from direct instruction and toward the character of the street.`,
      };
    }

    if (timeMinutes <= 120) {
      return {
        title: "A wider corridor of discovery",
        description: `This exploratory ${modeLabel} uses ${stopCount} heritage stops and ${cueCount} cues to stretch the journey into a richer urban corridor. The route is still readable, but it opens more room for drift, noticing, and spatial interpretation.`,
      };
    }

    return {
      title: "A slower spatial story",
      description: `This longer exploratory ${modeLabel} prioritises atmosphere over efficiency. The route moves through a broader sequence of landmarks and cues, encouraging the city itself to guide the journey rather than a single prescribed line.`,
    };
  }

  return {
    title: "A guided route with local anchors",
    description: `This guided ${modeLabel} keeps the destination legible while still threading nearby heritage and urban cues into the journey. It supports movement without turning the city into background.`,
  };
}

function projectMeters(lng, lat) {
  const x = lng * 111320 * Math.cos((lat * Math.PI) / 180);
  const y = lat * 110540;
  return [x, y];
}

function unprojectMeters(x, y, referenceLat) {
  const lng = x / (111320 * Math.cos((referenceLat * Math.PI) / 180));
  const lat = y / 110540;
  return [lng, lat];
}

function pointToSegmentDistanceMeters(point, start, end) {
  const [px, py] = projectMeters(point[0], point[1]);
  const [x1, y1] = projectMeters(start[0], start[1]);
  const [x2, y2] = projectMeters(end[0], end[1]);

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  );

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return Math.hypot(px - nearestX, py - nearestY);
}

function nearestPointOnSegment(point, start, end) {
  const [px, py] = projectMeters(point[0], point[1]);
  const [x1, y1] = projectMeters(start[0], start[1]);
  const [x2, y2] = projectMeters(end[0], end[1]);

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return {
      coordinates: start,
      t: 0,
      distance: Math.hypot(px - x1, py - y1),
    };
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
  );

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return {
    coordinates: unprojectMeters(nearestX, nearestY, point[1]),
    t,
    distance: Math.hypot(px - nearestX, py - nearestY),
  };
}

function nearestPointOnPolyline(point, coordinates) {
  if (!coordinates || coordinates.length < 2) {
    return { coordinates: point, progress: 0, distance: Infinity };
  }

  let bestDistance = Infinity;
  let bestPoint = point;
  let bestProgress = 0;

  let totalLength = 0;
  const segmentLengths = [];

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [x1, y1] = projectMeters(coordinates[i][0], coordinates[i][1]);
    const [x2, y2] = projectMeters(coordinates[i + 1][0], coordinates[i + 1][1]);
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    segmentLengths.push(segLen);
    totalLength += segLen;
  }

  let traversed = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const result = nearestPointOnSegment(point, coordinates[i], coordinates[i + 1]);
    const segLen = segmentLengths[i];

    if (result.distance < bestDistance) {
      bestDistance = result.distance;
      bestPoint = result.coordinates;
      bestProgress =
        totalLength === 0 ? 0 : (traversed + segLen * result.t) / totalLength;
    }

    traversed += segLen;
  }

  return {
    coordinates: bestPoint,
    progress: bestProgress,
    distance: bestDistance,
  };
}

function pointProgressAlongPolyline(point, coordinates) {
  return nearestPointOnPolyline(point, coordinates).progress;
}

function isPointNearRoute(point, coordinates, thresholdMeters = 120) {
  if (!coordinates || coordinates.length < 2) return false;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const distance = pointToSegmentDistanceMeters(
      point,
      coordinates[i],
      coordinates[i + 1]
    );

    if (distance <= thresholdMeters) return true;
  }

  return false;
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || `${item.lng}-${item.lat}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickDistributed(items, count) {
  if (items.length <= count) return items;
  if (count <= 0) return [];

  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor((i * items.length) / count);
    if (items[index]) picked.push(items[index]);
  }
  return dedupeById(picked);
}

function buildCueGroups(routeType, routeFeature, timeMinutes = 90) {
  const routeCoordinates = routeFeature?.geometry?.coordinates || [];
  const isAdventure = routeType === "adventure";
  const minutes = timeMinutes;

  const thresholds = {
    heritage: isAdventure ? 120 : 80,
    transit: isAdventure ? 90 : 70,
    shade: isAdventure ? 100 : 75,
    rest: isAdventure ? 85 : 65,
    crossing: isAdventure ? 75 : 55,
    rhythm: isAdventure ? 80 : 60,
    lighting: isAdventure ? 85 : 60,
    threshold: isAdventure ? 80 : 60,
    water: isAdventure ? 110 : 80,
  };

  let limits;

  if (isAdventure) {
    if (minutes <= 30) {
      limits = {
        heritage: 2,
        transit: 3,
        shade: 3,
        rest: 2,
        crossing: 2,
        rhythm: 1,
        lighting: 2,
        threshold: 1,
        water: 1,
      };
    } else if (minutes <= 60) {
      limits = {
        heritage: 4,
        transit: 6,
        shade: 6,
        rest: 4,
        crossing: 4,
        rhythm: 3,
        lighting: 4,
        threshold: 3,
        water: 2,
      };
    } else if (minutes <= 90) {
      limits = {
        heritage: 5,
        transit: 8,
        shade: 8,
        rest: 5,
        crossing: 5,
        rhythm: 4,
        lighting: 5,
        threshold: 4,
        water: 2,
      };
    } else if (minutes <= 120) {
      limits = {
        heritage: 7,
        transit: 10,
        shade: 10,
        rest: 6,
        crossing: 6,
        rhythm: 5,
        lighting: 6,
        threshold: 5,
        water: 3,
      };
    } else if (minutes <= 150) {
      limits = {
        heritage: 8,
        transit: 12,
        shade: 12,
        rest: 7,
        crossing: 7,
        rhythm: 6,
        lighting: 7,
        threshold: 6,
        water: 3,
      };
    } else if (minutes <= 180) {
      limits = {
        heritage: 8,
        transit: 11,
        shade: 12,
        rest: 7,
        crossing: 6,
        rhythm: 5,
        lighting: 7,
        threshold: 5,
        water: 3,
      };
    } else {
      limits = {
        heritage: 9,
        transit: 13,
        shade: 14,
        rest: 8,
        crossing: 7,
        rhythm: 6,
        lighting: 8,
        threshold: 6,
        water: 4,
      };
    }
  } else {
    if (minutes <= 30) {
      limits = {
        heritage: 1,
        transit: 2,
        shade: 2,
        rest: 1,
        crossing: 1,
        rhythm: 0,
        lighting: 1,
        threshold: 0,
        water: 0,
      };
    } else if (minutes <= 60) {
      limits = {
        heritage: 2,
        transit: 3,
        shade: 3,
        rest: 2,
        crossing: 2,
        rhythm: 1,
        lighting: 2,
        threshold: 1,
        water: 1,
      };
    } else if (minutes <= 90) {
      limits = {
        heritage: 2,
        transit: 4,
        shade: 4,
        rest: 2,
        crossing: 2,
        rhythm: 1,
        lighting: 2,
        threshold: 1,
        water: 1,
      };
    } else {
      limits = {
        heritage: 3,
        transit: 5,
        shade: 5,
        rest: 3,
        crossing: 3,
        rhythm: 2,
        lighting: 3,
        threshold: 2,
        water: 1,
      };
    }
  }
 

  function prepareItems(items, threshold) {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];

    return items
      .map((item) => {
        const nearest = nearestPointOnPolyline([item.lng, item.lat], routeCoordinates);

        return {
          ...item,
          snappedLng: nearest.coordinates[0],
          snappedLat: nearest.coordinates[1],
          progress: nearest.progress,
          distanceToRoute: nearest.distance,
        };
      })
      .filter((item) => item.distanceToRoute <= threshold);
  }

  return cueCategories.map((category) => {
    const prepared = prepareItems(
      cues.filter((item) => item.type === category.key),
      thresholds[category.key] || 120
    );

    const sorted = [...prepared].sort((a, b) => a.progress - b.progress);
    const limit = limits[category.key] ?? sorted.length;

    const segmentCount = isAdventure ? 6 : 4;
    const bins = Array.from({ length: segmentCount }, () => []);
    
    sorted.forEach((item) => {
      const index = Math.min(
        segmentCount - 1,
        Math.floor(item.progress * segmentCount)
      );
      bins[index].push(item);
    });

const picksPerBin = Math.max(1, Math.ceil(limit / bins.length));

const picked =
  limit === 0
    ? []
    : bins
        .flatMap((bin) => pickDistributed(bin, picksPerBin))
        .slice(0, limit);

    return {
      key: category.key,
      label: category.label,
      items: picked,
      type: category.key,
      color: category.color,
    };
  });
}

function getRouteLengthMeters(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [x1, y1] = projectMeters(coordinates[i][0], coordinates[i][1]);
    const [x2, y2] = projectMeters(coordinates[i + 1][0], coordinates[i + 1][1]);
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

function getPointAtDistanceAlongRoute(coordinates, targetDistance) {
  if (!coordinates || coordinates.length < 2) return null;

  let traversed = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const start = coordinates[i];
    const end = coordinates[i + 1];

    const [x1, y1] = projectMeters(start[0], start[1]);
    const [x2, y2] = projectMeters(end[0], end[1]);
    const segLen = Math.hypot(x2 - x1, y2 - y1);

    if (segLen === 0) continue;

    if (traversed + segLen >= targetDistance) {
      const t = (targetDistance - traversed) / segLen;
      const lng = start[0] + (end[0] - start[0]) * t;
      const lat = start[1] + (end[1] - start[1]) * t;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const normalX = segLen === 0 ? 0 : -dy / segLen;
      const normalY = segLen === 0 ? 0 : dx / segLen;

      return {
        coordinates: [lng, lat],
        normal: [normalX, normalY],
        progress: targetDistance / Math.max(getRouteLengthMeters(coordinates), 1),
      };
    }

    traversed += segLen;
  }

  return {
    coordinates: coordinates[coordinates.length - 1],
    normal: [0, 0],
    progress: 1,
  };
}

function buildGeneratedCueFeatures(routeFeature, routeType, timeMinutes = 90) {
  const coordinates = routeFeature?.geometry?.coordinates || [];
  if (coordinates.length < 2) return [];

  const routeLength = getRouteLengthMeters(coordinates);
  if (!routeLength) return [];

  const isMobileView =
    typeof window !== "undefined" && window.innerWidth <= 768;

  const baseCount =
    routeType === "adventure"
      ? timeMinutes <= 30
        ? 6
        : timeMinutes <= 60
        ? 10
        : timeMinutes <= 90
        ? 14
        : timeMinutes <= 120
        ? 18
        : timeMinutes <= 150
        ? 22
        : timeMinutes <= 180
        ? 26
        : timeMinutes <= 210
        ? 30
        : 34
      : timeMinutes <= 30
      ? 2
      : timeMinutes <= 60
      ? 4
      : timeMinutes <= 90
      ? 5
      : timeMinutes <= 120
      ? 6
      : 7;

  const adjustedCount = isMobileView
    ? Math.max(4, Math.round(baseCount * 0.7))
    : baseCount;

  const offsetMeters = isMobileView
    ? routeType === "adventure"
      ? 7
      : 4
    : routeType === "adventure"
    ? 10
    : 6;

  const generatedTypes =
    routeType === "adventure"
      ? ["transit", "shade", "crossing", "rest", "lighting", "shade"]
      : ["transit", "crossing", "shade"];

  const features = [];

  for (let i = 0; i < adjustedCount; i += 1) {
    const progress = (i + 1) / (adjustedCount + 1);
    const targetDistance = routeLength * progress;
    const point = getPointAtDistanceAlongRoute(coordinates, targetDistance);

    if (!point) continue;

    const [lng, lat] = point.coordinates;
    const [nx, ny] = point.normal;
    const side = i % 2 === 0 ? 1 : -1;

    const projected = projectMeters(lng, lat);
    const displacedX = projected[0] + nx * offsetMeters * side;
    const displacedY = projected[1] + ny * offsetMeters * side;
    const displaced = unprojectMeters(displacedX, displacedY, lat);

    const snappedBack = nearestPointOnPolyline(displaced, coordinates);
    const categoryKey = generatedTypes[i % generatedTypes.length];
    const category =
      cueCategories.find((item) => item.key === categoryKey) || cueCategories[0];

    features.push({
      type: "Feature",
      properties: {
        id: `generated-${categoryKey}-${i}`,
        type: categoryKey,
        label: category.label,
        name: category.label,
        description: `This ${category.label.toLowerCase()} cue reinforces the rhythm of the route, letting the journey unfold through small spatial changes rather than explicit instruction.`,
        generated: true,
      },
      geometry: {
        type: "Point",
        coordinates: snappedBack.coordinates,
      },
    });
  }

  return features;
}

function buildCueCorridorGeoJSON(
  cueGroups,
  routeFeature,
  routeType,
  timeMinutes = 90
) {
  const features = [];

  cueGroups.forEach((group) => {
    group.items.forEach((item) => {
      features.push({
        type: "Feature",
        properties: {
          id: item.id || `${group.key}-${item.lng}-${item.lat}`,
          type: group.key,
          label: group.label,
          name: item.name || group.label,
          description:
  item.description ||
  `This ${group.label.toLowerCase()} cue marks a subtle shift in the journey, drawing attention to how the street opens, slows, or redirects movement.`,
        },
        geometry: {
          type: "Point",
          coordinates: [
            item.snappedLng ?? item.lng,
            item.snappedLat ?? item.lat,
          ],
        },
      });
    });
  });

  const generated = buildGeneratedCueFeatures(routeFeature, routeType, timeMinutes);
  features.push(...generated);

  return {
    type: "FeatureCollection",
    features,
  };
}

function getCueKeysForStepType(stepType) {
  switch (stepType) {
    case "start":
      return ["heritage", "threshold", "shade"];
    case "orientation":
      return ["transit", "crossing", "threshold"];
    case "intensity":
      return ["heritage", "transit", "lighting"];
    case "transition":
      return ["rest", "shade", "threshold"];
    case "arrival":
      return ["heritage", "rest", "lighting"];
    default:
      return [];
  }
}

export default function MapView({
  startSite,
  endSite,
  heritageSites = [],
  routeStops = [],
  travelMode = "walk",
  routeType = "direct",
  timeMinutes = 90,
  stats = {},
  onSelectHeritage,
  selectedHeritage,
  narrativeSteps = [],
  selectedNarrativeStep,
  setSelectedNarrativeStep,
  selectedCue,
  setSelectedCue,
  sourceLabel = "Mapbox",
  storyOpen = true,
  setStoryOpen,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const heritageMarkersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [activePopupSite, setActivePopupSite] = useState(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [highlightedCue, setHighlightedCue] = useState(null);
  const isMobileView = typeof window !== "undefined" && window.innerWidth <= 768;



  const [visibleLayers, setVisibleLayers] = useState({
    heritage: true,
    transit: true,
    shade: true,
    rest: true,
    crossing: true,
    rhythm: true,
    lighting: true,
    threshold: true,
    water: true,
  });

  const routeProfile = useMemo(
    () => (travelMode === "cycle" ? "cycling" : "walking"),
    [travelMode]
  );

  const middleCount = useMemo(() => {
    if (routeType !== "adventure") return 1;
    if (timeMinutes <= 30) return 1;
    if (timeMinutes <= 60) return 2;
    if (timeMinutes <= 90) return 3;
    if (timeMinutes <= 120) return 4;
    if (timeMinutes <= 180) return 5;
    return 6;
  }, [routeType, timeMinutes]);

  const visibleHeritageSites = routeStops;


  const cueGroups = useMemo(
    () => buildCueGroups(routeType, currentRoute, timeMinutes),
    [routeType, currentRoute, timeMinutes]
  );

  const visibleCueGroups = useMemo(
    () => cueGroups.filter((group) => visibleLayers[group.key]),
    [cueGroups, visibleLayers]
  );

  const activeCueKeys = useMemo(() => {
    return getCueKeysForStepType(selectedNarrativeStep?.type);
  }, [selectedNarrativeStep]);

const generatedCueCount = useMemo(() => {
  if (!currentRoute?.geometry?.coordinates?.length) return 0;

  if (routeType === "adventure") {
    if (timeMinutes <= 30) return 6;
    if (timeMinutes <= 60) return 10;
    if (timeMinutes <= 90) return 14;
    if (timeMinutes <= 120) return 18;
    if (timeMinutes <= 150) return 22;
    if (timeMinutes <= 180) return 26;
    if (timeMinutes <= 210) return 30;
    return 34;
  }

  if (timeMinutes <= 30) return 2;
  if (timeMinutes <= 60) return 4;
  if (timeMinutes <= 90) return 5;
  if (timeMinutes <= 120) return 6;
  return 7;
}, [currentRoute, routeType, timeMinutes]);



  const actualCueCount = useMemo(() => {
    const visiblePickedCueCount = visibleCueGroups.reduce(
      (sum, group) => sum + group.items.length,
      0
    );

    return visiblePickedCueCount + generatedCueCount;
  }, [visibleCueGroups, generatedCueCount]);

  const displayCueCount = useMemo(() => {
    if (actualCueCount > 0) return actualCueCount;
  
    if (routeType === "adventure") {
      if (timeMinutes <= 30) return 10;
      if (timeMinutes <= 60) return 14;
      if (timeMinutes <= 90) return 23;
      if (timeMinutes <= 120) return 30;
      if (timeMinutes <= 180) return 40;
      return 48;
    }
  
    if (timeMinutes <= 30) return 4;
    if (timeMinutes <= 60) return 8;
    if (timeMinutes <= 90) return 10;
    return 12;
  }, [actualCueCount, routeType, timeMinutes]);

  const narrativeCopy = useMemo(
    () =>
      getNarrativeCopy(
        routeType,
        travelMode,
        timeMinutes,
        visibleHeritageSites.length,
        actualCueCount
      ),
    [routeType, travelMode, timeMinutes, visibleHeritageSites.length, actualCueCount]
  );
  
  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !mapContainerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/yutongchen/cmo8pfvxp002e01rx798ne9l7",
      center: LONDON_CENTER,
      zoom: 12.8,
      attributionControl: false,
    });

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      map.addSource("cue-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "route-corridor",
        type: "line",
        source: "route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#5A7A8C",
          "line-width": 12,
          "line-opacity": 0.3,
          "line-blur": 0,
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#5A7A8C",
          "line-width": 8,
          "line-opacity": 1,
          "line-dasharray": [1, 0],
        },
      });

      map.addLayer({
        id: "cue-halo",
        type: "circle",
        source: "cue-points",
        paint: {
          "circle-radius": isMobileView
            ? [
                "match",
                ["get", "type"],
                "shade", 12,
                "water", 11,
                "lighting", 10,
                "transit", 10,
                "crossing", 9,
                "rest", 8,
                "threshold", 9,
                "rhythm", 8,
                8,
              ]
            : [
                "match",
                ["get", "type"],
                "shade", 16,
                "water", 15,
                "lighting", 13,
                "transit", 13,
                "crossing", 12,
                "rest", 10,
                "threshold", 12,
                "rhythm", 10,
                10,
              ],
          "circle-color": [
            "match",
            ["get", "type"],
            "shade", "#508e76",
            "water", "#58939c",
            "lighting", "#D4AF37",
            "transit", "#4A5D6A",
            "crossing", "#4d4058",
            "rest", "#8f7157",
            "threshold", "#7B506F",
            "rhythm", "#5b5649",
            "#999999",
          ],
          "circle-opacity": isMobileView ? 0.1 : 0.12,
          "circle-blur": isMobileView ? 0.12 : 0.16,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: "cue-core",
        type: "circle",
        source: "cue-points",
        paint: {
          "circle-radius": isMobileView
          ? [
              "case",
              ["==", ["get", "generated"], true],
              3,
              [
                "match",
                ["get", "type"],
                "threshold", 6,
                "transit", 5,
                "lighting", 5,
                4
              ]
            ]
          : [
              "case",
              ["==", ["get", "generated"], true],
              5,
              [
                "match",
                ["get", "type"],
                "threshold", 9,
                "transit", 8,
                "lighting", 8,
                7
              ]
            ],
          "circle-color": [
            "match",
            ["get", "type"],
            "shade", "#508e76",
            "water", "#58939c",
            "lighting", "#D4AF37",
            "transit", "#4A5D6A",
            "crossing", "#4d4058",
            "rest", "#8f7157",
            "threshold", "#7B506F",
            "rhythm", "#5b5649",
            "#999999",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "generated"], true],
            0.82,
            0.92,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": isMobileView ? 1.4 : 1.8,
          "circle-stroke-opacity": 1,
        },
      });

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      heritageMarkersRef.current.forEach((marker) => marker.remove());
      heritageMarkersRef.current = [];
      setMapReady(false);
      setCurrentRoute(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleCueClick = (e) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const props = feature.properties || {};
      const coordinates = feature.geometry?.coordinates || [];

      setHighlightedCue((prev) => (prev === props.type ? null : props.type));
      setPopupDismissed(false);

      setActivePopupSite({
        id: props.id,
        name: props.name || props.label || "Urban cue",
        description:
          props.description ||
          "This cue helps structure attention and movement through the city.",
        lng: coordinates[0],
        lat: coordinates[1],
        isCue: true,
      });
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", "cue-core", handleCueClick);
    map.on("mouseenter", "cue-core", handleMouseEnter);
    map.on("mouseleave", "cue-core", handleMouseLeave);

    return () => {
      if (map.getLayer("cue-core")) {
        map.off("click", "cue-core", handleCueClick);
        map.off("mouseenter", "cue-core", handleMouseEnter);
        map.off("mouseleave", "cue-core", handleMouseLeave);
      }
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource("cue-points");
    if (!source) return;

    source.setData(
      buildCueCorridorGeoJSON(
        visibleCueGroups,
        currentRoute,
        routeType,
        timeMinutes
      )
    );
  }, [visibleCueGroups, currentRoute, routeType, timeMinutes, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
  
    if (map.getLayer("route-line")) {
      map.setLayoutProperty(
        "route-line",
        "visibility",
        routeType === "adventure" ? "none" : "visible"
      );
    
      if (routeType !== "adventure") {
        map.setPaintProperty("route-line", "line-color", "#5A7A8C");
        map.setPaintProperty("route-line", "line-opacity", 1);
        map.setPaintProperty("route-line", "line-width", 8);
        map.setPaintProperty("route-line", "line-dasharray", [1, 0]);
      }
    }
    
    if (map.getLayer("route-corridor")) {
      map.setLayoutProperty(
        "route-corridor",
        "visibility",
        routeType === "adventure" ? "none" : "visible"
      );
    
      if (routeType !== "adventure") {
        map.setPaintProperty("route-corridor", "line-color", "#5A7A8C");
        map.setPaintProperty("route-corridor", "line-opacity", 0.3);
        map.setPaintProperty("route-corridor", "line-width", 12);
      }
    }
  }, [routeType, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
  
    const visibleKeys = Object.entries(visibleLayers)
      .filter(([key, value]) => key !== "heritage" && value)
      .map(([key]) => key);
  
    const baseFilter =
      visibleKeys.length > 0
        ? ["in", ["get", "type"], ["literal", visibleKeys]]
        : ["==", ["get", "type"], "__none__"];
  
    const emphasizedKeys =
      highlightedCue && visibleLayers[highlightedCue]
        ? [highlightedCue]
        : activeCueKeys.filter((key) => visibleLayers[key]);

        const zoom = map.getZoom();

        const desktopGeneratedRadius =
          zoom < 14 ? 4 : zoom < 15.5 ? 5 : 6;
        
        const desktopPrimaryRadius =
          zoom < 14 ? 7 : zoom < 15.5 ? 9 : 11;
        
        const desktopSecondaryRadius =
          zoom < 14 ? 5 : zoom < 15.5 ? 7 : 8;
        
        const desktopMutedRadius =
          zoom < 14 ? 3 : zoom < 15.5 ? 4 : 5;    
  
    if (map.getLayer("cue-halo")) {
      map.setFilter("cue-halo", baseFilter);
  
      map.setPaintProperty(
        "cue-halo",
        "circle-opacity",
        emphasizedKeys.length
          ? [
              "case",
              ["in", ["get", "type"], ["literal", emphasizedKeys]],
              isMobileView ? 0.08 : 0.16,
              isMobileView ? 0.01 : 0.05,
            ]
          : isMobileView
          ? 0.01
          : 0.12
      );
  
      map.setPaintProperty(
        "cue-halo",
        "circle-radius",
        emphasizedKeys.length
          ? [
              "case",
              ["in", ["get", "type"], ["literal", emphasizedKeys]],
              isMobileView
                ? [
                    "match",
                    ["get", "type"],
                    "shade", 6,
                    "water", 6,
                    "lighting", 5,
                    "transit", 5,
                    "crossing", 4,
                    "rest", 4,
                    "threshold", 4,
                    "rhythm", 4,
                    4,
                  ]
                : [
                    "match",
                    ["get", "type"],
                    "shade", 14,
                    "water", 13,
                    "lighting", 12,
                    "transit", 12,
                    "crossing", 11,
                    "rest", 10,
                    "threshold", 11,
                    "rhythm", 10,
                    10,
                  ],
              isMobileView
                ? [
                    "match",
                    ["get", "type"],
                    "shade", 0,
                    "water", 0,
                    "lighting", 0,
                    "transit", 0,
                    "crossing", 0,
                    "rest", 0,
                    "threshold", 0,
                    "rhythm", 0,
                    0,
                  ]
                : [
                    "match",
                    ["get", "type"],
                    "shade", 8,
                    "water", 7,
                    "lighting", 7,
                    "transit", 7,
                    "crossing", 6,
                    "rest", 6,
                    "threshold", 6,
                    "rhythm", 6,
                    6,
                  ],
            ]
          : isMobileView
          ? [
              "match",
              ["get", "type"],
              "shade", 0,
              "water", 0,
              "lighting", 0,
              "transit", 0,
              "crossing", 0,
              "rest", 0,
              "threshold", 0,
              "rhythm", 0,
              0,
            ]
          : [
              "match",
              ["get", "type"],
              "shade", 14,
              "water", 13,
              "lighting", 12,
              "transit", 12,
              "crossing", 11,
              "rest", 10,
              "threshold", 11,
              "rhythm", 10,
              10,
            ]
      );
    }
  
    if (map.getLayer("cue-core")) {
      map.setFilter("cue-core", baseFilter);
  
      map.setPaintProperty(
        "cue-core",
        "circle-opacity",
        emphasizedKeys.length
          ? [
              "case",
              ["in", ["get", "type"], ["literal", emphasizedKeys]],
              ["case", ["==", ["get", "generated"], true], 0.82, 0.98],
              ["case", ["==", ["get", "generated"], true], 0.18, 0.28],
            ]
          : [
              "case",
              ["==", ["get", "generated"], true],
              0.82,
              0.92,
            ]
      );
  
      map.setPaintProperty(
        "cue-core",
        "circle-radius",
        emphasizedKeys.length
          ? [
              "case",
              ["in", ["get", "type"], ["literal", emphasizedKeys]],
              [
                "case",
                ["==", ["get", "generated"], true],
                isMobileView ? 4 : desktopGeneratedRadius,
                [
                  "match",
                  ["get", "type"],
                  "threshold", isMobileView ? 7 : desktopPrimaryRadius,
                  "transit", isMobileView ? 6 : desktopPrimaryRadius - 1,
                  "lighting", isMobileView ? 6 : desktopPrimaryRadius - 1,
                  isMobileView ? 5 : desktopSecondaryRadius,
                ],
              ],
              [
                "case",
                ["==", ["get", "generated"], true],
                isMobileView ? 2 : desktopMutedRadius,
                [
                  "match",
                  ["get", "type"],
                  "threshold", isMobileView ? 4 : desktopSecondaryRadius - 1,
                  "transit", isMobileView ? 3 : desktopMutedRadius,
                  "lighting", isMobileView ? 3 : desktopMutedRadius,
                  isMobileView ? 3 : desktopMutedRadius,
                ],
              ],
            ]
          : [
              "case",
              ["==", ["get", "generated"], true],
              isMobileView ? 3 : desktopGeneratedRadius,
              [
                "match",
                ["get", "type"],
                "threshold", isMobileView ? 6 : desktopPrimaryRadius - 1,
                "transit", isMobileView ? 5 : desktopSecondaryRadius,
                "lighting", isMobileView ? 5 : desktopSecondaryRadius,
                isMobileView ? 4 : desktopMutedRadius + 2,
              ],
            ]
      );
    }
  }, [visibleLayers, highlightedCue, activeCueKeys, routeType, mapReady, isMobileView, currentRoute]);
  
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    heritageMarkersRef.current.forEach((marker) => marker.remove());
    heritageMarkersRef.current = [];

    if (!visibleLayers.heritage) return;

    visibleHeritageSites.forEach((site) => {
      const isActive = selectedHeritage?.id === site.id;
      const isEndpoint =
        site.name === startSite?.name || site.name === endSite?.name;

      const el = createHeritageMarker(isActive, isEndpoint);

      el.addEventListener("click", () => {
        setSelectedCue?.(null);
        onSelectHeritage?.(site);
        setPopupDismissed(false);
        setActivePopupSite(site);
      });

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center",
      })
        .setLngLat([site.lng, site.lat])
        .addTo(map);

      heritageMarkersRef.current.push(marker);
    });
  }, [
    visibleHeritageSites,
    selectedHeritage,
    onSelectHeritage,
    startSite,
    endSite,
    mapReady,
    visibleLayers.heritage,
  ]);

  useEffect(() => {
    const focusSite = selectedHeritage || activePopupSite;
    const map = mapRef.current;
    if (!map || !mapReady || !focusSite) return;

    map.flyTo({
      center: [focusSite.lng, focusSite.lat],
      zoom: 14.4,
      offset: [140, 0],
      duration: 800,
      essential: true,
    });
  }, [selectedHeritage, activePopupSite, mapReady]);

  useEffect(() => {
    if (!selectedCue) return;
  
    setPopupDismissed(false);
    setActivePopupSite({
      id: selectedCue.id,
      name: selectedCue.name || selectedCue.label || "Spatial cue",
      description:
        selectedCue.description ||
        "This spatial cue helps structure attention and movement through the city.",
      lng: selectedCue.snappedLng ?? selectedCue.lng,
      lat: selectedCue.snappedLat ?? selectedCue.lat,
      isCue: true,
    });
  }, [selectedCue]);

  useEffect(() => {
    setPopupDismissed(false);
    setActivePopupSite(null);
    setHighlightedCue(null);
    setSelectedCue?.(null);
  }, [startSite, endSite, routeType, timeMinutes, setSelectedCue]);
  
  useEffect(() => {
    if (!selectedHeritage || !narrativeSteps.length) return;
  
    const matchedStep = narrativeSteps.find(
      (step) =>
        step.heritage?.id === selectedHeritage.id ||
        step.heritage?.name === selectedHeritage.name
    );
  
    if (
      matchedStep &&
      matchedStep.id !== selectedNarrativeStep?.id
    ) {
      setSelectedNarrativeStep?.(matchedStep);
    }
  }, [
    selectedHeritage,
    narrativeSteps,
    selectedNarrativeStep,
    setSelectedNarrativeStep,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !startSite || !endSite) return;

    const controller = new AbortController();

    async function loadRoute() {
      try {
        let coordinatesForDirections = [
          `${startSite.lng},${startSite.lat}`,
          `${endSite.lng},${endSite.lat}`,
        ].join(";");

        if (routeType === "adventure" && visibleHeritageSites.length > 2) {
          const viaSites = visibleHeritageSites
            .filter(
              (site) =>
                site.name !== startSite?.name &&
                site.name !== endSite?.name
            )
            .slice(0, middleCount);

          if (viaSites.length > 0) {
            coordinatesForDirections = [
              `${startSite.lng},${startSite.lat}`,
              ...viaSites.map((site) => `${site.lng},${site.lat}`),
              `${endSite.lng},${endSite.lat}`,
            ].join(";");
          }
        }

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/${routeProfile}/` +
          `${coordinatesForDirections}` +
          `?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to fetch directions");

        const data = await response.json();
        if (!data.routes?.length) throw new Error("No route returned");

        const routeGeoJSON = featureCollectionFromDirections(data);
        const source = map.getSource("route");

        if (source) {
          source.setData(routeGeoJSON);
        }

        setCurrentRoute(routeGeoJSON);

        const bounds = new mapboxgl.LngLatBounds();
        routeGeoJSON.geometry.coordinates.forEach((coord) => bounds.extend(coord));

        visibleHeritageSites.forEach((site) => {
          bounds.extend([site.lng, site.lat]);
        });

        map.fitBounds(bounds, {
          padding: { top: 100, right: 120, bottom: 110, left: 120 },
          maxZoom: routeType === "adventure" ? 13.8 : 14,
          duration: 900,
        });
      } catch (error) {
        if (error.name === "AbortError") return;

        const fallbackRoute = buildFallbackRoute(
          startSite,
          endSite,
          routeType,
          visibleHeritageSites
        );

        const source = map.getSource("route");
        if (source) {
          source.setData(fallbackRoute);
        }

        setCurrentRoute(fallbackRoute);

        const bounds = new mapboxgl.LngLatBounds();
        fallbackRoute.geometry.coordinates.forEach((coord) => bounds.extend(coord));
        visibleHeritageSites.forEach((site) => bounds.extend([site.lng, site.lat]));

        map.fitBounds(bounds, {
          padding: { top: 100, right: 120, bottom: 110, left: 120 },
          maxZoom: routeType === "adventure" ? 13.8 : 14,
          duration: 900,
        });

        console.error(error);
      }
    }

    loadRoute();

    return () => controller.abort();
  }, [
    startSite,
    endSite,
    visibleHeritageSites,
    routeProfile,
    routeType,
    mapReady,
    middleCount,
  ]);

  useEffect(() => {
    if (!currentRoute || !visibleHeritageSites.length) return;
    if (popupDismissed) return;
    if (selectedHeritage || activePopupSite) return;

    const middleSite = visibleHeritageSites.find(
      (site) => site.name !== startSite?.name && site.name !== endSite?.name
    );

    if (middleSite) {
      setActivePopupSite(middleSite);
    }
  }, [
    currentRoute,
    visibleHeritageSites,
    selectedHeritage,
    activePopupSite,
    popupDismissed,
    startSite,
    endSite,
  ]);

  const popupSite = popupDismissed ? null : activePopupSite || selectedHeritage;
  const routeSummary = {
    travelLabel: travelMode === "cycle" ? "Cycle" : "Walk",
    timeLabel:
      timeMinutes < 60
        ? `${timeMinutes} min`
        : `${Math.floor(timeMinutes / 60)}h${
            timeMinutes % 60 ? ` ${timeMinutes % 60}m` : ""
          }`,
    stopCount: visibleHeritageSites.length,
    cueCount: displayCueCount,
    startName: startSite?.name || "Start",
    endName: endSite?.name || "End",
  };
  
  return (
    <div className="map-view">

      <div className="map-overlay top-right">
        <div className="map-badge">
          <strong>
            {routeType === "adventure" ? "Explore freely" : "Guided exploration"}
          </strong>
          <span>{travelMode === "cycle" ? "Cycle" : "Walk"}</span>
        </div>
      </div>
      <div className="map-overlay bottom-right story-toggle-wrap">
  <button
    type="button"
    className={`story-toggle-button ${storyOpen ? "open" : ""}`}
    onClick={() => setStoryOpen?.(!storyOpen)}
  >
    {storyOpen ? "Hide story" : "Story"}
  </button>
</div>

      <div className="map-overlay bottom-left">
        <div className="map-legend-shell">
          <button
            type="button"
            className="legend-button"
            onClick={() => setLegendOpen((prev) => !prev)}
          >
            {legendOpen ? "Hide legend" : "Legend"}
          </button>

          {legendOpen ? (
            <div className="map-legend">
              <div className="legend-title">What guides your journey</div>

              <button
                type="button"
                className={`legend-toggle ${visibleLayers.heritage ? "active" : ""}`}
                onClick={() =>
                  setVisibleLayers((prev) => ({
                    ...prev,
                    heritage: !prev.heritage,
                  }))
                }
              >
                <span className="legend-row">
                  <span className="legend-dot heritage" />
                  <span>Heritage sites</span>
                </span>
              </button>

              {cueCategories
                .filter(
                  (category) =>
                    category.key !== "heritage" &&
                    ["transit", "shade", "rest", "crossing", "lighting"].includes(
                      category.key
                    )
                )
                .map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={`legend-toggle ${
                      visibleLayers[category.key] ? "active" : ""
                    }`}
                    onClick={() => {
                      setVisibleLayers((prev) => ({
                        ...prev,
                        [category.key]: !prev[category.key],
                      }));
                      setHighlightedCue((prev) =>
                        prev === category.key ? null : category.key
                      );
                    }}
                  >
                    <span className="legend-row">
                      <span
                        className="legend-dot"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.label}</span>
                    </span>
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>

      {storyOpen && (
  <div className="map-story-drawer">
<NarrativePanel
  key={`${startSite?.name}-${endSite?.name}-${timeMinutes}-${routeType}-${visibleHeritageSites.length}-${displayCueCount}`}
  stats={stats}
  routeSummary={routeSummary}
  visibleHeritageSites={visibleHeritageSites}
  narrativeSteps={narrativeSteps}
  selectedHeritage={selectedHeritage}
  selectedNarrativeStep={selectedNarrativeStep}
  onSelectStep={(step) => {
    setSelectedNarrativeStep?.(step);
    if (step?.heritage) {
      onSelectHeritage?.(step.heritage);
    }
  }}
  startSite={startSite}
  endSite={endSite}
  safeTravelMode={travelMode}
  safeRouteType={routeType}
  onClose={() => setStoryOpen?.(false)}
/>
  </div>
)}

      {popupSite ? (
          <div className="heritage-popup with-story-open">
          <button
            type="button"
            className="popup-close"
            onClick={() => {
              setPopupDismissed(true);
              setActivePopupSite(null);
            }}
            aria-label="Close story popup"
          >
            ×
          </button>

          <div className="popup-num">
            {popupSite?.isCue
              ? "Cue"
              : Math.max(
                  1,
                  visibleHeritageSites.findIndex(
                    (site) => site.id === popupSite.id || site.name === popupSite.name
                  ) + 1
                )}
          </div>

          <div className="popup-img">Story stop</div>
          <div className="popup-meta">
          {popupSite?.isCue ? "Spatial cue" : "Heritage stop"}
          </div>
          <div className="popup-name">{popupSite.name}</div>
          <div className="popup-desc">
  {popupSite.description ||
    "This moment shifts the pace of the journey, letting attention move from destination alone toward the surrounding street, space, and atmosphere."}
</div>

          <button
            type="button"
            className="popup-link"
            onClick={() => onSelectHeritage?.(popupSite)}
          >
            {popupSite?.isCue ? "Use this cue" : "Explore this place"}
          </button>
        </div>
      ) : null}

{routeType !== "adventure" && (
  <SegmentLayer
    map={mapRef.current}
    mapReady={mapReady}
    currentRoute={currentRoute}
    narrativeSteps={narrativeSteps}
    selectedNarrativeStep={selectedNarrativeStep}
  />
)}

      <div ref={mapContainerRef} className="mapbox-map" />
    </div>
  );
}