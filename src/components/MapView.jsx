import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { cues, cueCategories } from "../data/cues";

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

    middleSites.slice(0, 3).forEach((site) => {
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

function getNarrativeCopy(routeType, travelMode) {
  const modeLabel = travelMode === "cycle" ? "cycle" : "walk";

  if (routeType === "adventure") {
    return {
      title: "Explore by landmark",
      description: `Use the map, numbered heritage stops, and environmental cues to guide your ${modeLabel}. The route is suggested as a loose urban corridor rather than a fixed instruction line.`,
    };
  }

  return {
    title: "Follow nearby heritage",
    description: `This ${modeLabel} view keeps the destination legible while still encouraging you to navigate through landmarks rather than strict turn-by-turn directions.`,
  };
}

function projectMeters(lng, lat) {
  const x = lng * 111320 * Math.cos((lat * Math.PI) / 180);
  const y = lat * 110540;
  return [x, y];
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

function pointProgressAlongPolyline(point, coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;

  const [px, py] = projectMeters(point[0], point[1]);

  let totalLength = 0;
  const segmentLengths = [];

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [x1, y1] = projectMeters(coordinates[i][0], coordinates[i][1]);
    const [x2, y2] = projectMeters(
      coordinates[i + 1][0],
      coordinates[i + 1][1]
    );
    const segLen = Math.hypot(x2 - x1, y2 - y1);
    segmentLengths.push(segLen);
    totalLength += segLen;
  }

  if (totalLength === 0) return 0;

  let bestDistance = Infinity;
  let bestProgress = 0;
  let traversed = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const [x1, y1] = projectMeters(coordinates[i][0], coordinates[i][1]);
    const [x2, y2] = projectMeters(
      coordinates[i + 1][0],
      coordinates[i + 1][1]
    );
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLen = segmentLengths[i];

    if (segLen === 0) {
      traversed += segLen;
      continue;
    }

    const t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
    );

    const nearestX = x1 + t * dx;
    const nearestY = y1 + t * dy;
    const distance = Math.hypot(px - nearestX, py - nearestY);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = (traversed + segLen * t) / totalLength;
    }

    traversed += segLen;
  }

  return bestProgress;
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

function buildCueGroups(routeType, routeFeature) {
  const routeCoordinates = routeFeature?.geometry?.coordinates || [];
  const isAdventure = routeType === "adventure";

  const thresholds = {
    heritage: isAdventure ? 260 : 160,
    transit: isAdventure ? 180 : 100,
    shade: isAdventure ? 220 : 120,
    rest: isAdventure ? 190 : 100,
    crossing: isAdventure ? 160 : 90,
    rhythm: isAdventure ? 170 : 95,
    lighting: isAdventure ? 190 : 105,
    threshold: isAdventure ? 180 : 100,
    water: isAdventure ? 260 : 150,
  };

  const limits = {
    heritage: isAdventure ? 4 : 2,
    transit: isAdventure ? 6 : 3,
    shade: isAdventure ? 6 : 3,
    rest: isAdventure ? 4 : 2,
    crossing: isAdventure ? 5 : 2,
    rhythm: isAdventure ? 4 : 2,
    lighting: isAdventure ? 5 : 2,
    threshold: isAdventure ? 4 : 2,
    water: isAdventure ? 3 : 1,
  };

  function prepareItems(items, threshold) {
    if (!routeCoordinates || routeCoordinates.length < 2) return [];

    return items
      .filter((item) =>
        isPointNearRoute([item.lng, item.lat], routeCoordinates, threshold)
      )
      .map((item) => ({
        ...item,
        progress: pointProgressAlongPolyline(
          [item.lng, item.lat],
          routeCoordinates
        ),
      }));
  }

  return cueCategories.map((category) => {
    const prepared = prepareItems(
      cues.filter((item) => item.type === category.key),
      thresholds[category.key] || 120
    );

    const sorted = [...prepared].sort((a, b) => a.progress - b.progress);
    const limit = limits[category.key] || sorted.length;

    const bins = [[], [], [], []];
    sorted.forEach((item) => {
      if (item.progress < 0.25) bins[0].push(item);
      else if (item.progress < 0.5) bins[1].push(item);
      else if (item.progress < 0.75) bins[2].push(item);
      else bins[3].push(item);
    });

    const picked = bins
    .flatMap((bin) =>
      pickDistributed(bin, Math.max(1, Math.floor(limit / 4)))
    )
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

function interpolatePointsAlongRoute(coordinates, steps = 18) {
  if (!coordinates || coordinates.length < 2) return [];

  const result = [];
  const totalSegments = coordinates.length - 1;

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const segmentFloat = t * totalSegments;
    const segmentIndex = Math.min(totalSegments - 1, Math.floor(segmentFloat));
    const localT = segmentFloat - segmentIndex;

    const start = coordinates[segmentIndex];
    const end = coordinates[segmentIndex + 1];

    const lng = start[0] + (end[0] - start[0]) * localT;
    const lat = start[1] + (end[1] - start[1]) * localT;

    result.push([lng, lat]);
  }

  return result;
}

function buildCueCorridorGeoJSON(cueGroups, routeFeature, routeType) {
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
            `${group.label} can help guide attention through the journey without relying on turn-by-turn instruction.`,
          generated: false,
        },
        geometry: {
          type: "Point",
          coordinates: [item.lng, item.lat],
        },
      });
    });
  });

  const coordinates = routeFeature?.geometry?.coordinates || [];

  if (coordinates.length >= 2) {
    const generatedPoints = interpolatePointsAlongRoute(
      coordinates,
      routeType === "adventure" ? 24 : 12
    );

    const generatedTypes =
      routeType === "adventure"
        ? ["transit", "shade", "crossing", "rest", "lighting", "shade"]
        : ["transit", "crossing", "shade"];

        generatedPoints.forEach((coord, index) => {
          if (routeType !== "adventure" && index % 2 !== 0) return;
        
          const type = generatedTypes[index % generatedTypes.length];
          const category =
            cueCategories.find((item) => item.key === type) || cueCategories[0];
        
          const spread = routeType === "adventure" ? 0.0014 : 0.0009;
          const lngOffset = (Math.random() - 0.5) * spread * 2;
          const latOffset = (Math.random() - 0.5) * spread * 0.6;
        
          features.push({
            type: "Feature",
            properties: {
              id: `generated-${type}-${index}`,
              type,
              label: category.label,
              name: category.label,
              description: `A ${category.label.toLowerCase()} cue reinforces the spatial character of this part of the route.`,
              generated: true,
            },
            geometry: {
              type: "Point",
              coordinates: [coord[0] + lngOffset, coord[1] + latOffset],
            },
          });
        });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export default function MapView({
  startSite,
  endSite,
  heritageSites = [],
  travelMode = "walk",
  routeType = "direct",
  timeMinutes = 90,
  stats = null,
  onSelectHeritage,
  selectedHeritage,
  sourceLabel = "Mapbox",
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

  const narrativeCopy = useMemo(
    () => getNarrativeCopy(routeType, travelMode),
    [routeType, travelMode]
  );

  const middleCount = useMemo(() => {
    const minutes = timeMinutes < 10 ? timeMinutes * 60 : timeMinutes;

    if (routeType !== "adventure") return 1;
    if (minutes <= 30) return 1;
    if (minutes <= 60) return 2;
    if (minutes <= 120) return 3;
    if (minutes <= 180) return 4;
    return 5;
  }, [routeType, timeMinutes]);

  const visibleHeritageSites = useMemo(() => {
    if (!startSite || !endSite) return [];

    const startAndEnd = [startSite, endSite].filter(Boolean);

const uniqueSites = (sites) =>
  sites.filter(
    (site, index, arr) =>
      arr.findIndex(
        (s) => s.lng === site.lng && s.lat === site.lat
      ) === index
  );

    const rankedSites = heritageSites
    .filter((site) => site.adventure)

      .map((site) => {
        const distToStart = Math.hypot(
          site.lng - startSite.lng,
          site.lat - startSite.lat
        );
        const distToEnd = Math.hypot(site.lng - endSite.lng, site.lat - endSite.lat);

        const routeBalance = Math.abs(distToStart - distToEnd);

        return {
          ...site,
          distToStart,
          distToEnd,
          routeBalance,
        };
      })
      .sort((a, b) => {
        if ((b.cueWeight || 0) !== (a.cueWeight || 0)) {
          return (b.cueWeight || 0) - (a.cueWeight || 0);
        }
        return a.routeBalance - b.routeBalance;
      });

    const routeLength = Math.hypot(
      endSite.lng - startSite.lng,
      endSite.lat - startSite.lat
    );

    if (routeType === "direct") {
      const guidedCount = routeLength < 0.015 ? 0 : routeLength < 0.03 ? 1 : 2;
      return uniqueSites([...startAndEnd, ...rankedSites.slice(0, guidedCount)]);
    }

    const candidates = rankedSites.filter(
      (site) =>
        site.name !== startSite?.name &&
        site.name !== endSite?.name
    );
    
    const middleSites = [];
    if (candidates.length > 0) {
      for (let i = 0; i < middleCount; i += 1) {
        const index = Math.floor(((i + 1) * candidates.length) / (middleCount + 1));
        if (candidates[index]) {
          middleSites.push(candidates[index]);
        }
      }
    }
    
    return uniqueSites([
      startSite,
      ...middleSites,
      endSite,
    ].filter(Boolean));

  }, [heritageSites, routeType, startSite, endSite, middleCount]);

  const cueGroups = useMemo(
    () => buildCueGroups(routeType, currentRoute),
    [routeType, currentRoute]
  );

  const cueCount = useMemo(
    () => cueGroups.reduce((sum, group) => sum + group.items.length, 0),
    [cueGroups]
  );

  useEffect(() => {
    if (!MAPBOX_TOKEN || mapRef.current || !mapContainerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
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
          "line-color": "#888",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12, 60,
            14, 120,
            16, 180
          ],
          "line-opacity": 0.12,
          "line-blur": 2.5,
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
          "line-color": "#888",
          "line-width": 3,
          "line-opacity": 0.25,
          "line-dasharray": [1, 0],
        },
      });

      map.addLayer({
        id: "cue-halo",
        type: "circle",
        source: "cue-points",
        paint: {
          "circle-radius": [
            "match",
            ["get", "type"],
            "shade", 34,
            "water", 30,
            "lighting", 24,
            "transit", 22,
            "crossing", 20,
            "rest", 18,
            "threshold", 20,
            "rhythm", 18,
            18,
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "shade", "#34C759",
            "water", "#36B5D8",
            "lighting", "#F4B942",
            "transit", "#3B82F6",
            "crossing", "#E74C3C",
            "rest", "#A2846A",
            "threshold", "#FF7AA2",
            "rhythm", "#C58B00",
            "#999999",
          ],
          "circle-opacity": 0.14,
          "circle-blur": 1.2,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: "cue-core",
        type: "circle",
        source: "cue-points",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "generated"], true],
            3,
            [
              "match",
              ["get", "type"],
              "threshold", 7,
              "transit", 6,
              5
            ]
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "shade", "#34C759",
            "water", "#36B5D8",
            "lighting", "#F4B942",
            "transit", "#3B82F6",
            "crossing", "#E74C3C",
            "rest", "#A2846A",
            "threshold", "#FF7AA2",
            "rhythm", "#C58B00",
            "#999999",
          ],
          "circle-opacity": [
            "case",
            ["==", ["get", "generated"], true],
            0.14,
            0.35,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-stroke-opacity": 0.9,
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

    const visibleCueGroups = cueGroups.filter((group) => visibleLayers[group.key]);

    source.setData(
      buildCueCorridorGeoJSON(visibleCueGroups, currentRoute, routeType)
    );
  }, [cueGroups, visibleLayers, currentRoute, routeType, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer("route-line")) {
      if (routeType === "adventure") {
        map.setPaintProperty("route-line", "line-opacity", 0.08);
        map.setPaintProperty("route-line", "line-width", 2);
        map.setPaintProperty("route-line", "line-dasharray", [1.2, 2.4]);
      } else {
        map.setPaintProperty("route-line", "line-opacity", 0.78);
        map.setPaintProperty("route-line", "line-width", 3.2);
        map.setPaintProperty("route-line", "line-dasharray", [1, 0]);
      }
    }

    if (map.getLayer("route-corridor")) {
      map.setPaintProperty(
        "route-corridor",
        "line-opacity",
        routeType === "adventure" ? 0.14 : 0.1
      );
      map.setPaintProperty(
        "route-corridor",
        "line-width",
        routeType === "adventure" ? 32 : 20
      );
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

    const highlightedFilter =
      highlightedCue && visibleLayers[highlightedCue]
        ? ["==", ["get", "type"], highlightedCue]
        : baseFilter;

   
        if (map.getLayer("cue-halo")) {
          map.setFilter("cue-halo", baseFilter);
        
          map.setPaintProperty(
            "cue-halo",
            "circle-opacity",
            highlightedCue
              ? 0.3
              : routeType === "adventure"
              ? 0.18
              : 0.12
          );
        
          map.setPaintProperty(
            "cue-halo",
            "circle-radius",
            routeType === "adventure"
            ? [
                "match",
                ["get", "type"],
                "shade", 36,
                "water", 36,
                "lighting", 28,
                "transit", 26,
                "crossing", 22,
                "rest", 20,
                "threshold", 22,
                "rhythm", 20,
                20,
              ]
              : [
                  "match",
                  ["get", "type"],
                  "shade", 34,
                  "water", 30,
                  "lighting", 24,
                  "transit", 22,
                  "crossing", 20,
                  "rest", 18,
                  "threshold", 20,
                  "rhythm", 18,
                  18,
                ]
          );
        }  

        if (map.getLayer("cue-core")) {
          map.setFilter("cue-core", highlightedFilter);
        
          map.setPaintProperty(
            "cue-core",
            "circle-opacity",
            highlightedCue
              ? [
                  "case",
                  ["==", ["get", "generated"], true],
                  0.22,
                  0.55,
                ]
              : [
                  "case",
                  ["==", ["get", "generated"], true],
                  0.12,
                  0.28,
                ]
          );
        }
  }, [visibleLayers, highlightedCue, routeType, mapReady]);

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
    if (selectedHeritage) {
      setActivePopupSite(selectedHeritage);
    }
  }, [selectedHeritage]);

  useEffect(() => {
    setPopupDismissed(false);
    setActivePopupSite(null);
    setHighlightedCue(null);
  }, [startSite, endSite, routeType, timeMinutes]);

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

  return (
    <div className="map-view">
      <div className="map-meta">
        <span>Source: {sourceLabel}</span>
      </div>

      <div className="map-overlay top-right">
        <div className="map-badge">
          <strong>
            {routeType === "adventure" ? "Explore freely" : "Guided exploration"}
          </strong>
          <span>{travelMode === "cycle" ? "Cycle" : "Walk"}</span>
        </div>
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

      <div className="map-overlay bottom-right">
        <div className="map-story-card">
          <h4>
            {routeType === "adventure"
              ? `Explore by landmark · ${visibleHeritageSites.length} stops`
              : narrativeCopy.title}
          </h4>
          <p>{narrativeCopy.description}</p>

          <div className="story-stats">
            <span>{visibleHeritageSites.length} stops</span>
            <span>{cueCount} cues</span>
            <span>{travelMode === "cycle" ? "Cycle mode" : "Walk mode"}</span>
          </div>
        </div>
      </div>

      {popupSite ? (
        <div className="heritage-popup">
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
            {popupSite?.isCue ? "Urban cue" : "Heritage anchor"}
          </div>
          <div className="popup-name">{popupSite.name}</div>
          <div className="popup-desc">
            {popupSite.description ||
              "This place turns the journey into a spatial story, using the city itself as a guide rather than relying on turn-by-turn instruction."}
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

      <div ref={mapContainerRef} className="mapbox-map" />
    </div>
  );
}