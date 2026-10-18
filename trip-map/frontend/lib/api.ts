import { Today, Trip } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401 && !path.startsWith("/api/login")) {
    if (typeof window !== "undefined") {
      window.location.href = "/login/";
    }
    throw new Error("login required");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => req<{ ok: boolean }>("/api/me"),
  login: (password: string) =>
    req<{ ok: boolean }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => req<{ ok: boolean }>("/api/logout", { method: "POST" }),
  trip: () => req<Trip>("/api/trip"),
  today: (now?: string) =>
    req<Today>(now ? `/api/today?now=${encodeURIComponent(now)}` : "/api/today"),
  uploadPhoto: (stopId: number, file: File, caption?: string) => {
    const data = new FormData();
    data.append("stop_id", String(stopId));
    data.append("file", file);
    if (caption) data.append("caption", caption);
    return req("/api/photos", { method: "POST", body: data });
  },
  deletePhoto: (id: number) =>
    req(`/api/photos/${id}`, { method: "DELETE" }),
  createStop: (body: unknown) =>
    req("/api/stops", { method: "POST", body: JSON.stringify(body) }),
  patchStop: (id: number, body: unknown) =>
    req(`/api/stops/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteStop: (id: number) =>
    req(`/api/stops/${id}`, { method: "DELETE" }),
  createLeg: (body: unknown) =>
    req("/api/legs", { method: "POST", body: JSON.stringify(body) }),
  patchLeg: (id: number, body: unknown) =>
    req(`/api/legs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteLeg: (id: number) => req(`/api/legs/${id}`, { method: "DELETE" }),
  createActivity: (body: unknown) =>
    req("/api/activities", { method: "POST", body: JSON.stringify(body) }),
  patchActivity: (id: number, body: unknown) =>
    req(`/api/activities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteActivity: (id: number) =>
    req(`/api/activities/${id}`, { method: "DELETE" }),
};
