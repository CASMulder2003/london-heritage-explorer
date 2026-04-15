import { getDirectRoute } from "./routing";
import { getMockRoute } from "../data/mockRoute";

const TEST_LOCATIONS = {
  "camden town london": { lat: 51.5392, lng: -0.1426 },
  "university college london gower street london": { lat: 51.5246, lng: -0.1340 },
  "ucl gower street wc1": { lat: 51.5246, lng: -0.1340 },
  "ucl gower street london": { lat: 51.5246, lng: -0.1340 },
};

function normalizePlaceKey(text = "") {
  return text
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getRoute({
  startText,
  endText,
  travelMode,
  routeType,
  availableTime,
}) {
  if (routeType === "adventure") {
    return getMockRoute({
      startText,
      endText,
      travelMode,
      routeType,
      availableTime,
    });
  }

  try {
    const startKey = normalizePlaceKey(startText);
    const endKey = normalizePlaceKey(endText);

    const startCoords = TEST_LOCATIONS[startKey];
    const endCoords = TEST_LOCATIONS[endKey];

    if (!startCoords || !endCoords) {
      throw new Error(
        `Test coordinates not found for current inputs | start="${startText}" | end="${endText}"`
      );
    }

    const route = await getDirectRoute(startCoords, endCoords, travelMode);

    return {
      ...route,
      meta: {
        source: "real-api",
        startLabel: startText,
        endLabel: endText,
      },
    };
  } catch (error) {
    console.error("Real route failed, fallback to mock:", error);

    const mockRoute = getMockRoute({
      startText,
      endText,
      travelMode,
      routeType,
      availableTime,
    });

    return {
      ...mockRoute,
      meta: {
        ...mockRoute.meta,
        source: "mock-fallback",
        error: error.message,
      },
    };
  }
}