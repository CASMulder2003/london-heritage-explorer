export function getMockRoute({
  startText = "Camden",
  endText = "UCL",
  travelMode = "walking",
  routeType = "direct",
  availableTime = 30,
} = {}) {
  return {
    geometry: [
      { lat: 51.5445, lng: -0.1390 },
      { lat: 51.5408, lng: -0.1340 },
      { lat: 51.5363, lng: -0.1325 },
      { lat: 51.5246, lng: -0.1340 },
    ],
    stops: [
      {
        id: 1,
        name: "Mock Heritage Stop 1",
        lat: 51.5408,
        lng: -0.1340,
        description: "Temporary mock stop",
      },
      {
        id: 2,
        name: "Mock Heritage Stop 2",
        lat: 51.5363,
        lng: -0.1325,
        description: "Temporary mock stop",
      },
    ],
    summary: {
      distance: 3200,
      duration: travelMode === "walking" ? 2400 : 900,
    },
    meta: {
      source: "mock",
      startLabel: startText,
      endLabel: endText,
      routeType,
      availableTime,
    },
  };
}