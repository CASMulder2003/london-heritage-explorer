import { useEffect, useMemo, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import MapView from "./components/MapView";
import HeritagePopup from "./components/HeritagePopup";
import { heritageSites } from "./data/heritageSites";
import { getRoute } from "./services/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("Journey");
  const [start, setStart] = useState("Camden Town, London");
  const [end, setEnd] = useState("UCL, Gower Street, WC1");
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("direct");
  const [timeMinutes, setTimeMinutes] = useState(120);

  const [selectedSite, setSelectedSite] = useState(null);
  const [showPopup, setShowPopup] = useState(true);

  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTimeChange = (delta) => {
    setTimeMinutes((prev) => Math.max(30, Math.min(300, prev + delta)));
  };

  const handleSelectSite = (site) => {
    setSelectedSite(site);
    setShowPopup(true);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadRoute() {
      try {
        setLoading(true);
        setError("");

        const data = await getRoute({
          startText: start,
          endText: end,
          travelMode,
          routeType,
          availableTime: timeMinutes,
        });

        console.log("routeData:", data);
        console.log("route source:", data?.meta?.source);
        console.log("route error:", data?.meta?.error);

        if (!cancelled) {
          setRouteData(data);
        }
      } catch (err) {
        console.error("App loadRoute error:", err);

        if (!cancelled) {
          setError("Could not load route.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [start, end, travelMode, routeType, timeMinutes]);

  useEffect(() => {
    if (!routeData?.stops?.length) {
      setSelectedSite(null);
      return;
    }

    const selectedStillExists = routeData.stops.some(
      (site) => site.id === selectedSite?.id
    );

    if (!selectedStillExists) {
      setSelectedSite(routeData.stops[0]);
      setShowPopup(true);
    }
  }, [routeData, selectedSite]);

  const stats = useMemo(() => {
    const distanceMeters = routeData?.summary?.distance ?? 0;
    const durationSeconds = routeData?.summary?.duration ?? 0;

    return {
      stops: routeData?.stops?.length ?? 0,
      time: Math.round(durationSeconds / 60),
      distance: (distanceMeters / 1000).toFixed(1),
    };
  }, [routeData]);

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        start={start}
        setStart={setStart}
        end={end}
        setEnd={setEnd}
        travelMode={travelMode}
        setTravelMode={setTravelMode}
        routeType={routeType}
        setRouteType={setRouteType}
        timeMinutes={timeMinutes}
        handleTimeChange={handleTimeChange}
        stats={stats}
      />

      <main className="map-area">
        {loading && <div className="route-status">Calculating route...</div>}
        {error && <div className="route-status route-error">{error}</div>}

        {routeData?.meta?.source && (
          <div className="route-status">
            Source: {routeData.meta.source}
            {routeData?.meta?.error ? ` | Error: ${routeData.meta.error}` : ""}
          </div>
        )}

        <MapView
          routeType={routeType}
          heritageSites={heritageSites}
          routeData={routeData}
          routeStops={routeData?.stops || []}
          selectedSite={selectedSite}
          showPopup={showPopup}
          onSelectSite={handleSelectSite}
        />

        <HeritagePopup
          site={selectedSite}
          showPopup={showPopup}
          onClose={() => setShowPopup(false)}
        />
      </main>
    </div>
  );
}