"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import HeroCard from "@/components/HeroCard";
import Lightbox from "@/components/Lightbox";
import Timeline, { stopForDay, tripDays } from "@/components/Timeline";
import { api } from "@/lib/api";
import { Photo, Today, Trip } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function HomePage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [day, setDay] = useState<string>("2026-11-10");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([api.trip(), api.today()]);
    setTrip(t);
    setToday(d);
    if (d.stop) {
      const tz = d.stop.timezone;
      const local = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(d.now));
      setDay(local);
    } else if (d.phase === "countdown") {
      setDay("2026-11-10");
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then(load)
      .catch(() => {
        window.location.href = "/login/";
      });
  }, [load]);

  const focus = useMemo(() => {
    if (!trip) return null;
    const stop = stopForDay(trip.stops, day);
    if (stop) return { lat: stop.lat, lng: stop.lng };
    return today?.stop
      ? { lat: today.stop.lat, lng: today.stop.lng }
      : { lat: 28, lng: 118 };
  }, [trip, day, today]);

  async function upload(stopId: number, files: FileList) {
    try {
      for (const file of Array.from(files)) {
        await api.uploadPhoto(stopId, file);
      }
      setTrip(await api.trip());
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    }
  }

  async function removePhoto(photo: Photo) {
    if (!confirm("Delete this photo?")) return;
    await api.deletePhoto(photo.id);
    setLightbox(null);
    setTrip(await api.trip());
  }

  if (!trip || !today) {
    return (
      <main className="grid min-h-dvh place-items-center text-sand">
        Unrolling the map…
      </main>
    );
  }

  const days = tripDays(trip.stops);
  const gallery =
    trip.photos.filter((p) => {
      const stop = stopForDay(trip.stops, day);
      return stop && p.stop_id === stop.id;
    }) || [];

  return (
    <main className="relative h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <MapView
          stops={trip.stops}
          legs={trip.legs}
          photos={trip.photos}
          focus={focus}
          onSelectStop={(stop) => {
            const a = new Intl.DateTimeFormat("en-CA", {
              timeZone: stop.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(stop.arrive_at));
            setDay(a);
          }}
          onPhoto={(photo) => {
            const idx = gallery.findIndex((p) => p.id === photo.id);
            setLightbox(idx >= 0 ? idx : 0);
          }}
        />
      </div>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-start justify-between p-3 md:p-5">
        <div>
          <HeroCard today={today} />
        </div>
        <nav className="pointer-events-auto flex gap-2">
          <Link
            href="/admin/"
            className="rounded-full bg-ink/70 px-3 py-2 text-sm text-sand backdrop-blur"
          >
            Admin
          </Link>
          <button
            type="button"
            className="rounded-full bg-ink/70 px-3 py-2 text-sm text-sand backdrop-blur"
            onClick={async () => {
              await api.logout();
              window.location.href = "/login/";
            }}
          >
            Lock
          </button>
        </nav>
      </header>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] p-0 md:p-5">
        <Timeline
          stops={trip.stops}
          legs={trip.legs}
          activities={trip.activities}
          photos={trip.photos}
          day={days.includes(day) ? day : days[0]}
          onDay={setDay}
          onUpload={upload}
          onOpenPhoto={(photo) =>
            setLightbox(gallery.findIndex((p) => p.id === photo.id))
          }
          onDeletePhoto={removePhoto}
        />
      </div>
      {error ? (
        <p className="absolute left-1/2 top-1/2 z-[600] -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-sm text-copper">
          {error}
        </p>
      ) : null}
      {lightbox !== null && gallery[lightbox] ? (
        <Lightbox
          photos={gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onPrev={() =>
            setLightbox((i) =>
              i === null ? 0 : (i + gallery.length - 1) % gallery.length,
            )
          }
          onNext={() =>
            setLightbox((i) => (i === null ? 0 : (i + 1) % gallery.length))
          }
          onDelete={() => removePhoto(gallery[lightbox])}
        />
      ) : null}
    </main>
  );
}
