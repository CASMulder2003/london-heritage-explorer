import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { heritageSites } from "./data/heritageSites";
import { cues as cueCatalog } from "./data/cues";
import DesktopLayout from "./TOP/DesktopLayout";
import MobileLayout from "./TOP/MobileLayout";

const DEFAULT_TAB = "Journey";
const DEFAULT_START = "St Pancras Old Church";
const DEFAULT_END = "Senate House";
const MIN_TIME = 30;
const MAX_TIME = 240;
const TIME_STEP = 30;

function normalizeRouteType(routeType) {
  const value = String(routeType || "").toLowerCase();
  return value === "direct" ? "direct" : "adventure";
}

function normalizeTravelMode(travelMode) {
  const value = String(travelMode || "").toLowerCase();
  return value === "cycle" ? "cycle" : "walk";
}

function findSiteByName(name) {
  return heritageSites.find((site) => site.name === name) || null;
}

function estimateDistanceKm(startSite, endSite, routeType, timeMinutes = 90) {
  if (!startSite || !endSite) {
    return routeType === "adventure" ? 5.4 : 2.6;
  }

  const latKm = (startSite.lat - endSite.lat) * 111;
  const lngKm = (startSite.lng - endSite.lng) * 69;
  const straightLineKm = Math.sqrt(latKm ** 2 + lngKm ** 2);

  if (routeType === "adventure") {
    let multiplier = 1.42;

    if (timeMinutes <= 60) multiplier = 1.35;
    else if (timeMinutes <= 90) multiplier = 1.46;
    else if (timeMinutes <= 120) multiplier = 1.58;
    else if (timeMinutes <= 150) multiplier = 1.7;
    else if (timeMinutes <= 180) multiplier = 1.82;
    else multiplier = 1.95;

    return Math.max(1.8, straightLineKm * multiplier);
  }

  return Math.max(1.2, straightLineKm * 1.12);
}

function estimateDurationMinutes(distanceKm, travelMode) {
  const speedKmh = travelMode === "cycle" ? 14 : 4.8;
  return Math.round((distanceKm / speedKmh) * 60);
}

function buildStats(startSite, endSite, travelMode, routeType, timeMinutes) {
  const distanceKm = estimateDistanceKm(
    startSite,
    endSite,
    routeType,
    timeMinutes
  );

  const estimatedDuration = estimateDurationMinutes(distanceKm, travelMode);

  const durationMinutes =
    routeType === "adventure"
      ? Math.max(
          estimatedDuration,
          Math.min(timeMinutes, estimatedDuration + 25)
        )
      : estimatedDuration;

  return {
    distance: `${distanceKm.toFixed(1)} km`,
    durationMinutes,
    sourceLabel: "Mapbox",
  };
}

function buildRouteStops(startSite, endSite, routeType, timeMinutes) {
  if (!startSite || !endSite) return [];

  const uniqueSites = (sites) =>
    sites.filter(
      (site, index, arr) => arr.findIndex((s) => s.id === site.id) === index
    );

  const routeLength = Math.hypot(
    endSite.lng - startSite.lng,
    endSite.lat - startSite.lat
  );

  const rankedSites = heritageSites
    .filter((site) => site.id !== startSite.id && site.id !== endSite.id)
    .map((site) => {
      const distToStart = Math.hypot(
        site.lng - startSite.lng,
        site.lat - startSite.lat
      );
      const distToEnd = Math.hypot(site.lng - endSite.lng, site.lat - endSite.lat);

      const routeBalance = Math.abs(distToStart - distToEnd);
      const distanceToLine = distToStart + distToEnd;
      const baseWeight = site.cueWeight || 0;
      const adventureBoost = site.adventure ? 2.5 : 0;
      const guidedPenalty = site.adventure ? 0.6 : 0;

      const directionBias =
        ((site.lat - startSite.lat) * (endSite.lat - startSite.lat) +
          (site.lng - startSite.lng) * (endSite.lng - startSite.lng)) *
        0.3;

      return {
        ...site,
        routeScore:
          routeType === "adventure"
            ? routeBalance +
              distanceToLine * 0.15 -
              baseWeight * 0.08 -
              adventureBoost -
              directionBias
            : routeBalance +
              distanceToLine * 0.18 +
              guidedPenalty -
              baseWeight * 0.01,
      };
    })
    .sort((a, b) => a.routeScore - b.routeScore);

  if (routeType === "direct") {
    const guidedCount =
      timeMinutes <= 60 ? 1 : timeMinutes <= 120 ? 2 : timeMinutes <= 180 ? 3 : 4;

    return uniqueSites([startSite, ...rankedSites.slice(0, guidedCount), endSite]);
  }

  const exploratoryCount =
    timeMinutes <= 30
      ? 1
      : timeMinutes <= 60
      ? 2
      : timeMinutes <= 90
      ? 3
      : timeMinutes <= 120
      ? 4
      : timeMinutes <= 150
      ? 5
      : timeMinutes <= 180
      ? 6
      : 7;

  const exploratoryCandidates = rankedSites.filter(
    (site) => site.adventure || site.cueWeight >= 2 || routeLength > 0.02
  );

  return uniqueSites([
    startSite,
    ...exploratoryCandidates.slice(0, exploratoryCount),
    endSite,
  ]);
}

function buildSegmentsFromStops(stops, routeType) {
  if (!stops.length) return [];

  if (stops.length === 1) {
    return [
      {
        id: `${stops[0].id}-only`,
        type: "arrival",
        title: stops[0].name,
        heritage: stops[0],
        order: 0,
      },
    ];
  }

  return stops.map((stop, index) => {
    let type = "transition";

    if (index === 0) type = "start";
    else if (index === stops.length - 1) type = "arrival";
    else if (routeType === "adventure" && index === Math.floor(stops.length / 2)) {
      type = "intensity";
    } else if (index <= 1) {
      type = "orientation";
    }

    return {
      id: `${stop.id}-${index}`,
      type,
      title: stop.name,
      heritage: stop,
      order: index,
    };
  });
}

function buildCueGroups(segments, routeType, timeMinutes) {
  return segments.map((segment) => {
    const isAdventure = routeType === "adventure";

    const baseCueCount = isAdventure ? 4 : 2;
    const timeBoost = timeMinutes >= 120 ? 2 : timeMinutes >= 90 ? 1 : 0;
    const cueCount = baseCueCount + timeBoost;

    const source =
      Array.isArray(cueCatalog) && cueCatalog.length
        ? cueCatalog
        : [
            { type: "tree", label: "Tree cover" },
            { type: "bench", label: "Rest points" },
            { type: "signal", label: "Crossings" },
            { type: "lamp", label: "Street lighting" },
            { type: "bus", label: "Transit rhythm" },
          ];

    const selected = source.slice(0, cueCount).map((cue, cueIndex) => {
      let intensity = "medium";

      if (segment.type === "start") intensity = cueIndex === 0 ? "low" : "medium";
      if (segment.type === "orientation") intensity = "medium";
      if (segment.type === "intensity") intensity = cueIndex < 2 ? "high" : "medium";
      if (segment.type === "arrival") intensity = cueIndex === 0 ? "high" : "low";

      return {
        ...cue,
        intensity,
      };
    });

    return {
      segmentId: segment.id,
      count: selected.length,
      items: selected,
    };
  });
}

function buildNarrativeText(
  segment,
  cues,
  routeType,
  startSite,
  endSite,
  timeMinutes
) {
  const cueLabels = (cues.items || [])
    .map((item) => item.label || item.type)
    .slice(0, 3);

  const cueSummary =
    cueLabels.length > 0 ? cueLabels.join(", ").toLowerCase() : "everyday cues";

  const fromName = startSite?.name || "the starting point";
  const toName = endSite?.name || "the destination";

  const longJourney = timeMinutes >= 120;
  const exploratory = routeType === "adventure";

  const routeContext = exploratory
    ? longJourney
      ? `This longer exploratory route creates more room for drift between ${fromName} and ${toName}, allowing the journey to gather meaning gradually through the street environment.`
      : `This exploratory route between ${fromName} and ${toName} loosens the most direct path and lets small cues shape how the city is read.`
    : `This guided route between ${fromName} and ${toName} keeps the destination legible while still using nearby landmarks and cues to situate the journey in place.`;

  switch (segment.type) {
    case "start":
      return exploratory
        ? `${routeContext} The journey begins at ${segment.title}, where attention is first anchored before the route begins to open outward through ${cueSummary}.`
        : `${routeContext} Starting at ${segment.title}, the route establishes a clear point of departure and uses ${cueSummary} to support orientation without over-directing movement.`;

    case "orientation":
      return exploratory
        ? `Here the route starts to loosen. Rather than prescribing each turn, it invites movement through ${cueSummary}, encouraging the user to notice transitions in pace, frontage, and atmosphere.`
        : `This segment keeps movement readable and stable. Cues such as ${cueSummary} help maintain direction while still making the surrounding street feel present.`;

    case "intensity":
      return exploratory
        ? `Here the route becomes denser and more urban. The accumulation of ${cueSummary} shifts the journey from quiet orientation into a more public and layered landscape, making movement itself part of the story.`
        : `This is the most active portion of the route, where ${cueSummary} gather more closely and reinforce the sense of arrival into a busier urban corridor.`;

    case "arrival":
      return exploratory
        ? `The route resolves at ${segment.title}, where earlier cues and landmarks gather into a final stop. Rather than ending as pure efficiency, the journey arrives with a stronger sense of spatial transition and urban context.`
        : `The route concludes at ${segment.title}. The destination remains clear throughout, but the journey still arrives with a richer awareness of how nearby streets, landmarks, and cues shape the approach.`;

    default:
      return exploratory
        ? `This segment expands beyond the most direct path. Cues such as ${cueSummary} turn routine movement into a more exploratory encounter with the city.`
        : `This segment keeps the route legible and focused, using ${cueSummary} to support orientation without overwhelming the journey.`;
  }
}

function buildNarrativeSteps(
  segments,
  cueGroups,
  routeType,
  timeMinutes,
  startSite,
  endSite
) {
  return segments.map((segment, index) => {
    const cues = cueGroups[index] || { items: [], count: 0 };

    return {
      id: segment.id,
      order: index + 1,
      type: segment.type,
      title: segment.title,
      heritage: segment.heritage,
      cueCount: cues.count,
      cues: cues.items,
      durationLabel: `${Math.max(
        10,
        Math.round(timeMinutes / Math.max(segments.length, 1))
      )} min`,
      text: buildNarrativeText(
        segment,
        cues,
        routeType,
        startSite,
        endSite,
        timeMinutes
      ),
    };
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [travelMode, setTravelMode] = useState("walk");
  const [routeType, setRouteType] = useState("adventure");
  const [timeMinutes, setTimeMinutes] = useState(90);
  const [selectedHeritage, setSelectedHeritage] = useState(null);
  const [selectedNarrativeStep, setSelectedNarrativeStep] = useState(null);
  const [selectedCue, setSelectedCue] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [storyOpen, setStoryOpen] = useState(false);

  const safeRouteType = useMemo(
    () => normalizeRouteType(routeType),
    [routeType]
  );

  const safeTravelMode = useMemo(
    () => normalizeTravelMode(travelMode),
    [travelMode]
  );

  const locations = useMemo(() => heritageSites.map((site) => site.name), []);

  const startSite = useMemo(() => findSiteByName(start), [start]);
  const endSite = useMemo(() => findSiteByName(end), [end]);

  const stats = useMemo(() => {
    return buildStats(
      startSite,
      endSite,
      safeTravelMode,
      safeRouteType,
      timeMinutes
    );
  }, [startSite, endSite, safeTravelMode, safeRouteType, timeMinutes]);

  const routeStops = useMemo(() => {
    return buildRouteStops(startSite, endSite, safeRouteType, timeMinutes);
  }, [startSite, endSite, safeRouteType, timeMinutes]);

  const segments = useMemo(() => {
    return buildSegmentsFromStops(routeStops, safeRouteType);
  }, [routeStops, safeRouteType]);

  const cueGroups = useMemo(() => {
    return buildCueGroups(segments, safeRouteType, timeMinutes);
  }, [segments, safeRouteType, timeMinutes]);

  const narrativeSteps = useMemo(() => {
    return buildNarrativeSteps(
      segments,
      cueGroups,
      safeRouteType,
      timeMinutes,
      startSite,
      endSite
    );
  }, [
    segments,
    cueGroups,
    safeRouteType,
    timeMinutes,
    startSite,
    endSite,
  ]);

  const sidebarCueAnchors = useMemo(() => {
    return getSidebarCueAnchors(cueCatalog, safeRouteType);
  }, [safeRouteType]);

  function getCueDisplayName(cue) {
    const key = getCueKey(cue);
  
    switch (key) {
      case "heritage":
        return "null";
      case "transit":
      case "bus":
        return "Transit cue";
      case "crossing":
      case "signal":
        return "Crossing cue";
      case "threshold":
        return "Threshold cue";
      case "shade":
      case "tree":
        return "Shaded edge";
      case "rest":
      case "bench":
        return "Rest point";
      case "lighting":
      case "lamp":
        return "Lighting cue";
      case "water":
        return "Water cue";
      case "rhythm":
        return "Rhythm cue";
      default:
        return cue?.label || cue?.type || "Spatial cue";
    }
  }
  
  function getCuePhaseLabel(stepType) {
    switch (stepType) {
      case "start":
        return "Starting cue";
      case "orientation":
        return "Orientation cue";
      case "intensity":
        return "Intensity cue";
      case "transition":
        return "Transition cue";
      case "arrival":
        return "Arrival cue";
      default:
        return "Spatial cue";
    }
  }


  
  function getCueKey(cue) {
    return String(cue?.type || cue?.label || "")
      .trim()
      .toLowerCase();
  }
  
  function getSidebarCueForStep(step) {
    const cueItems = Array.isArray(step?.cues) ? step.cues : [];
  
    const nonHeritageCues = cueItems.filter((cue) => {
      const key = getCueKey(cue);
      return key && key !== "heritage";
    });
  
    if (!nonHeritageCues.length) return null;
  
    const preferredByStep = {
      start: ["threshold", "shade", "tree", "transit", "bus"],
      orientation: ["crossing", "signal", "transit", "bus", "threshold"],
      intensity: ["lighting", "lamp", "transit", "bus", "crossing", "signal"],
      transition: ["rest", "bench", "shade", "tree", "threshold"],
      arrival: ["rest", "bench", "lighting", "lamp", "threshold"],
    };
  
    const preferredKeys = preferredByStep[step?.type] || [];
  
    for (const pref of preferredKeys) {
      const matched = nonHeritageCues.find((cue) => getCueKey(cue) === pref);
      if (matched) return matched;
    }
  
    return nonHeritageCues[0];
  }

  function getSidebarCueAnchors(cueCatalog = [], routeType = "adventure") {
    const usable = (cueCatalog || []).filter((cue) => {
      const key = String(cue?.type || cue?.label || "").toLowerCase();
      return key && key !== "heritage";
    });
  
    if (!usable.length) return [];
  
    const preferred =
      routeType === "adventure"
        ? [
            "transit",
            "bus",
            "crossing",
            "signal",
            "threshold",
            "shade",
            "tree",
            "rest",
            "bench",
            "lighting",
            "lamp",
          ]
        : ["transit", "crossing", "threshold", "shade", "rest"];
  
    const picked = [];
    const used = new Set();
  
    preferred.forEach((type) => {
      const match = usable.find((cue) => {
        const key = String(cue?.type || cue?.label || "").toLowerCase();
        const id = cue.id || `${cue.type}-${cue.label}`;
        return key === type && !used.has(id);
      });
  
      if (match) {
        picked.push(match);
        used.add(match.id || `${match.type}-${match.label}`);
      }
    });
  
    return picked.slice(0, 3);
  }

  const anchorItems = useMemo(() => {
    const items = [];
  
    routeStops.forEach((site, index) => {
      items.push({
        kind: "heritage",
        id: `heritage-${site.id}`,
        order: items.length + 1,
        heritageId: site.id,
        name: site.name,
        period: site.period || site.category || "Heritage stop",
        description:
          site.shortDescription ||
          site.description ||
          "A key heritage anchor on this route.",
        raw: site,
      });
  
      const cue = sidebarCueAnchors[index % Math.max(sidebarCueAnchors.length, 1)];
      const cueName = cue ? getCueDisplayName(cue) : null;
      
      if (cue && cueName) {
        items.push({
          kind: "cue",
          id: `cue-${cue.id || cue.type || cue.label}-${index}`,
          order: items.length + 1,
          cueType: cue.type || "cue",
          name: cueName,
          period:
            index === 0
              ? "Starting cue"
              : index === routeStops.length - 1
              ? "Arrival cue"
              : "Spatial cue",
          description: `This cue helps structure attention and movement along this route.`,
          raw: {
            ...cue,
            name: cueName,
            label: cueName,
          },
        });
      }
    });
  
    return items;
  }, [routeStops, sidebarCueAnchors]);

  function handleTimeChange(delta) {
    setTimeMinutes((prev) => {
      const next = prev + delta;
      return Math.min(MAX_TIME, Math.max(MIN_TIME, next));
    });
  }

  function handleStartChange(nextStart) {
    if (!nextStart || nextStart === end) return;
    setStart(nextStart);
  }

  function handleEndChange(nextEnd) {
    if (!nextEnd || nextEnd === start) return;
    setEnd(nextEnd);
  }

  function swapLocations() {
    setStart(end);
    setEnd(start);
  }

  useEffect(() => {
    if (!["Journey", "Anchors"].includes(activeTab)) {
      setActiveTab("Journey");
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedHeritage) {
      setIsPanelOpen(false);
    }
  }, [selectedHeritage]);

  useEffect(() => {
    setIsPanelOpen(true);
  }, [activeTab]);

  useEffect(() => {
    setSelectedHeritage(null);
    setSelectedCue(null);
    setSelectedNarrativeStep(null);
    setStoryOpen(true);
  }, [start, end, safeRouteType, safeTravelMode, timeMinutes]);

  useEffect(() => {
    if (!selectedNarrativeStep && narrativeSteps.length > 0) {
      setSelectedNarrativeStep(narrativeSteps[0]);
    }
  }, [narrativeSteps, selectedNarrativeStep]);

  useEffect(() => {
    if (
      selectedNarrativeStep &&
      !narrativeSteps.some((step) => step.id === selectedNarrativeStep.id)
    ) {
      setSelectedNarrativeStep(narrativeSteps[0] || null);
    }
  }, [narrativeSteps, selectedNarrativeStep]);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  const sharedProps = {
    heritageSites,
    routeStops,
    anchorItems,
    segments,
    cueGroups,
    narrativeSteps,
    selectedNarrativeStep,
    setSelectedNarrativeStep,
    startSite,
    endSite,
    safeTravelMode,
    safeRouteType,
    timeMinutes,
    stats,
    selectedHeritage,
    setSelectedHeritage,
    selectedCue,
    setSelectedCue,
  };

  return isMobile ? (
    <MobileLayout
      {...sharedProps}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      start={start}
      setStart={handleStartChange}
      end={end}
      setEnd={handleEndChange}
      swapLocations={swapLocations}
      travelMode={safeTravelMode}
      setTravelMode={setTravelMode}
      routeType={safeRouteType}
      setRouteType={setRouteType}
      handleTimeChange={handleTimeChange}
      timeStep={TIME_STEP}
      locations={locations}
    />
  ) : (
<DesktopLayout
  {...sharedProps}
  isPanelOpen={isPanelOpen}
  setIsPanelOpen={setIsPanelOpen}
  storyOpen={storyOpen}
  setStoryOpen={setStoryOpen}
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  start={start}
  setStart={handleStartChange}
  end={end}
  setEnd={handleEndChange}
  swapLocations={swapLocations}
  travelMode={safeTravelMode}
  setTravelMode={setTravelMode}
  routeType={safeRouteType}
  setRouteType={setRouteType}
  timeMinutes={timeMinutes}
  handleTimeChange={handleTimeChange}
  timeStep={TIME_STEP}
  locations={locations}
/>
  );
}