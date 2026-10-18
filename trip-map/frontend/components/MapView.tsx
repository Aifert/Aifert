"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COUNTRY_COLORS, Leg, Photo, Stop } from "@/lib/types";

function curvePoints(
  a: [number, number],
  b: [number, number],
  bulge = 0.18,
): [number, number][] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * bulge;
  const cy = my + dx * bulge;
  const pts: [number, number][] = [];
  for (let t = 0; t <= 1; t += 0.025) {
    const lat = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0];
    const lng = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1];
    pts.push([lat, lng]);
  }
  return pts;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 8), { duration: 1.1 });
  }, [lat, lng, map]);
  return null;
}

function stopIcon(n: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div class="stop-pin" style="--c:${color}">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function photoIcon(src: string) {
  return L.divIcon({
    className: "",
    html: `<div class="photo-pin"><img src="${src}" alt="" /></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function MapView({
  stops,
  legs,
  photos,
  focus,
  onSelectStop,
  onPhoto,
}: {
  stops: Stop[];
  legs: Leg[];
  photos: Photo[];
  focus: { lat: number; lng: number } | null;
  onSelectStop: (stop: Stop) => void;
  onPhoto: (photo: Photo) => void;
}) {
  const numbered = useMemo(
    () =>
      [...stops].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [stops],
  );

  return (
    <MapContainer
      center={focus || [28, 118]}
      zoom={4}
      className="h-full w-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; OSM, USGS, and others'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
      />
      {focus ? <FlyTo lat={focus.lat} lng={focus.lng} /> : null}
      {legs.map((leg) => {
        const a: [number, number] = [leg.from_lat, leg.from_lng];
        const b: [number, number] = [leg.to_lat, leg.to_lng];
        const pts = leg.kind === "flight" ? curvePoints(a, b) : [a, b];
        const color = leg.booked ? "#3d5a45" : "#d97706";
        const cls = [
          leg.kind === "flight" ? "flight-arc" : "ground-line",
          leg.booked ? "" : "to-book",
        ].join(" ");
        return (
          <Polyline
            key={leg.id}
            positions={pts}
            pathOptions={{
              color,
              weight: leg.kind === "flight" ? 2.5 : 2,
              opacity: 0.9,
              className: cls,
            }}
          />
        );
      })}
      {numbered.map((stop, i) => (
        <Marker
          key={stop.id}
          position={[stop.lat, stop.lng]}
          icon={stopIcon(i + 1, COUNTRY_COLORS[stop.country_code] || "#c46a2c")}
          eventHandlers={{ click: () => onSelectStop(stop) }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            {stop.name}
          </Tooltip>
        </Marker>
      ))}
      {photos.map((photo) => {
        const stop = stops.find((s) => s.id === photo.stop_id);
        if (!stop) return null;
        const jitter = ((photo.id % 7) - 3) * 0.012;
        return (
          <Marker
            key={`p-${photo.id}`}
            position={[stop.lat + jitter, stop.lng + jitter * 0.6]}
            icon={photoIcon(photo.thumb_url)}
            eventHandlers={{ click: () => onPhoto(photo) }}
          />
        );
      })}
    </MapContainer>
  );
}
