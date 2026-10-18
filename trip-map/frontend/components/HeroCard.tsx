"use client";

import { useEffect, useState } from "react";
import { Today } from "@/lib/types";

function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${hours}h ${mins}m ${secs}s`;
}

export default function HeroCard({ today }: { today: Today }) {
  const [left, setLeft] = useState(today.countdown_seconds);

  useEffect(() => {
    setLeft(today.countdown_seconds);
    if (today.countdown_seconds <= 0) return;
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [today.countdown_seconds, today.now]);

  const heading =
    today.phase === "countdown"
      ? "Where are they today?"
      : today.phase === "back_home" || today.phase === "home_break"
        ? "Where are they today?"
        : "Where are they today?";

  return (
    <section className="pointer-events-auto w-[min(100%,22rem)] rounded-3xl border border-sand/20 bg-ink/75 p-4 shadow-2xl backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.22em] text-sand/70">
        {heading}
      </p>
      <h2 className="mt-1 font-display text-2xl leading-tight text-paper">
        {today.label}
      </h2>
      <p className="mt-1 text-sm text-sand/85">{today.sublabel}</p>
      {(today.phase === "countdown" || today.phase === "home_break") && (
        <p className="mt-3 font-display text-xl text-copper">
          {formatCountdown(left)}
        </p>
      )}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-sand/60">
          <span>Trip progress</span>
          <span>{Math.round(today.progress * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-copper to-sand"
            style={{ width: `${Math.round(today.progress * 100)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
