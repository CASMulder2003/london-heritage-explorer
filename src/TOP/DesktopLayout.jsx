import { useState } from "react";
import MapView from "../MAP/MapView";
import Sidebar from "../panel/Sidebar";
import SiteInfoPanel from "../panel/SiteInfoPanel";

export default function DesktopLayout({
  startSite, endSite, travelMode, setTravelMode, routeType, setRouteType,
  timeMinutes, handleTimeChange, timeStep, routeStops, anchorItems,
  selectedSite, setSelectedSite, stats, start, setStart, end, setEnd,
  swapLocations, onRouteGeometry,
}) {
  const [activeTab, setActiveTab] = useState("Sites");
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className="app-shell">
      {/* Toggle button — always visible, completely standalone */}
      <button
        type="button"
        className="panel-toggle"
        style={{ position: "absolute", top: "18px", left: "18px", zIndex: 60 }}
        onClick={() => setIsPanelOpen((p) => !p)}
      >
        {isPanelOpen ? "Close" : "Journey"}
      </button>

      {/* Sidebar — only rendered when open, no wrapper div blocking map */}
      {isPanelOpen && (
        <div style={{ position: "absolute", top: "18px", left: "18px", zIndex: 30, pointerEvents: "auto" }}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            start={start} setStart={setStart}
            end={end} setEnd={setEnd}
            swapLocations={swapLocations}
            travelMode={travelMode} setTravelMode={setTravelMode}
            routeType={routeType} setRouteType={setRouteType}
            timeMinutes={timeMinutes} handleTimeChange={handleTimeChange} timeStep={timeStep}
            routeStops={routeStops} anchorItems={anchorItems}
            selectedSite={selectedSite} setSelectedSite={setSelectedSite}
            stats={stats}
          />
        </div>
      )}

      {/* Map */}
      <div className="map-panel">
        <MapView
          startSite={startSite} endSite={endSite}
          routeStops={routeStops}
          travelMode={travelMode} routeType={routeType} timeMinutes={timeMinutes}
          onSelectSite={setSelectedSite} selectedSite={selectedSite}
          showRoute={true}
          onRouteGeometry={onRouteGeometry}
        >
          {/* Top right badge */}
          <div className="map-overlay top-right">
            <div className="map-badge">
              <strong>{routeType === "direct" ? "Direct" : "Exploratory"}</strong>
              <span>{travelMode === "cycle" ? "Cycle" : "Walk"}</span>
            </div>
          </div>

          {/* Site info panel — only shown when a site is selected */}
          {selectedSite && (
            <div style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              bottom: "80px",
              width: "300px",
              zIndex: 20,
              background: "rgba(255, 252, 247, 0.94)",
              backdropFilter: "blur(14px)",
              borderRadius: "24px",
              border: "1px solid rgba(60, 40, 20, 0.08)",
              boxShadow: "0 16px 36px rgba(40, 32, 20, 0.1)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}>
              <SiteInfoPanel
                site={selectedSite}
                onClose={() => setSelectedSite(null)}
              />
            </div>
          )}
        </MapView>
      </div>
    </div>
  );
}
