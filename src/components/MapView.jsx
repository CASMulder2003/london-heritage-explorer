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

function createFeatureMarker(type, prominence = 1, size = "support") {
  const el = document.createElement("div");
  el.className = `map-feature-marker ${type} prominence-${prominence} size-${size}`;
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

  if (routeType === "adventure" && visibleHeritageSites.length > 2) {
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

function getRoutePaint(routeType) {
  if (routeType === "adventure") {
    return {
      color: "#7c8799",
      width: 2,
      opacity: 0.12,
      dasharray: [2, 2],
      glowOpacity: 0,
    };
  }

  return {
    color: "#8b95a7",
    width: 3,
    opacity: 0.42,
    dasharray: [1.5, 1.5],
    glowOpacity: 0.06,
  };
}

function getNarrativeCopy(routeType, travelMode) {
  const modeLabel = travelMode === "cycle" ? "cycle" : "walk";

  if (routeType === "adventure") {
    return {
      title: "Cue-led exploration",
      description: `This ${modeLabel} journey foregrounds environmental cues and a smaller sequence of story stops, encouraging interpretation rather than strict turn-by-turn following.`,
    };
  }

  return {
    title: "Focused cultural connection",
    description: `This ${modeLabel} route keeps the journey legible and efficient while still surfacing key spatial cues and nearby heritage context.`,
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
    heritage: isAdventure ? 6 : 4,
    transit: isAdventure ? 8 : 5,
    shade: isAdventure ? 12 : 6,
    rest: isAdventure ? 6 : 4,
    crossing: isAdventure ? 8 : 5,
    rhythm: isAdventure ? 6 : 4,
    lighting: isAdventure ? 7 : 4,
    threshold: isAdventure ? 5 : 3,
    water: isAdventure ? 4 : 2,
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
        pickDistributed(bin, Math.max(1, Math.ceil(limit / 4)))
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
    const segmentIndex = Math.min(
      totalSegments - 1,
      Math.floor(segmentFloat)
    );
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
          type: group.key,
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
      routeType === "adventure" ? 18 : 12
    );

    const generatedTypes =
      routeType === "adventure"
        ? ["shade", "lighting", "rhythm", "threshold", "water"]
        : ["transit", "crossing", "shade"];

    generatedPoints.forEach((coord, index) => {
      const type = generatedTypes[index % generatedTypes.length];

      features.push({
        type: "Feature",
        properties: {
          type,
          generated: true,
        },
        geometry: {
          type: "Point",
          coordinates: coord,
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
  const featureMarkersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [activePopupSite, setActivePopupSite] = useState(null);

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

  const routePaint = useMemo(() => getRoutePaint(routeType), [routeType]);
  const narrativeCopy = useMemo(
    () => getNarrativeCopy(routeType, travelMode),
    [routeType, travelMode]
  );

  const visibleHeritageSites = useMemo(() => {
    if (!startSite || !endSite) return [];
  
    const startAndEnd = [startSite, endSite].filter(Boolean);
  
    if (routeType === "direct") {
      return startAndEnd.filter(
        (site, index, arr) =>
          arr.findIndex((s) => s.name === site.name) === index
      );
    }
  
    const otherSites = heritageSites
      .filter(
        (site) =>
          site.name !== startSite.name &&
          site.name !== endSite.name &&
          site.adventure
      )
      .map((site) => {
        const distToStart = Math.hypot(
          site.lng - startSite.lng,
          site.lat - startSite.lat
        );
        const distToEnd = Math.hypot(
          site.lng - endSite.lng,
          site.lat - endSite.lat
        );
  
        return {
          ...site,
          distToStart,
          distToEnd,
        };
      })
      .filter((site) => site.distToStart > 0.004 && site.distToEnd > 0.004)
      .sort((a, b) => {
        if ((b.cueWeight || 0) !== (a.cueWeight || 0)) {
          return (b.cueWeight || 0) - (a.cueWeight || 0);
        }
        return (
          Math.min(a.distToStart, a.distToEnd) -
          Math.min(b.distToStart, b.distToEnd)
        );
      });
  
    const routeLength = Math.hypot(
      endSite.lng - startSite.lng,
      endSite.lat - startSite.lat
    );
  
    const middleCount = routeLength < 0.02 ? 1 : 2;
  
    const middleAnchors = [];
    for (const site of otherSites) {
      const tooCloseToExisting = middleAnchors.some(
        (picked) =>
          Math.hypot(site.lng - picked.lng, site.lat - picked.lat) < 0.005
      );
  
      if (!tooCloseToExisting) {
        middleAnchors.push(site);
      }
  
      if (middleAnchors.length >= middleCount) break;
    }
  
    return [...startAndEnd, ...middleAnchors].filter(
      (site, index, arr) =>
        arr.findIndex((s) => s.name === site.name) === index
    );
  }, [heritageSites, routeType, startSite, endSite]);

  
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
        id: "cue-halo",
        type: "circle",
        source: "cue-points",
        paint: {
          "circle-radius": [
            "match",
            ["get", "type"],
            "shade", 34,
            "water", 30,
            "lighting", 22,
            "transit", 18,
            "crossing", 16,
            "rest", 15,
            "threshold", 18,
            "rhythm", 16,
            16,
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
          "circle-opacity": 0.18,
          "circle-blur": 1.0,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: "route-line-glow",
        type: "line",
        source: "route",
        paint: {
          "line-color": routePaint.color,
          "line-width": routePaint.width + 6,
          "line-opacity": routePaint.glowOpacity,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: routeType === "direct" ? "visible" : "none",
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": routePaint.color,
          "line-width": routePaint.width + 2,
          "line-opacity": routePaint.opacity,
          "line-dasharray": routePaint.dasharray,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: routeType === "direct" ? "visible" : "none",
        },
      });

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      heritageMarkersRef.current.forEach((marker) => marker.remove());
      featureMarkersRef.current.forEach((marker) => marker.remove());

      heritageMarkersRef.current = [];
      featureMarkersRef.current = [];

      setMapReady(false);
      setCurrentRoute(null);
      map.remove();
      mapRef.current = null;
    };
  }, [
    routePaint.color,
    routePaint.width,
    routePaint.opacity,
    routePaint.glowOpacity,
    routePaint.dasharray,
    routeType,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!map.getLayer("route-line") || !map.getLayer("route-line-glow")) return;

    map.setPaintProperty("route-line-glow", "line-color", routePaint.color);
    map.setPaintProperty("route-line-glow", "line-width", routePaint.width + 6);
    map.setPaintProperty(
      "route-line-glow",
      "line-opacity",
      routePaint.glowOpacity
    );

    map.setPaintProperty("route-line", "line-color", routePaint.color);
    map.setPaintProperty("route-line", "line-width", routePaint.width);
    map.setPaintProperty("route-line", "line-opacity", routePaint.opacity);
    map.setPaintProperty("route-line", "line-dasharray", routePaint.dasharray);

    const visibility = routeType === "direct" ? "visible" : "none";
    map.setLayoutProperty("route-line", "visibility", visibility);
    map.setLayoutProperty("route-line-glow", "visibility", visibility);
  }, [routePaint, routeType, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
  
    const source = map.getSource("cue-points");
    if (!source) return;
  
    const visibleCueGroups = cueGroups
      .filter((group) => visibleLayers[group.key])
      .map((group) => ({
        ...group,
        items: group.items,
      }));
  
    source.setData(
      buildCueCorridorGeoJSON(visibleCueGroups, currentRoute, routeType)
    );
  }, [cueGroups, visibleLayers, currentRoute, routeType, mapReady]);


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
    const map = mapRef.current;
    if (!map || !mapReady) return;

    featureMarkersRef.current.forEach((marker) => marker.remove());
    featureMarkersRef.current = [];

    cueGroups.forEach(({ items, type, key }) => {
      if (!visibleLayers[key]) return;

      items.forEach((item) => {
        const el = createFeatureMarker(
          type,
          item.prominence || 1,
          item.size || "support"
        );

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([item.lng, item.lat])
          .addTo(map);

        featureMarkersRef.current.push(marker);
      });
    });
  }, [cueGroups, mapReady, visibleLayers]);

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
    setActivePopupSite(null);
  }, [startSite, endSite, routeType]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !startSite || !endSite) return;

    const controller = new AbortController();

    async function loadRoute() {
      try {
        let coordinatesForDirections = `${startSite.lng},${startSite.lat};${endSite.lng},${endSite.lat}`;

        if (routeType === "adventure" && visibleHeritageSites.length > 2) {
          const viaSites = visibleHeritageSites
            .filter(
              (site) => site.name !== startSite.name && site.name !== endSite.name
            )
            .slice(0, 1);

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
        visibleHeritageSites.forEach((site) =>
          bounds.extend([site.lng, site.lat])
        );

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
  ]);

  const popupSite = activePopupSite || selectedHeritage;

  return (
    <div className="map-view">
      <div className="map-meta">
        <span>Source: {sourceLabel}</span>
      </div>

      <div className="map-overlay top-right">
        <div className="map-badge">
          <strong>
            {routeType === "adventure" ? "Adventure Route" : "Direct Route"}
          </strong>
          <span>{travelMode === "cycle" ? "Cycle" : "Walk"}</span>
        </div>
      </div>

      <div className="map-overlay bottom-left">
        <div className="map-legend">
          <div className="legend-title">Spatial cues</div>

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
              <span>Heritage anchors</span>
            </span>
          </button>

          {cueCategories
            .filter((category) => category.key !== "heritage")
            .map((category) => (
              <button
                key={category.key}
                type="button"
                className={`legend-toggle ${
                  visibleLayers[category.key] ? "active" : ""
                }`}
                onClick={() =>
                  setVisibleLayers((prev) => ({
                    ...prev,
                    [category.key]: !prev[category.key],
                  }))
                }
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
      </div>

      <div className="map-overlay bottom-right">
        <div className="map-story-card">
          <h4>{narrativeCopy.title}</h4>
          <p>{narrativeCopy.description}</p>

          <div className="story-stats">
            <span>{stats?.distance || "—"}</span>
            <span>{visibleHeritageSites.length} stops</span>
            <span>{cueCount} cues</span>
            <span>{stats?.durationText || `${timeMinutes} min`}</span>
          </div>
        </div>
      </div>

      {popupSite ? (
        <div className="heritage-popup">
          <button
            type="button"
            className="popup-close"
            onClick={() => setActivePopupSite(null)}
            aria-label="Close story popup"
          >
            ×
          </button>

          <div className="popup-num">
            {Math.max(
              1,
              visibleHeritageSites.findIndex(
                (site) => site.id === popupSite.id || site.name === popupSite.name
              ) + 1
            )}
          </div>

          <div className="popup-img">Story stop</div>
          <div className="popup-meta">Heritage anchor</div>
          <div className="popup-name">{popupSite.name}</div>
          <div className="popup-desc">
            {popupSite.description ||
              "This stop adds cultural context to the route and helps frame the journey as a spatial story rather than a simple connection."}
          </div>

          <button
            type="button"
            className="popup-link"
            onClick={() => onSelectHeritage?.(popupSite)}
          >
            Focus this stop
          </button>
        </div>
      ) : null}

      <div ref={mapContainerRef} className="mapbox-map" />
    </div>
  );
}