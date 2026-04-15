import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  trees,
  busStops,
  signals,
  benches,
  lamps,
} from "../data/mapFeatures";

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

function createFeatureMarker(type) {
  const el = document.createElement("div");
  el.className = `map-feature-marker ${type}`;
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
      width: 4,
      opacity: 0.5,
      dasharray: [2, 2],
      glowOpacity: 0.08,
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
      title: "Cue-rich discovery route",
      description: `This ${modeLabel} route stretches across a wider corridor, using more environmental cues and heritage stops to encourage slower exploration.`,
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

function buildCueGroups(routeType, routeFeature) {
  const routeCoordinates = routeFeature?.geometry?.coordinates || [];

  const isAdventure = routeType === "adventure";

  const thresholds = {
    tree: isAdventure ? 160 : 110,
    bus: isAdventure ? 140 : 90,
    signal: isAdventure ? 120 : 80,
    bench: isAdventure ? 150 : 100,
    lamp: isAdventure ? 130 : 85,
  };

  const limits = {
    tree: isAdventure ? 14 : 8,
    bus: isAdventure ? 10 : 5,
    signal: isAdventure ? 10 : 5,
    bench: isAdventure ? 8 : 4,
    lamp: isAdventure ? 8 : 4,
  };

  const filterNearRoute = (items, threshold, limit) =>
    items
      .filter((item) =>
        isPointNearRoute([item.lng, item.lat], routeCoordinates, threshold)
      )
      .slice(0, limit);

  return [
    {
      key: "tree",
      label: "Shade cues",
      items: filterNearRoute(trees, thresholds.tree, limits.tree),
      type: "tree",
    },
    {
      key: "bus",
      label: "Transit cues",
      items: filterNearRoute(busStops, thresholds.bus, limits.bus),
      type: "bus",
    },
    {
      key: "signal",
      label: "Crossing cues",
      items: filterNearRoute(signals, thresholds.signal, limits.signal),
      type: "signal",
    },
    {
      key: "bench",
      label: "Rest points",
      items: filterNearRoute(benches, thresholds.bench, limits.bench),
      type: "bench",
    },
    {
      key: "lamp",
      label: "Street rhythm",
      items: filterNearRoute(lamps, thresholds.lamp, limits.lamp),
      type: "lamp",
    },
  ];
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
    bus: true,
    tree: true,
    bench: true,
    signal: true,
    lamp: false,
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
    if (!startSite || !endSite) return heritageSites;

    if (routeType === "direct") {
      const filtered = heritageSites.filter(
        (site) =>
          site.name === startSite.name ||
          site.name === endSite.name ||
          site.priority === "primary" ||
          site.featured === true
      );

      return filtered.length >= 2 ? filtered : heritageSites.slice(0, 4);
    }

    return heritageSites;
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
      style: "mapbox://styles/mapbox/streets-v12",
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
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": routePaint.color,
          "line-width": routePaint.width,
          "line-opacity": routePaint.opacity,
          "line-dasharray": routePaint.dasharray,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
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
  }, [routePaint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!map.getLayer("route-line") || !map.getLayer("route-line-glow")) return;

    map.setPaintProperty("route-line-glow", "line-color", routePaint.color);
    map.setPaintProperty(
      "route-line-glow",
      "line-width",
      routePaint.width + 6
    );
    map.setPaintProperty(
      "route-line-glow",
      "line-opacity",
      routePaint.glowOpacity
    );

    map.setPaintProperty("route-line", "line-color", routePaint.color);
    map.setPaintProperty("route-line", "line-width", routePaint.width);
    map.setPaintProperty("route-line", "line-opacity", routePaint.opacity);
    map.setPaintProperty("route-line", "line-dasharray", routePaint.dasharray);
  }, [routePaint, mapReady]);

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
        const el = createFeatureMarker(type);

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
            .slice(0, 3);

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
          maxZoom: 14,
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
          maxZoom: 14,
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

          <button
            type="button"
            className={`legend-toggle ${visibleLayers.bus ? "active" : ""}`}
            onClick={() =>
              setVisibleLayers((prev) => ({
                ...prev,
                bus: !prev.bus,
              }))
            }
          >
            <span className="legend-row">
              <span className="legend-dot bus" />
              <span>Transit cues</span>
            </span>
          </button>

          <button
            type="button"
            className={`legend-toggle ${visibleLayers.tree ? "active" : ""}`}
            onClick={() =>
              setVisibleLayers((prev) => ({
                ...prev,
                tree: !prev.tree,
              }))
            }
          >
            <span className="legend-row">
              <span className="legend-dot tree" />
              <span>Shade cues</span>
            </span>
          </button>

          <button
            type="button"
            className={`legend-toggle ${visibleLayers.bench ? "active" : ""}`}
            onClick={() =>
              setVisibleLayers((prev) => ({
                ...prev,
                bench: !prev.bench,
              }))
            }
          >
            <span className="legend-row">
              <span className="legend-dot bench" />
              <span>Rest points</span>
            </span>
          </button>

          <button
            type="button"
            className={`legend-toggle ${visibleLayers.signal ? "active" : ""}`}
            onClick={() =>
              setVisibleLayers((prev) => ({
                ...prev,
                signal: !prev.signal,
              }))
            }
          >
            <span className="legend-row">
              <span className="legend-dot signal" />
              <span>Crossing cues</span>
            </span>
          </button>

          <button
            type="button"
            className={`legend-toggle ${visibleLayers.lamp ? "active" : ""}`}
            onClick={() =>
              setVisibleLayers((prev) => ({
                ...prev,
                lamp: !prev.lamp,
              }))
            }
          >
            <span className="legend-row">
              <span className="legend-dot lamp" />
              <span>Street rhythm</span>
            </span>
          </button>
        </div>
      </div>

      <div className="map-overlay bottom-right">
        <div className="map-story-card">
          <h4>{narrativeCopy.title}</h4>
          <p>{narrativeCopy.description}</p>

          <div className="story-stats">
            <span>{stats?.distance || "—"}</span>
            <span>{stats?.heritageStops || visibleHeritageSites.length} stops</span>
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