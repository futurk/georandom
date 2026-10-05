export interface LatLng {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_KM = 6371;
export const KM_PER_LAT_DEGREE = 111;

// Convert degrees to radians
export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

// Calculate a new LatLng by offsetting a coordinate by dx and dy kilometers
export const offsetCoordinates = (
  lat: number,
  lng: number,
  dxKm: number,
  dyKm: number
): LatLng => {
  const dLat = dyKm / KM_PER_LAT_DEGREE;
  const dLng = dxKm / (KM_PER_LAT_DEGREE * Math.cos(degToRad(lat)));
  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
};

// Utility function to calculate a random point within a minimum and maximum radius (annulus ring area)
export const getRandomLocation = (
  lat: number,
  lng: number,
  minRadius: number,
  maxRadius: number
): LatLng => {
  const minR = Math.max(0, Math.min(minRadius, maxRadius));
  const maxR = Math.max(minR, Math.max(minRadius, maxRadius));

  const u = Math.random();
  const v = Math.random();

  // Uniform area sample between minR^2 and maxR^2 in km
  const rKm = Math.sqrt(u * (maxR * maxR - minR * minR) + minR * minR);
  const theta = 2 * Math.PI * v;

  // Offset in kilometers
  const dxKm = rKm * Math.cos(theta);
  const dyKm = rKm * Math.sin(theta);

  return offsetCoordinates(lat, lng, dxKm, dyKm);
};

// Calculate Haversine distance between two sets of coordinates in kilometers
export const getDistanceInKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

// Format distance nicely for human reading (m or km)
export const formatDistance = (distInKm: number): string => {
  if (distInKm < 1) {
    return `${Math.round(distInKm * 1000)} m`;
  }
  return `${distInKm.toFixed(2)} km`;
};

// Function to calculate total route distance along a sequence of points
export const getTotalRouteDistance = (path: LatLng[]): number => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += getDistanceInKm(path[i].lat, path[i].lng, path[i + 1].lat, path[i + 1].lng);
  }
  return total;
};

// Generate closed-loop waypoint positions around a central point
export const generateRoundTripPoints = (
  centerLat: number,
  centerLng: number,
  numWaypoints: number,
  targetDistance: number
): LatLng[] => {
  const baseAngle = Math.random() * 2 * Math.PI;
  const angleStep = (2 * Math.PI) / (numWaypoints + 1);

  const rawPoints: { x: number; y: number }[] = [];
  for (let i = 1; i <= numWaypoints; i++) {
    const angle = baseAngle + i * angleStep + (Math.random() - 0.5) * (angleStep * 0.4);
    const rWeight = 0.8 + Math.random() * 0.4;
    rawPoints.push({
      x: rWeight * Math.cos(angle),
      y: rWeight * Math.sin(angle),
    });
  }

  let currentDist = 0;
  const allRaw = [{ x: 0, y: 0 }, ...rawPoints, { x: 0, y: 0 }];
  for (let i = 0; i < allRaw.length - 1; i++) {
    currentDist += Math.hypot(allRaw[i + 1].x - allRaw[i].x, allRaw[i + 1].y - allRaw[i].y);
  }

  const scale = currentDist > 0 ? targetDistance / currentDist : 1;

  return rawPoints.map((pt) =>
    offsetCoordinates(centerLat, centerLng, pt.x * scale, pt.y * scale)
  );
};

// Generate open-ended directional polyline waypoint positions
export const generateOneWayPoints = (
  centerLat: number,
  centerLng: number,
  numWaypoints: number,
  targetDistance: number
): LatLng[] => {
  let currentAngle = Math.random() * 2 * Math.PI; // Random initial heading in 360°
  const rawOffsets: { dx: number; dy: number }[] = [];

  for (let i = 0; i < numWaypoints; i++) {
    if (i > 0) {
      // Wide turn angle sampled randomly anywhere in [-140°, +140°] (280° total arc freedom)
      const turnAngle = (Math.random() - 0.5) * (Math.PI * 1.55);
      currentAngle += turnAngle;
    }
    // Dynamic segment length ratio sampled randomly from [0.25, 1.75] for structural variety
    const segWeight = 0.25 + Math.random() * 1.5;
    rawOffsets.push({
      dx: segWeight * Math.cos(currentAngle),
      dy: segWeight * Math.sin(currentAngle),
    });
  }

  let currentDist = 0;
  for (const off of rawOffsets) {
    currentDist += Math.hypot(off.dx, off.dy);
  }

  const scale = currentDist > 0 ? targetDistance / currentDist : 1;

  let currLocation: LatLng = { lat: centerLat, lng: centerLng };
  const waypoints: LatLng[] = [];

  for (const off of rawOffsets) {
    currLocation = offsetCoordinates(currLocation.lat, currLocation.lng, off.dx * scale, off.dy * scale);
    waypoints.push(currLocation);
  }

  return waypoints;
};

// Generate a random route with 1-4 waypoints matching a target total distance range
export const generateRandomRoute = (
  centerLat: number,
  centerLng: number,
  numWaypoints: number, // 1 to 4
  minTotalDist: number, // in km
  maxTotalDist: number, // in km
  roundTrip: boolean
): { waypoints: LatLng[]; totalDistance: number } => {
  const minD = Math.max(0.1, Math.min(minTotalDist, maxTotalDist));
  const maxD = Math.max(minD, Math.max(minTotalDist, maxTotalDist));

  // Target total distance for the entire path
  const targetDistance = minD + Math.random() * (maxD - minD);

  const waypoints = roundTrip
    ? generateRoundTripPoints(centerLat, centerLng, numWaypoints, targetDistance)
    : generateOneWayPoints(centerLat, centerLng, numWaypoints, targetDistance);

  // Calculate actual total distance along full path
  const fullPath = [{ lat: centerLat, lng: centerLng }, ...waypoints];
  if (roundTrip) {
    fullPath.push({ lat: centerLat, lng: centerLng });
  }
  const totalDistance = getTotalRouteDistance(fullPath);

  return { waypoints, totalDistance };
};

// Generate default Google Maps location URL
export const getGoogleMapsUrl = (
  destLat: number,
  destLng: number
): string => {
  return `https://www.google.com/maps?q=${destLat.toFixed(6)},${destLng.toFixed(6)}`;
};

// Generate multi-waypoint Google Maps Directions URL
export const getGoogleMapsRouteUrl = (
  origin: LatLng | null,
  waypoints: LatLng[],
  roundTrip: boolean
): string => {
  if (!origin || waypoints.length === 0) return "#";

  const destination = roundTrip ? origin : waypoints[waypoints.length - 1];
  const intermediate = roundTrip ? waypoints : waypoints.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`,
    destination: `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`,
  });

  if (intermediate.length > 0) {
    params.set(
      "waypoints",
      intermediate.map((w) => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`).join("|")
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

// Generate default Komoot Tour Planner URL (default sport: touringbicycle)
export const getKomootUrl = (
  destLat: number,
  destLng: number
): string => {
  return `https://www.komoot.com/plan/@${destLat.toFixed(6)},${destLng.toFixed(6)},14z?sport=touringbicycle`;
};
