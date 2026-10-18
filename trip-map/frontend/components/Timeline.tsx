"use client";

import { ChangeEvent, useMemo, useRef } from "react";
import { Activity, Leg, Photo, Stop } from "@/lib/types";

function ymd(value: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function prettyDate(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtTime(value: string | null, tz: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function tripDays(stops: Stop[]): string[] {
  if (!stops.length) return [];
  const days: string[] = [];
  const sorted = [...stops].sort((a, b) => a.sort_order - b.sort_order);
  const first = ymd(sorted[0].arrive_at, sorted[0].timezone);
  const lastStop = sorted[sorted.length - 1];
  const last = ymd(lastStop.depart_at, lastStop.timezone);
  let cursor = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function stopForDay(stops: Stop[], day: string): Stop | null {
  const hits = stops.filter((stop) => {
    const a = ymd(stop.arrive_at, stop.timezone);
    const d = ymd(stop.depart_at, stop.timezone);
    return a <= day && day < d;
  });
  return hits[hits.length - 1] || null;
}

export function incomingLeg(legs: Leg[], stop: Stop | null, day: string): Leg | null {
  if (!stop) return null;
  const sameDay = legs.filter((leg) => {
    if (leg.to_stop_id !== stop.id || !leg.arrive_at) return false;
    return ymd(leg.arrive_at, stop.timezone) === day;
  });
  return sameDay[0] || null;
}

function Badge({ booked }: { booked: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        booked ? "bg-moss/40 text-sand" : "bg-warning/20 text-warning"
      }`}
    >
      {booked ? "Booked" : "To book"}
    </span>
  );
}

export default function Timeline({
  stops,
  legs,
  activities,
  photos,
  day,
  onDay,
  onUpload,
  onOpenPhoto,
  onDeletePhoto,
}: {
  stops: Stop[];
  legs: Leg[];
  activities: Activity[];
  photos: Photo[];
  day: string;
  onDay: (day: string) => void;
  onUpload: (stopId: number, files: FileList) => void;
  onOpenPhoto: (photo: Photo) => void;
  onDeletePhoto: (photo: Photo) => void;
}) {
  const days = useMemo(() => tripDays(stops), [stops]);
  const stop = stopForDay(stops, day);
  const leg = incomingLeg(legs, stop, day);
  const acts = activities.filter(
    (a) => stop && a.stop_id === stop.id && (!a.day || a.day === day),
  );
  const shots = photos.filter((p) => stop && p.stop_id === stop.id);
  const idx = Math.max(0, days.indexOf(day));
  const fileRef = useRef<HTMLInputElement>(null);

  function onSlide(event: ChangeEvent<HTMLInputElement>) {
    const next = days[Number(event.target.value)];
    if (next) onDay(next);
  }

  return (
    <section className="pointer-events-auto w-full rounded-t-3xl border border-sand/20 bg-ink/80 p-4 shadow-2xl backdrop-blur-md md:rounded-3xl">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-lg bg-paper/10 px-3 py-2 text-sm"
          onClick={() => onDay(days[Math.max(0, idx - 1)])}
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-sand/60">
            Day-by-day
          </p>
          <p className="font-display text-lg">{prettyDate(day)}</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-paper/10 px-3 py-2 text-sm"
          onClick={() => onDay(days[Math.min(days.length - 1, idx + 1)])}
        >
          →
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0, days.length - 1)}
        value={idx}
        onChange={onSlide}
        className="mt-3 w-full"
        aria-label="Trip day"
      />
      {stop ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl">{stop.city}</h3>
              <Badge booked={stop.lodging_booked} />
            </div>
            <p className="text-sm text-sand/80">
              {stop.country} · {prettyDate(ymd(stop.arrive_at, stop.timezone))}
              {" – "}
              {prettyDate(ymd(stop.depart_at, stop.timezone))}
            </p>
            <p className="mt-2 text-sm">
              <span className="text-sand/60">Stay · </span>
              {stop.lodging_name || "TBD"}
              {stop.confirmation ? ` · ${stop.confirmation}` : ""}
            </p>
            {stop.lodging_address ? (
              <p className="text-sm text-sand/75">{stop.lodging_address}</p>
            ) : null}
            {stop.lodging_notes ? (
              <p className="mt-1 text-sm text-sand/70">{stop.lodging_notes}</p>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand/60">
              How they get there
            </p>
            {leg ? (
              <div className="mt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm">
                    {leg.from_label} → {leg.to_label}
                  </p>
                  <Badge booked={leg.booked} />
                </div>
                <p className="text-sm text-sand/80">
                  {[leg.carrier, leg.flight_no].filter(Boolean).join(" · ")}
                  {leg.confirmation ? ` · ${leg.confirmation}` : ""}
                </p>
                <p className="text-sm text-sand/70">
                  {fmtTime(leg.depart_at, stop.timezone)}
                  {leg.arrive_at
                    ? ` → ${fmtTime(leg.arrive_at, stop.timezone)}`
                    : ""}
                </p>
                {leg.notes ? (
                  <p className="text-sm text-sand/70">{leg.notes}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm text-sand/70">Already on this stay.</p>
            )}
            <ul className="mt-3 space-y-1">
              {acts.map((act) => (
                <li key={act.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{act.title}</span>
                  <Badge booked={act.booked} />
                  {act.optional ? (
                    <span className="text-[10px] uppercase text-sand/50">
                      Optional
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-sand/70">
          Home stretch or a travel day without a booked night.
        </p>
      )}
      {stop ? (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand/60">
              Photos
            </p>
            <button
              type="button"
              className="rounded-lg bg-copper px-3 py-1.5 text-sm font-semibold text-ink"
              onClick={() => fileRef.current?.click()}
            >
              Add from phone
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length) {
                  onUpload(stop.id, e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {shots.length === 0 ? (
              <p className="text-sm text-sand/60">No photos yet.</p>
            ) : (
              shots.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="relative shrink-0"
                  onClick={() => onOpenPhoto(photo)}
                >
                  <img
                    src={photo.thumb_url}
                    alt={photo.caption || ""}
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  <span
                    className="absolute right-1 top-1 rounded bg-ink/70 px-1 text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePhoto(photo);
                    }}
                  >
                    ✕
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
