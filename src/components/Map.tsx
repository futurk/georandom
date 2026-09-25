import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getDistanceInKm, formatDistance, getGoogleMapsUrl, getKomootUrl, LatLng } from "./helpers";

interface MapProps {
  centerLat: number | null;
  centerLng: number | null;
  mode?: "single" | "route";
  // Single location mode props
  randomLat?: number | null;
  randomLng?: number | null;
  minRadius?: number; // in km
  maxRadius?: number; // in km
  // Route mode props
  routeWaypoints?: LatLng[];
  roundTrip?: boolean;
  // Shared
  isDarkMode: boolean;
  onMapClick: (lat: number, lng: number) => void;
}

// Inline Copy Button for Leaflet Popups
const PopupCopyButton: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700/60 rounded transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white shrink-0 ml-1 inline-flex items-center justify-center cursor-pointer"
      title="Copy Coordinates"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
};

// Custom DivIcon for Center point (Blue pulsing beacon with 48px touch target)
const centerIcon = L.divIcon({
  html: `
    <div class="relative flex items-center justify-center w-12 h-12 cursor-pointer">
      <div class="absolute w-8 h-8 rounded-full bg-blue-500 opacity-30 animate-ping"></div>
      <div class="absolute w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg"></div>
    </div>
  `,
  className: "custom-center-icon",
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

// Custom DivIcon for Single Random point (Red map pin with 48px touch target)
const randomIcon = L.divIcon({
  html: `
    <div class="relative flex items-center justify-center w-12 h-12 cursor-pointer">
      <svg class="w-8 h-8 filter drop-shadow-md transform transition-transform duration-300 hover:scale-110" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#EF4444"/>
      </svg>
    </div>
  `,
  className: "custom-random-icon",
  iconSize: [48, 48],
  iconAnchor: [24, 42],
});

// Custom DivIcon for Route Waypoints (Numbered badges with 48px touch target)
const createWaypointIcon = (index: number) =>
  L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-12 h-12 cursor-pointer">
        <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs shadow-lg border-2 border-white transform transition-transform hover:scale-110">
          ${index + 1}
        </div>
      </div>
    `,
    className: "custom-waypoint-icon",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

// Component to handle map center changes and fitting bounds smoothly
const MapController: React.FC<{
  centerLat: number | null;
  centerLng: number | null;
  randomLat?: number | null;
  randomLng?: number | null;
  routeWaypoints?: LatLng[];
  mode: "single" | "route";
}> = ({ centerLat, centerLng, randomLat, randomLng, routeWaypoints, mode }) => {
  const map = useMap();

  useEffect(() => {
    if (centerLat !== null && centerLng !== null) {
      if (mode === "single" && typeof randomLat === "number" && typeof randomLng === "number") {
        const bounds = L.latLngBounds(
          [centerLat, centerLng],
          [randomLat, randomLng]
        );
        const currentZoom = map.getZoom();
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: currentZoom, animate: true });
      } else if (mode === "route" && routeWaypoints && routeWaypoints.length > 0) {
        const points: [number, number][] = [
          [centerLat, centerLng],
          ...routeWaypoints.map((w) => [w.lat, w.lng] as [number, number]),
        ];
        const bounds = L.latLngBounds(points);
        const currentZoom = map.getZoom();
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: currentZoom, animate: true });
      } else {
        map.setView([centerLat, centerLng], 12, { animate: true });
      }
    }
  }, [centerLat, centerLng, randomLat, randomLng, routeWaypoints, mode, map]);

  return null;
};

// Component to capture click events on the map safely without resetting center when dismissing popups
const MapEvents: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  const popupOpenRef = React.useRef(false);

  useMapEvents({
    popupopen() {
      popupOpenRef.current = true;
    },
    popupclose() {
      // Delay resetting slightly so the map click that dismissed the popup is consumed safely
      setTimeout(() => {
        popupOpenRef.current = false;
      }, 50);
    },
    click(e) {
      // If a popup dialog was open when clicking outside, consume the click to dismiss the popup instead of changing center
      if (popupOpenRef.current) {
        return;
      }
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const Map: React.FC<MapProps> = ({
  centerLat,
  centerLng,
  mode = "single",
  randomLat = null,
  randomLng = null,
  minRadius = 0,
  maxRadius = 20,
  routeWaypoints = [],
  roundTrip = false,
  isDarkMode,
  onMapClick,
}) => {
  // Fallback initial center if nothing is loaded (defaults to Paris center coordinates)
  const defaultCenterLat = 48.8566;
  const defaultCenterLng = 2.3522;

  const initialLat = centerLat ?? defaultCenterLat;
  const initialLng = centerLng ?? defaultCenterLng;

  const calculatedDistance =
    typeof centerLat === "number" && typeof centerLng === "number" && typeof randomLat === "number" && typeof randomLng === "number"
      ? getDistanceInKm(centerLat, centerLng, randomLat, randomLng)
      : null;

  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY;
  const apiKeyQuery = cartoApiKey ? `?key=${cartoApiKey}` : "";

  return (
    <MapContainer
      center={[initialLat, initialLng]}
      zoom={12}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem", overflow: "hidden" }}
      zoomControl={false}
    >
      <TileLayer
        url={
          isDarkMode
            ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${apiKeyQuery}`
            : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${apiKeyQuery}`
        }
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> contributors'
      />

      <MapController
        centerLat={centerLat}
        centerLng={centerLng}
        randomLat={randomLat}
        randomLng={randomLng}
        routeWaypoints={routeWaypoints}
        mode={mode}
      />

      <MapEvents onMapClick={onMapClick} />

      {/* Center point Marker */}
      {centerLat !== null && centerLng !== null && (
        <Marker position={[centerLat, centerLng]} icon={centerIcon}>
          <Popup>
            <div className="text-center font-sans">
              <span className="font-semibold text-blue-600 block text-xs uppercase tracking-wide">
                {mode === "route" ? "Route Origin / Start" : "Search Center"}
              </span>
              <div className="flex items-center justify-center gap-0.5 text-sm font-medium">
                <span>{centerLat.toFixed(6)}, {centerLng.toFixed(6)}</span>
                <PopupCopyButton lat={centerLat} lng={centerLng} />
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* SINGLE MODE: Outer Geofence Circle (Max Radius) */}
      {mode === "single" && centerLat !== null && centerLng !== null && maxRadius > 0 && (
        <Circle
          center={[centerLat, centerLng]}
          radius={maxRadius * 1000} // radius in meters
          pathOptions={{
            color: isDarkMode ? "#3B82F6" : "#2563EB",
            fillColor: isDarkMode ? "#60A5FA" : "#3B82F6",
            fillOpacity: 0.1,
            weight: 2,
            dashArray: "4, 6",
          }}
        />
      )}

      {/* SINGLE MODE: Inner Exclusion Circle (Min Radius) */}
      {mode === "single" && centerLat !== null && centerLng !== null && minRadius > 0 && minRadius < maxRadius && (
        <Circle
          center={[centerLat, centerLng]}
          radius={minRadius * 1000} // radius in meters
          pathOptions={{
            color: isDarkMode ? "#F59E0B" : "#D97706",
            fillColor: isDarkMode ? "#171717" : "#F5F5F5",
            fillOpacity: 0.35,
            weight: 2,
            dashArray: "3, 5",
          }}
        />
      )}

      {/* SINGLE MODE: Generated Random point Marker */}
      {mode === "single" && typeof randomLat === "number" && typeof randomLng === "number" && (
        <Marker position={[randomLat, randomLng]} icon={randomIcon}>
          <Popup>
            <div className="text-center font-sans p-1">
              <span className="font-bold text-red-500 block text-xs uppercase tracking-wide mb-1">Random Location</span>
              <div className="flex items-center justify-center gap-0.5 text-sm font-semibold">
                <span>{randomLat.toFixed(6)}, {randomLng.toFixed(6)}</span>
                <PopupCopyButton lat={randomLat} lng={randomLng} />
              </div>
              {calculatedDistance !== null && (
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium my-1">
                  Distance: <span className="font-bold text-blue-600 dark:text-blue-400">{formatDistance(calculatedDistance)}</span>
                </div>
              )}
              <div className="mt-2 border-t pt-2 flex flex-col gap-1.5 text-xs font-medium">
                <a
                  href={getGoogleMapsUrl(randomLat, randomLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center justify-center gap-1"
                >
                  <span>🗺️ Open in Google Maps</span>
                </a>
                <a
                  href={getKomootUrl(randomLat, randomLng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1"
                >
                  <span>💚 Open in Komoot</span>
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ROUTE MODE: Route Polyline Path */}
      {mode === "route" && centerLat !== null && centerLng !== null && routeWaypoints.length > 0 && (
        <Polyline
          positions={[
            [centerLat, centerLng],
            ...routeWaypoints.map((w) => [w.lat, w.lng] as [number, number]),
            ...(roundTrip ? [[centerLat, centerLng] as [number, number]] : []),
          ]}
          pathOptions={{
            color: isDarkMode ? "#60A5FA" : "#2563EB",
            weight: 3,
            dashArray: "6, 6",
            opacity: 0.85,
          }}
        />
      )}

      {/* ROUTE MODE: Waypoint Markers */}
      {mode === "route" &&
        routeWaypoints.map((wp, idx) => (
          <Marker key={`wp-${idx}`} position={[wp.lat, wp.lng]} icon={createWaypointIcon(idx)}>
            <Popup>
              <div className="text-center font-sans p-1">
                <span className="font-bold text-indigo-600 block text-xs uppercase tracking-wide mb-1">
                  Waypoint {idx + 1}
                </span>
                <div className="flex items-center justify-center gap-0.5 text-xs font-mono font-semibold">
                  <span>{wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}</span>
                  <PopupCopyButton lat={wp.lat} lng={wp.lng} />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
};

export default Map;
