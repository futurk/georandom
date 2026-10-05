import { describe, it, expect } from 'vitest';
import {
  EARTH_RADIUS_KM,
  KM_PER_LAT_DEGREE,
  degToRad,
  offsetCoordinates,
  getRandomLocation,
  getDistanceInKm,
  formatDistance,
  getTotalRouteDistance,
  generateRoundTripPoints,
  generateOneWayPoints,
  generateRandomRoute,
  getGoogleMapsUrl,
  getGoogleMapsRouteUrl,
  getKomootUrl,
  LatLng,
} from './helpers';

describe('Math & Constants', () => {
  it('defines earth radius and km per lat degree', () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
    expect(KM_PER_LAT_DEGREE).toBe(111);
  });

  it('correctly converts degrees to radians', () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 6);
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('offsetCoordinates', () => {
  it('returns same coordinates when offset is 0, 0', () => {
    const origin = { lat: 51.5074, lng: -0.1278 };
    const result = offsetCoordinates(origin.lat, origin.lng, 0, 0);
    expect(result.lat).toBeCloseTo(origin.lat, 6);
    expect(result.lng).toBeCloseTo(origin.lng, 6);
  });

  it('shifts latitude by ~1 degree when moving 111km North', () => {
    const origin = { lat: 0, lng: 0 };
    const result = offsetCoordinates(origin.lat, origin.lng, 0, KM_PER_LAT_DEGREE);
    expect(result.lat).toBeCloseTo(1, 4);
    expect(result.lng).toBeCloseTo(0, 4);
  });

  it('shifts longitude correctly at the equator', () => {
    const origin = { lat: 0, lng: 0 };
    const result = offsetCoordinates(origin.lat, origin.lng, KM_PER_LAT_DEGREE, 0);
    expect(result.lat).toBeCloseTo(0, 4);
    expect(result.lng).toBeCloseTo(1, 4);
  });
});

describe('Distance calculations', () => {
  it('returns 0 distance for identical points', () => {
    const p = { lat: 48.8566, lng: 2.3522 };
    expect(getDistanceInKm(p.lat, p.lng, p.lat, p.lng)).toBe(0);
  });

  it('calculates known distance between Paris and London (~343 km)', () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const london = { lat: 51.5074, lng: -0.1278 };
    const dist = getDistanceInKm(paris.lat, paris.lng, london.lat, london.lng);
    expect(dist).toBeGreaterThan(340);
    expect(dist).toBeLessThan(350);
  });

  it('formats distance nicely for meters and kilometers', () => {
    expect(formatDistance(0.005)).toBe('5 m');
    expect(formatDistance(0.35)).toBe('350 m');
    expect(formatDistance(0.999)).toBe('999 m');
    expect(formatDistance(1.0)).toBe('1.00 km');
    expect(formatDistance(12.345)).toBe('12.35 km');
  });

  it('calculates total route distance along polyline', () => {
    const path: LatLng[] = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
      { lat: 1, lng: 1 },
    ];
    const total = getTotalRouteDistance(path);
    expect(total).toBeGreaterThan(200);
    expect(total).toBeLessThan(250);
  });
});

describe('getRandomLocation', () => {
  it('generates a location within the specified radius bounds', () => {
    const center = { lat: 52.52, lng: 13.405 };
    const minR = 5;
    const maxR = 10;

    for (let i = 0; i < 20; i++) {
      const loc = getRandomLocation(center.lat, center.lng, minR, maxR);
      const dist = getDistanceInKm(center.lat, center.lng, loc.lat, loc.lng);
      // Flat earth approximation in offsetCoordinates introduces small variance (< 5%)
      expect(dist).toBeGreaterThanOrEqual(minR * 0.95);
      expect(dist).toBeLessThanOrEqual(maxR * 1.05);
    }
  });
});

describe('Route Generators', () => {
  const center = { lat: 40.7128, lng: -74.006 };

  it('generates the exact requested number of round trip waypoints', () => {
    const waypoints = generateRoundTripPoints(center.lat, center.lng, 3, 20);
    expect(waypoints).toHaveLength(3);
  });

  it('generates the exact requested number of one-way waypoints', () => {
    const waypoints = generateOneWayPoints(center.lat, center.lng, 4, 30);
    expect(waypoints).toHaveLength(4);
  });

  it('generates a round trip route with total distance close to target range', () => {
    const route = generateRandomRoute(center.lat, center.lng, 3, 10, 20, true);
    expect(route.waypoints).toHaveLength(3);
    expect(route.totalDistance).toBeGreaterThanOrEqual(9);
    expect(route.totalDistance).toBeLessThanOrEqual(22);
  });

  it('generates a one-way route with total distance close to target range', () => {
    const route = generateRandomRoute(center.lat, center.lng, 2, 15, 25, false);
    expect(route.waypoints).toHaveLength(2);
    expect(route.totalDistance).toBeGreaterThanOrEqual(13);
    expect(route.totalDistance).toBeLessThanOrEqual(27);
  });
});

describe('Map URLs', () => {
  it('generates valid Google Maps destination URL', () => {
    const url = getGoogleMapsUrl(40.1234567, -74.9876543);
    expect(url).toBe('https://www.google.com/maps?q=40.123457,-74.987654');
  });

  it('returns # for empty route input', () => {
    expect(getGoogleMapsRouteUrl(null, [], false)).toBe('#');
    expect(getGoogleMapsRouteUrl({ lat: 0, lng: 0 }, [], false)).toBe('#');
  });

  it('generates valid one-way route URL without intermediate waypoints', () => {
    const origin = { lat: 10, lng: 20 };
    const waypoints = [{ lat: 11, lng: 21 }];
    const url = getGoogleMapsRouteUrl(origin, waypoints, false);
    expect(url).toContain('origin=10.000000%2C20.000000');
    expect(url).toContain('destination=11.000000%2C21.000000');
    expect(url).not.toContain('waypoints=');
  });

  it('generates valid one-way route URL with intermediate waypoints', () => {
    const origin = { lat: 10, lng: 20 };
    const waypoints = [
      { lat: 11, lng: 21 },
      { lat: 12, lng: 22 },
    ];
    const url = getGoogleMapsRouteUrl(origin, waypoints, false);
    expect(url).toContain('origin=10.000000%2C20.000000');
    expect(url).toContain('destination=12.000000%2C22.000000');
    expect(url).toContain('waypoints=11.000000%2C21.000000');
  });

  it('generates valid round-trip route URL with origin as destination', () => {
    const origin = { lat: 10, lng: 20 };
    const waypoints = [
      { lat: 11, lng: 21 },
      { lat: 12, lng: 22 },
    ];
    const url = getGoogleMapsRouteUrl(origin, waypoints, true);
    expect(url).toContain('origin=10.000000%2C20.000000');
    expect(url).toContain('destination=10.000000%2C20.000000');
    expect(url).toContain('waypoints=11.000000%2C21.000000%7C12.000000%2C22.000000');
  });

  it('generates valid Komoot planner URL', () => {
    const url = getKomootUrl(50.123456, 8.123456);
    expect(url).toBe('https://www.komoot.com/plan/@50.123456,8.123456,14z?sport=touringbicycle');
  });
});
