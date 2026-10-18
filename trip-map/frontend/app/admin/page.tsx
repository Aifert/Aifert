"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Activity, Leg, Stop, Trip } from "@/lib/types";

type Tab = "stops" | "legs" | "activities";

export default function AdminPage() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tab, setTab] = useState<Tab>("stops");
  const [msg, setMsg] = useState("");

  async function reload() {
    setTrip(await api.trip());
  }

  useEffect(() => {
    api.me().then(reload).catch(() => {
      window.location.href = "/login/";
    });
  }, []);

  if (!trip) {
    return <main className="p-6 text-sand">Loading admin…</main>;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sand/60">
            Field desk
          </p>
          <h1 className="font-display text-3xl">Admin</h1>
        </div>
        <Link href="/" className="rounded-full bg-paper/10 px-4 py-2 text-sm">
          Back to map
        </Link>
      </header>
      <div className="mt-5 flex gap-2">
        {(["stops", "legs", "activities"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm capitalize ${
              tab === t ? "bg-copper text-ink" : "bg-paper/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {msg ? <p className="mt-3 text-sm text-copper">{msg}</p> : null}
      {tab === "stops" ? (
        <StopsAdmin
          stops={trip.stops}
          onChange={reload}
          onError={setMsg}
        />
      ) : null}
      {tab === "legs" ? (
        <LegsAdmin legs={trip.legs} stops={trip.stops} onChange={reload} onError={setMsg} />
      ) : null}
      {tab === "activities" ? (
        <ActsAdmin
          activities={trip.activities}
          stops={trip.stops}
          onChange={reload}
          onError={setMsg}
        />
      ) : null}
    </main>
  );
}

function StopsAdmin({
  stops,
  onChange,
  onError,
}: {
  stops: Stop[];
  onChange: () => Promise<void>;
  onError: (s: string) => void;
}) {
  async function toggle(stop: Stop) {
    await api.patchStop(stop.id, { lodging_booked: !stop.lodging_booked });
    await onChange();
  }
  async function remove(stop: Stop) {
    if (!confirm(`Delete ${stop.name}?`)) return;
    await api.deleteStop(stop.id);
    await onChange();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api.createStop({
        slug: String(f.get("slug") || ""),
        name: String(f.get("name")),
        city: String(f.get("city")),
        country: String(f.get("country")),
        country_code: String(f.get("country_code")),
        lat: Number(f.get("lat")),
        lng: Number(f.get("lng")),
        timezone: String(f.get("timezone")),
        arrive_at: String(f.get("arrive_at")),
        depart_at: String(f.get("depart_at")),
        lodging_name: String(f.get("lodging_name") || ""),
        confirmation: String(f.get("confirmation") || ""),
        lodging_booked: f.get("lodging_booked") === "on",
        sort_order: Number(f.get("sort_order") || 0),
      });
      event.currentTarget.reset();
      await onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "save failed");
    }
  }
  return (
    <div className="mt-6 space-y-4">
      {stops.map((stop) => (
        <article
          key={stop.id}
          className="rounded-2xl border border-sand/15 bg-paper/5 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-xl">{stop.name}</h2>
              <p className="text-sm text-sand/70">
                {stop.lodging_name} · {stop.confirmation || "no confirmation"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-paper/10 px-3 py-1.5 text-sm"
                onClick={() => toggle(stop)}
              >
                {stop.lodging_booked ? "Mark to-book" : "Mark booked"}
              </button>
              <button
                type="button"
                className="rounded-lg bg-copper/30 px-3 py-1.5 text-sm"
                onClick={() => remove(stop)}
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
      <form
        onSubmit={save}
        className="grid gap-3 rounded-2xl border border-dashed border-sand/25 p-4 md:grid-cols-2"
      >
        <h3 className="font-display text-lg md:col-span-2">Add stop</h3>
        {[
          ["slug", "slug"],
          ["name", "name"],
          ["city", "city"],
          ["country", "country"],
          ["country_code", "JP / TW / CN / VN"],
          ["lat", "lat"],
          ["lng", "lng"],
          ["timezone", "Asia/Tokyo"],
          ["arrive_at", "2026-11-10T15:20+09:00"],
          ["depart_at", "2026-11-17T10:00+09:00"],
          ["lodging_name", "hotel"],
          ["confirmation", "code"],
          ["sort_order", "200"],
        ].map(([name, ph]) => (
          <input
            key={name}
            name={name}
            placeholder={ph}
            required={["name", "city", "country", "country_code", "lat", "lng", "timezone", "arrive_at", "depart_at"].includes(name)}
            className="rounded-lg border border-sand/20 bg-ink px-3 py-2 text-sm"
          />
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="lodging_booked" defaultChecked />
          Lodging booked
        </label>
        <button className="rounded-lg bg-copper px-3 py-2 text-sm font-semibold text-ink">
          Add stop
        </button>
      </form>
    </div>
  );
}

function LegsAdmin({
  legs,
  stops,
  onChange,
  onError,
}: {
  legs: Leg[];
  stops: Stop[];
  onChange: () => Promise<void>;
  onError: (s: string) => void;
}) {
  async function toggle(leg: Leg) {
    await api.patchLeg(leg.id, { booked: !leg.booked });
    await onChange();
  }
  async function remove(leg: Leg) {
    if (!confirm("Delete this leg?")) return;
    await api.deleteLeg(leg.id);
    await onChange();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api.createLeg({
        from_stop_id: f.get("from_stop_id") ? Number(f.get("from_stop_id")) : null,
        to_stop_id: f.get("to_stop_id") ? Number(f.get("to_stop_id")) : null,
        kind: String(f.get("kind")),
        booked: f.get("booked") === "on",
        carrier: String(f.get("carrier") || ""),
        flight_no: String(f.get("flight_no") || ""),
        confirmation: String(f.get("confirmation") || ""),
        depart_at: String(f.get("depart_at") || "") || null,
        arrive_at: String(f.get("arrive_at") || "") || null,
        from_label: String(f.get("from_label")),
        to_label: String(f.get("to_label")),
        from_lat: Number(f.get("from_lat")),
        from_lng: Number(f.get("from_lng")),
        to_lat: Number(f.get("to_lat")),
        to_lng: Number(f.get("to_lng")),
        notes: String(f.get("notes") || ""),
        sort_order: Number(f.get("sort_order") || 0),
      });
      event.currentTarget.reset();
      await onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "save failed");
    }
  }
  return (
    <div className="mt-6 space-y-4">
      {legs.map((leg) => (
        <article
          key={leg.id}
          className="rounded-2xl border border-sand/15 bg-paper/5 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-lg">
                {leg.from_label} → {leg.to_label}
              </h2>
              <p className="text-sm text-sand/70">
                {leg.kind} · {leg.carrier} {leg.flight_no} ·{" "}
                {leg.booked ? "booked" : "to book"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-paper/10 px-3 py-1.5 text-sm"
                onClick={() => toggle(leg)}
              >
                Toggle booked
              </button>
              <button
                type="button"
                className="rounded-lg bg-copper/30 px-3 py-1.5 text-sm"
                onClick={() => remove(leg)}
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
      <form
        onSubmit={save}
        className="grid gap-3 rounded-2xl border border-dashed border-sand/25 p-4 md:grid-cols-2"
      >
        <h3 className="font-display text-lg md:col-span-2">Add leg</h3>
        <select name="from_stop_id" className="rounded-lg bg-ink px-3 py-2 text-sm">
          <option value="">From stop (optional)</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="to_stop_id" className="rounded-lg bg-ink px-3 py-2 text-sm">
          <option value="">To stop (optional)</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input name="kind" placeholder="flight or ground" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="carrier" placeholder="carrier" className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="flight_no" placeholder="flight no" className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="confirmation" placeholder="confirmation" className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="depart_at" placeholder="depart ISO" className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="arrive_at" placeholder="arrive ISO" className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="from_label" placeholder="from label" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="to_label" placeholder="to label" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="from_lat" placeholder="from lat" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="from_lng" placeholder="from lng" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="to_lat" placeholder="to lat" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="to_lng" placeholder="to lng" required className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="notes" placeholder="notes" className="rounded-lg bg-ink px-3 py-2 text-sm md:col-span-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="booked" /> Booked
        </label>
        <button className="rounded-lg bg-copper px-3 py-2 text-sm font-semibold text-ink">
          Add leg
        </button>
      </form>
    </div>
  );
}

function ActsAdmin({
  activities,
  stops,
  onChange,
  onError,
}: {
  activities: Activity[];
  stops: Stop[];
  onChange: () => Promise<void>;
  onError: (s: string) => void;
}) {
  async function toggle(act: Activity) {
    await api.patchActivity(act.id, { booked: !act.booked });
    await onChange();
  }
  async function remove(act: Activity) {
    if (!confirm("Delete this activity?")) return;
    await api.deleteActivity(act.id);
    await onChange();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api.createActivity({
        stop_id: Number(f.get("stop_id")),
        day: String(f.get("day") || "") || null,
        title: String(f.get("title")),
        notes: String(f.get("notes") || ""),
        booked: f.get("booked") === "on",
        optional: f.get("optional") === "on",
      });
      event.currentTarget.reset();
      await onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "save failed");
    }
  }
  const name = (id: number) => stops.find((s) => s.id === id)?.name || id;
  return (
    <div className="mt-6 space-y-4">
      {activities.map((act) => (
        <article
          key={act.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sand/15 bg-paper/5 p-4"
        >
          <div>
            <p className="font-medium">{act.title}</p>
            <p className="text-sm text-sand/70">
              {name(act.stop_id)} · {act.day || "any day"} ·{" "}
              {act.booked ? "booked" : "to book"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-paper/10 px-3 py-1.5 text-sm"
              onClick={() => toggle(act)}
            >
              Toggle booked
            </button>
            <button
              type="button"
              className="rounded-lg bg-copper/30 px-3 py-1.5 text-sm"
              onClick={() => remove(act)}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
      <form
        onSubmit={save}
        className="grid gap-3 rounded-2xl border border-dashed border-sand/25 p-4 md:grid-cols-2"
      >
        <h3 className="font-display text-lg md:col-span-2">Add activity</h3>
        <select name="stop_id" required className="rounded-lg bg-ink px-3 py-2 text-sm">
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input name="day" placeholder="2026-11-12 (optional)" className="rounded-lg bg-ink px-3 py-2 text-sm" />
        <input name="title" placeholder="title" required className="rounded-lg bg-ink px-3 py-2 text-sm md:col-span-2" />
        <input name="notes" placeholder="notes" className="rounded-lg bg-ink px-3 py-2 text-sm md:col-span-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="booked" defaultChecked /> Booked
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="optional" /> Optional
        </label>
        <button className="rounded-lg bg-copper px-3 py-2 text-sm font-semibold text-ink md:col-span-2">
          Add activity
        </button>
      </form>
    </div>
  );
}
