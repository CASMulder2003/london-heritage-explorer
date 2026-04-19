import MapView from "./MapView";
import { heritageSites } from "../data/heritageSites";

export default function MobileLayout({
  startSite,
  endSite,
  safeTravelMode,
  safeRouteType,
  timeMinutes,
  stats,
  selectedHeritage,
  setSelectedHeritage,
}) {
  return (
    <div className="mobile-shell">
      <div className="mobile-map">
        <MapView
          startSite={startSite}
          endSite={endSite}
          heritageSites={heritageSites}
          travelMode={safeTravelMode}
          routeType={safeRouteType}
          timeMinutes={timeMinutes}
          stats={stats}
          selectedHeritage={selectedHeritage}
          onSelectHeritage={setSelectedHeritage}
          sourceLabel={stats.sourceLabel}
        />
      </div>

      <div className="mobile-header">
        <div className="mobile-pill">
          Explore freely · {safeTravelMode}
        </div>
      </div>

      <div className="mobile-bottom">
        <div className="mobile-card">
          <div>{stats.distance}</div>
          <div>{stats.durationMinutes} min</div>
        </div>
      </div>
    </div>
  );
}