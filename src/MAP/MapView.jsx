import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cueCategories, loadCues } from "../data/cues";
import SegmentLayer from "./SegmentLayer";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const LONDON_CENTER = [-0.131, 51.5205];

const CATEGORY_COLORS = {
  park:     "#2d8a4e",
  memorial: "#A5513A",
  church:   "#c9a84c",
  listed:   "#1a3a5c",
  default:  "#8E352E",
};

// ─── Geometry helpers ────────────────────────────────────────────────────────

function projectMeters(lng, lat) {
  return [lng * 111320 * Math.cos((lat * Math.PI) / 180), lat * 110540];
}

function unprojectMeters(x, y, refLat) {
  return [x / (111320 * Math.cos((refLat * Math.PI) / 180)), y / 110540];
}

function nearestOnSegment(point, start, end) {
  const [px, py] = projectMeters(point[0], point[1]);
  const [x1, y1] = projectMeters(start[0], start[1]);
  const [x2, y2] = projectMeters(end[0], end[1]);
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return { coordinates: start, t: 0, distance: Math.hypot(px - x1, py - y1) };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const nx = x1 + t * dx, ny = y1 + t * dy;
  return { coordinates: unprojectMeters(nx, ny, point[1]), t, distance: Math.hypot(px - nx, py - ny) };
}

function nearestOnPolyline(point, coords) {
  if (!coords || coords.length < 2) return { coordinates: point, progress: 0, distance: Infinity };
  let best = Infinity, bestPt = point, bestProg = 0, total = 0;
  const lens = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = projectMeters(coords[i][0], coords[i][1]);
    const [x2, y2] = projectMeters(coords[i + 1][0], coords[i + 1][1]);
    lens.push(Math.hypot(x2 - x1, y2 - y1));
    total += lens[i];
  }
  let traversed = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const r = nearestOnSegment(point, coords[i], coords[i + 1]);
    if (r.distance < best) {
      best = r.distance;
      bestPt = r.coordinates;
      bestProg = total === 0 ? 0 : (traversed + lens[i] * r.t) / total;
    }
    traversed += lens[i];
  }
  return { coordinates: bestPt, progress: bestProg, distance: best };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Cue filtering ───────────────────────────────────────────────────────────

const CUE_THRESHOLDS = { tree: 100, bench: 80, signal: 70, bus_stop: 90 };
const CUE_MIN_SPACING = { tree: 80, bench: 100, signal: 80, bus_stop: 120 };
const CUE_LIMITS = { tree: 80, bench: 30, signal: 25, bus_stop: 20 };

function filterCuesToRoute(allCues, routeCoords, segmentStart, segmentEnd) {
  if (!routeCoords || routeCoords.length < 2 || !allCues.length) return [];

  let progressMin = 0, progressMax = 1;
  if (segmentStart && segmentEnd) {
    const s = nearestOnPolyline([segmentStart.lng, segmentStart.lat], routeCoords);
    const e = nearestOnPolyline([segmentEnd.lng, segmentEnd.lat], routeCoords);
    progressMin = Math.max(0, Math.min(s.progress, e.progress) - 0.02);
    progressMax = Math.min(1, Math.max(s.progress, e.progress) + 0.02);
  }

  const byCat = {};
  cueCategories.forEach((c) => { byCat[c.key] = []; });

  allCues.forEach((cue) => {
    const nearest = nearestOnPolyline([cue.lng, cue.lat], routeCoords);
    if (nearest.distance > (CUE_THRESHOLDS[cue.type] || 100)) return;
    if (nearest.progress < progressMin || nearest.progress > progressMax) return;
    if (!byCat[cue.type]) byCat[cue.type] = [];
    byCat[cue.type].push({ ...cue, progress: nearest.progress });
  });

  const result = [];
  Object.entries(byCat).forEach(([type, items]) => {
    const sorted = items.sort((a, b) => a.progress - b.progress);
    const spaced = [];
    sorted.forEach((cue) => {
      const tooClose = spaced.some((e) => haversineMeters(cue.lat, cue.lng, e.lat, e.lng) < (CUE_MIN_SPACING[type] || 50));
      if (!tooClose) spaced.push(cue);
    });
    result.push(...spaced.slice(0, CUE_LIMITS[type] || 50));
  });

  return result;
}

function buildCueGeoJSON(cues) {
  return {
    type: "FeatureCollection",
    features: cues.map((c) => ({
      type: "Feature",
      properties: { id: c.id, type: c.type, label: c.label },
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    })),
  };
}

// ─── Heritage GeoJSON for symbol layer ───────────────────────────────────────
// Using a symbol layer means markers move perfectly with the map — no drift.

function buildHeritageGeoJSON(routeStops, selectedSiteId) {
  return {
    type: "FeatureCollection",
    features: routeStops.map((site, index) => {
      const isStart = index === 0;
      const isEnd = index === routeStops.length - 1;
      const label = isStart ? "S" : isEnd ? "E" : String(index);
      const color = CATEGORY_COLORS[site.category] || CATEGORY_COLORS.default;
      return {
        type: "Feature",
        properties: {
          id: site.id || site.name,
          name: site.name,
          label,
          color,
          isSelected: (site.id || site.name) === selectedSiteId,
          isEndpoint: isStart || isEnd,
          index,
        },
        geometry: { type: "Point", coordinates: [site.lng, site.lat] },
      };
    }),
  };
}

// ─── MapView ─────────────────────────────────────────────────────────────────

export default function MapView({
  startSite, endSite, routeStops = [], travelMode = "walk",
  routeType = "exploratory", timeMinutes = 90,
  onSelectSite, selectedSite,
  showRoute = false, userCoords = null, deviceHeading = null,
  journeyStage = null, currentAnchorIndex = 0,
  onRouteGeometry,
  children,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeStopsRef = useRef(routeStops);
  const onSelectSiteRef = useRef(onSelectSite);
  const [mapReady, setMapReady] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [allCues, setAllCues] = useState([]);
  const [visibleLayers, setVisibleLayers] = useState({ tree: true, bench: true, signal: true, bus_stop: true });
  const [legendOpen, setLegendOpen] = useState(false);

  // Keep refs in sync so click handlers always see latest values
  useEffect(() => { routeStopsRef.current = routeStops; }, [routeStops]);
  useEffect(() => { onSelectSiteRef.current = onSelectSite; }, [onSelectSite]);

  const profile = travelMode === "cycle" ? "cycling" : "walking";

  useEffect(() => {
    loadCues().then(setAllCues).catch((e) => console.warn("Cues failed:", e));
  }, []);

  const currentSegment = useMemo(() => {
    if (journeyStage !== "navigating" || !routeStops.length) return null;
    // Cues should show between the PREVIOUS stop and the CURRENT target
    // e.g. when navigating to stop 1 (index 1): show cues between index 0 and index 1
    const prevIndex = Math.max(0, currentAnchorIndex - 1);
    return {
      start: routeStops[prevIndex] || null,
      end: routeStops[currentAnchorIndex] || null,
    };
  }, [journeyStage, currentAnchorIndex, routeStops]);

  const filteredCues = useMemo(() => {
    const coords = currentRoute?.geometry?.coordinates || [];
    if (!coords.length || !allCues.length) return [];
    const visible = allCues.filter((c) => visibleLayers[c.type] !== false);
    return filterCuesToRoute(visible, coords, currentSegment?.start, currentSegment?.end);
  }, [allCues, currentRoute, visibleLayers, currentSegment]);

  // ── Map init ───────────────────────────────────────────────────────────────
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

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // Mute roads
      map.getStyle().layers.forEach((l) => {
        if (l.type === "line" && (l.id.includes("road") || l.id.includes("street") || l.id.includes("tunnel") || l.id.includes("bridge"))) {
          try { map.setPaintProperty(l.id, "line-opacity", 0.06); } catch {}
        }
      });

      // Route source — never shown visually, just used for cue filtering
      map.addSource("route", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });

      // Cue source and layers
      map.addSource("cue-points", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "cue-halo", type: "circle", source: "cue-points", paint: {
        "circle-radius": 7,
        "circle-color": ["match", ["get", "type"], "tree", "#2d8a4e", "bench", "#8f7157", "signal", "#4d4058", "bus_stop", "#1a3a5c", "#888"],
        "circle-opacity": 0.15, "circle-blur": 0.3,
      }});
      map.addLayer({ id: "cue-core", type: "circle", source: "cue-points", paint: {
        "circle-radius": 4,
        "circle-color": ["match", ["get", "type"], "tree", "#2d8a4e", "bench", "#8f7157", "signal", "#4d4058", "bus_stop", "#1a3a5c", "#888"],
        "circle-opacity": 0.85, "circle-stroke-color": "white", "circle-stroke-width": 1,
      }});

      // Heritage sites — symbol layer (no drift)
      map.addSource("heritage-sites", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Circle background
      map.addLayer({ id: "heritage-circle", type: "circle", source: "heritage-sites", paint: {
        "circle-radius": ["case", ["get", "isSelected"], 20, ["get", "isEndpoint"], 18, 14],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "white",
        "circle-stroke-width": ["case", ["get", "isSelected"], 3, 2],
        "circle-opacity": 1,
        "circle-pitch-alignment": "map",
      }});

      // Number label — rendered in WebGL, moves perfectly with map
      map.addLayer({ id: "heritage-label", type: "symbol", source: "heritage-sites", layout: {
        "text-field": ["get", "label"],
        "text-size": ["case", ["get", "isEndpoint"], 13, 11],
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "symbol-placement": "point",
      }, paint: {
        "text-color": "white",
        "text-halo-color": "rgba(0,0,0,0.1)",
        "text-halo-width": 1,
      }});

      // Click handler — uses refs to avoid stale closure
      map.on("click", "heritage-circle", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties;
        // Don't show info for start/end markers
        if (props.label === "S" || props.label === "E") return;
        const site = routeStopsRef.current.find(
          (s) => String(s.id || s.name) === String(props.id)
        );
        if (site) onSelectSiteRef.current?.(site);
      });
      map.on("mouseenter", "heritage-circle", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "heritage-circle", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "cue-core", () => {});
      map.on("mouseenter", "cue-core", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "cue-core", () => { map.getCanvas().style.cursor = ""; });

      // User location — WebGL symbol layer, no DOM element, no glitching
      map.addSource("user-location", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      // Outer pulse ring
      map.addLayer({ id: "user-halo", type: "circle", source: "user-location", paint: {
        "circle-radius": 28,
        "circle-color": "rgba(255,255,255,0.12)",
        "circle-pitch-alignment": "viewport",
      }});
      // Dark circle background — matches old chevron style
      map.addLayer({ id: "user-dot", type: "circle", source: "user-location", paint: {
        "circle-radius": 18,
        "circle-color": "#2a1f14",
        "circle-stroke-color": "white",
        "circle-stroke-width": 2.5,
        "circle-pitch-alignment": "viewport",
      }});
      // Arrow — viewport alignment means it always points up on screen
      // since the map bearing already tracks the user's heading
      map.addLayer({ id: "user-arrow", type: "symbol", source: "user-location", layout: {
        "text-field": "▲",
        "text-size": 13,
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-anchor": "center",
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-rotation-alignment": "viewport",
        "symbol-placement": "point",
      }, paint: {
        "text-color": "#ffffff",
      }});

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      setMapReady(false);
      setCurrentRoute(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Update user location WebGL layer ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("user-location");
    if (!src) return;
    if (!userCoords) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    src.setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [userCoords.lng, userCoords.lat] } }],
    });
  }, [userCoords, mapReady]);

  // ── Lock/unlock map interaction during navigation ──────────────────────────
  // Camera is fully locked during navigation — no panning or zooming allowed
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const isNav = journeyStage === "navigating" || journeyStage === "arrived";
    if (isNav) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
    } else {
      map.dragPan.enable();
      map.scrollZoom.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
      map.keyboard.enable();
    }
  }, [journeyStage, mapReady]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("heritage-sites");
    if (src) src.setData(buildHeritageGeoJSON(routeStops, selectedSite?.id || selectedSite?.name));
  }, [routeStops, selectedSite, mapReady]);

  // ── Update cues ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("cue-points");
    if (src) src.setData(buildCueGeoJSON(filteredCues));
  }, [filteredCues, mapReady]);

  // ── Fly to selected site ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedSite) return;
    map.flyTo({ center: [selectedSite.lng, selectedSite.lat], zoom: 16, duration: 900 });
  }, [selectedSite, mapReady]);

  // ── Navigation zoom ────────────────────────────────────────────────────────
  const hasBegunNavigatingRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (journeyStage === "navigating") {
      const current = routeStops[currentAnchorIndex];
      const prev = routeStops[currentAnchorIndex - 1];

      if (!hasBegunNavigatingRef.current) {
        // Very first time entering navigation
        hasBegunNavigatingRef.current = true;
        if (userCoords) {
          map.flyTo({ center: [userCoords.lng, userCoords.lat], zoom: 16, duration: 400, pitch: 20 });
        } else if (prev && current) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([prev.lng, prev.lat]);
          bounds.extend([current.lng, current.lat]);
          map.fitBounds(bounds, { padding: { top: 120, right: 60, bottom: 180, left: 60 }, maxZoom: 15, duration: 600 });
        }
      } else {
        // Continuing from an arrival — show prev stop → current target
        if (prev && current) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([prev.lng, prev.lat]);
          bounds.extend([current.lng, current.lat]);
          map.fitBounds(bounds, { padding: { top: 120, right: 60, bottom: 180, left: 60 }, maxZoom: 15, duration: 600 });
        } else if (current) {
          map.flyTo({ center: [current.lng, current.lat], zoom: 15, duration: 600 });
        }
      }
    }

    // Reset when journey restarts
    if (journeyStage === "setup") {
      hasBegunNavigatingRef.current = false;
    }
  }, [currentAnchorIndex, journeyStage, mapReady, routeStops, userCoords]);

  // ── Follow user continuously during live navigation ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !userCoords || journeyStage !== "navigating") return;
    map.easeTo({
      center: [userCoords.lng, userCoords.lat],
      zoom: 17,
      bearing: deviceHeading != null ? deviceHeading : map.getBearing(),
      pitch: 30,
      duration: 500,
      easing: (t) => t,
    });
  }, [userCoords, deviceHeading, mapReady]);

  // ── Zoom into arrived site ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || journeyStage !== "arrived") return;
    const site = routeStops[currentAnchorIndex];
    if (!site) return;
    map.flyTo({
      center: [site.lng, site.lat],
      zoom: 17.5,
      duration: 1200,
      pitch: 40,
      essential: true,
    });
  }, [journeyStage, currentAnchorIndex, mapReady, routeStops]);
  // ── Pass 1: S→E route for initial stop selection ──────────────────────────
  // Fetches the simple start→end route and passes geometry to App.jsx
  // so it can calculate which heritage stops lie along the corridor.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !startSite || !endSite) return;
    const controller = new AbortController();

    async function loadSimpleRoute() {
      try {
        const coords = `${startSite.lng},${startSite.lat};${endSite.lng},${endSite.lat}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Directions failed");
        const data = await res.json();
        if (!data.routes?.length) throw new Error("No route");

        const geometry = data.routes[0].geometry;
        // Set as initial route immediately for cue filtering
        const geoJSON = { type: "Feature", properties: {}, geometry };
        const src = map.getSource("route");
        if (src) src.setData(geoJSON);
        setCurrentRoute(geoJSON);

        // Tell App.jsx the route geometry so it can select stops
        onRouteGeometry?.(geometry.coordinates);

        // Fit map to route
        const bounds = new mapboxgl.LngLatBounds();
        geometry.coordinates.forEach((c) => bounds.extend(c));
        const leftPad = showRoute ? 340 : 60;
        map.fitBounds(bounds, { padding: { top: 80, right: 80, bottom: 80, left: leftPad }, maxZoom: 14, duration: 900 });
      } catch (err) {
        if (err.name === "AbortError") return;
        const fallback = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[startSite.lng, startSite.lat], [endSite.lng, endSite.lat]] } };
        const src = map.getSource("route");
        if (src) src.setData(fallback);
        setCurrentRoute(fallback);
        onRouteGeometry?.([[startSite.lng, startSite.lat], [endSite.lng, endSite.lat]]);
      }
    }

    loadSimpleRoute();
    return () => {
      controller.abort();
      setCurrentRoute(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSite, endSite, profile, mapReady]);

  // ── Pass 2: full multi-stop route for accurate cue filtering ───────────────
  // Runs after routeStops is populated by App.jsx (which happens after pass 1).
  // Fetches S→1→2→3→E so cues align with the actual walked path.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !startSite || !endSite) return;

    // Only run if we have intermediate stops
    const intermediates = routeStops.filter(
      (s) => s.name !== startSite.name && s.name !== endSite.name
    );
    if (intermediates.length === 0) return;

    const controller = new AbortController();

    async function loadFullRoute() {
      try {
        const waypoints = [startSite, ...intermediates.slice(0, 23), endSite];
        const coords = waypoints.map((s) => `${s.lng},${s.lat}`).join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Directions failed");
        const data = await res.json();
        if (!data.routes?.length) throw new Error("No route");

        const geometry = data.routes[0].geometry;
        const geoJSON = { type: "Feature", properties: {}, geometry };
        const src = map.getSource("route");
        if (src) src.setData(geoJSON);
        setCurrentRoute(geoJSON);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("Full route fetch failed, keeping simple route:", err.message);
        }
      }
    }

    loadFullRoute();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeStops, mapReady]);

  return (
    <div className="map-view">
      {showRoute && (
        <div className="map-overlay bottom-left">
          <div className="map-legend-shell">
            <button type="button" className="legend-button" onClick={() => setLegendOpen((p) => !p)} />
            {legendOpen && (
              <div className="map-legend">
                <div className="legend-title">Spatial cues</div>
                {cueCategories.map((cat) => (
                  <button key={cat.key} type="button" className={`legend-toggle ${visibleLayers[cat.key] !== false ? "active" : ""}`}
                    onClick={() => setVisibleLayers((p) => ({ ...p, [cat.key]: !p[cat.key] }))}>
                    <span className="legend-row">
                      <span className="legend-dot" style={{ backgroundColor: cat.color }} />
                      <span>{cat.label}</span>
                    </span>
                  </button>
                ))}
                <div style={{ marginTop: "10px", borderTop: "1px solid #e0d8cc", paddingTop: "8px" }}>
                  <div className="legend-title">Heritage sites</div>
                  {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== "default").map(([key, color]) => (
                    <div key={key} className="legend-row" style={{ padding: "2px 6px" }}>
                      <span className="legend-dot" style={{ backgroundColor: color }} />
                      <span style={{ fontSize: "12px", color: "#444", textTransform: "capitalize" }}>{key === "listed" ? "Grade I listed" : key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {children}
      <div ref={mapContainerRef} className="mapbox-map" />
    </div>
  );
}
