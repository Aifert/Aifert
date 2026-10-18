"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      window.location.href = "/";
    } catch {
      setError("That passphrase doesn't open this map.");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, #3d5a45 0%, transparent 50%), radial-gradient(900px 500px at 90% 80%, #c46a2c55 0%, transparent 45%), #1b1410",
        }}
      />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(244,239,228,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(244,239,228,0.06)_1px,transparent_1px)] [background-size:40px_40px]" />
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-3xl border border-sand/20 bg-ink/70 p-8 shadow-2xl backdrop-blur-md"
      >
        <p className="text-xs uppercase tracking-[0.28em] text-sand/70">
          Nov 2026 — Jan 2027
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-paper">
          Where are Aifert &amp; Hogan
        </h1>
        <p className="mt-3 text-sm text-sand/80">
          A private field journal. Enter the passphrase to unfold the map.
        </p>
        <label className="mt-8 block text-xs uppercase tracking-widest text-sand/60">
          Passphrase
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-sand/20 bg-ink/80 px-4 py-3 text-base text-paper outline-none ring-copper/40 focus:ring"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-copper" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 w-full rounded-xl bg-copper px-4 py-3 font-semibold text-ink disabled:opacity-50"
        >
          {busy ? "Unrolling…" : "Open the map"}
        </button>
      </form>
    </main>
  );
}
