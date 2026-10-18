export type Stop = {
  id: number;
  slug: string;
  name: string;
  city: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  timezone: string;
  arrive_at: string;
  depart_at: string;
  lodging_name: string | null;
  lodging_address: string | null;
  confirmation: string | null;
  lodging_notes: string | null;
  lodging_booked: boolean;
  sort_order: number;
};

export type Leg = {
  id: number;
  from_stop_id: number | null;
  to_stop_id: number | null;
  kind: string;
  booked: boolean;
  carrier: string | null;
  flight_no: string | null;
  confirmation: string | null;
  depart_at: string | null;
  arrive_at: string | null;
  from_label: string;
  to_label: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  notes: string | null;
  sort_order: number;
};

export type Activity = {
  id: number;
  stop_id: number;
  day: string | null;
  title: string;
  notes: string | null;
  booked: boolean;
  optional: boolean;
  sort_order: number;
};

export type Photo = {
  id: number;
  stop_id: number;
  caption: string | null;
  created_at: string;
  url: string;
  thumb_url: string;
};

export type Trip = {
  stops: Stop[];
  legs: Leg[];
  activities: Activity[];
  photos: Photo[];
};

export type Today = {
  phase: "countdown" | "on_trip" | "in_transit" | "home_break" | "back_home";
  label: string;
  sublabel: string;
  countdown_seconds: number;
  target: string | null;
  stop: Stop | null;
  leg: Leg | null;
  progress: number;
  now: string;
};

export const COUNTRY_COLORS: Record<string, string> = {
  JP: "#c23b22",
  TW: "#1a7a6d",
  CN: "#c9a227",
  VN: "#2d6a4f",
  AU: "#1d4e89",
};
