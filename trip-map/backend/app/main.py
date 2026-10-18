"""FastAPI app: /api plus the Next.js static export."""

from __future__ import annotations

import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.auth import (
    check_password,
    clear_session,
    issue_session,
    read_session,
    require_session,
)
from app.db import close_pool, get_conn, init_schema
from app.photos import process_image
from app.seed import seed_if_empty

PERTH = ZoneInfo("Australia/Perth")
TRIP_START = datetime(2026, 11, 10, 0, 25, tzinfo=PERTH)
HOME_AFTER_ASIA = datetime(2026, 12, 22, 21, 25, tzinfo=PERTH)
VN_START = datetime(2027, 1, 9, 5, 15, tzinfo=PERTH)
TRIP_END = datetime(2027, 1, 23, 4, 30, tzinfo=PERTH)
MAX_UPLOAD = 15 * 1024 * 1024


def static_dir() -> Path:
    return Path(os.environ.get("STATIC_DIR", "/app/static"))


app = FastAPI(title="Where are Aifert & Hogan")


class LoginBody(BaseModel):
    password: str


class StopBody(BaseModel):
    slug: Optional[str] = None
    name: str
    city: str
    country: str
    country_code: str
    lat: float
    lng: float
    timezone: str
    arrive_at: datetime
    depart_at: datetime
    lodging_name: Optional[str] = None
    lodging_address: Optional[str] = None
    confirmation: Optional[str] = None
    lodging_notes: Optional[str] = None
    lodging_booked: bool = True
    sort_order: int = 0


class StopPatch(BaseModel):
    slug: Optional[str] = None
    name: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    timezone: Optional[str] = None
    arrive_at: Optional[datetime] = None
    depart_at: Optional[datetime] = None
    lodging_name: Optional[str] = None
    lodging_address: Optional[str] = None
    confirmation: Optional[str] = None
    lodging_notes: Optional[str] = None
    lodging_booked: Optional[bool] = None
    sort_order: Optional[int] = None


class LegBody(BaseModel):
    from_stop_id: Optional[int] = None
    to_stop_id: Optional[int] = None
    kind: str
    booked: bool = False
    carrier: Optional[str] = None
    flight_no: Optional[str] = None
    confirmation: Optional[str] = None
    depart_at: Optional[datetime] = None
    arrive_at: Optional[datetime] = None
    from_label: str
    to_label: str
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    notes: Optional[str] = None
    sort_order: int = 0


class LegPatch(BaseModel):
    from_stop_id: Optional[int] = None
    to_stop_id: Optional[int] = None
    kind: Optional[str] = None
    booked: Optional[bool] = None
    carrier: Optional[str] = None
    flight_no: Optional[str] = None
    confirmation: Optional[str] = None
    depart_at: Optional[datetime] = None
    arrive_at: Optional[datetime] = None
    from_label: Optional[str] = None
    to_label: Optional[str] = None
    from_lat: Optional[float] = None
    from_lng: Optional[float] = None
    to_lat: Optional[float] = None
    to_lng: Optional[float] = None
    notes: Optional[str] = None
    sort_order: Optional[int] = None


class ActivityBody(BaseModel):
    stop_id: int
    day: Optional[date] = None
    title: str
    notes: Optional[str] = None
    booked: bool = True
    optional: bool = False
    sort_order: int = 0


class ActivityPatch(BaseModel):
    stop_id: Optional[int] = None
    day: Optional[date] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    booked: Optional[bool] = None
    optional: Optional[bool] = None
    sort_order: Optional[int] = None


def _iso(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def _clean(row: Optional[dict]) -> Optional[dict]:
    if row is None:
        return None
    out = {}
    for key, value in row.items():
        if key in ("full_bytes", "thumb_bytes"):
            continue
        out[key] = _iso(value)
    return out


PUBLIC_PREFIXES = (
    "/api/health",
    "/api/login",
    "/login",
    "/_next/",
    "/favicon",
    "/robots.txt",
)


def _is_public(path: str) -> bool:
    if path in ("/login", "/login/"):
        return True
    return any(path == p or path.startswith(p) for p in PUBLIC_PREFIXES)


@app.middleware("http")
async def gate(request: Request, call_next):
    path = request.url.path
    if _is_public(path):
        return await call_next(request)
    if read_session(request):
        return await call_next(request)
    if path.startswith("/api/"):
        return JSONResponse({"detail": "login required"}, status_code=401)
    return RedirectResponse(url="/login/", status_code=302)


@app.on_event("startup")
def on_startup() -> None:
    if not os.environ.get("SESSION_SECRET"):
        raise RuntimeError("SESSION_SECRET is required")
    if not os.environ.get("APP_PASSWORD"):
        raise RuntimeError("APP_PASSWORD is required")
    init_schema()
    seed_if_empty()


@app.on_event("shutdown")
def on_shutdown() -> None:
    close_pool()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/login")
def login(body: LoginBody, response: Response) -> dict:
    if not check_password(body.password):
        raise HTTPException(status_code=401, detail="wrong password")
    issue_session(response)
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response) -> dict:
    clear_session(response)
    return {"ok": True}


@app.get("/api/me")
def me(_: None = Depends(require_session)) -> dict:
    return {"ok": True}


def _photo_meta(row: dict) -> dict:
    return {
        "id": row["id"],
        "stop_id": row["stop_id"],
        "caption": row["caption"],
        "created_at": _iso(row["created_at"]),
        "url": f"/api/photos/{row['id']}",
        "thumb_url": f"/api/photos/{row['id']}?size=thumb",
    }


@app.get("/api/trip")
def trip(_: None = Depends(require_session)) -> dict:
    with get_conn() as conn:
        stops = [_clean(r) for r in conn.execute(
            "SELECT * FROM stops ORDER BY sort_order, arrive_at"
        ).fetchall()]
        legs = [_clean(r) for r in conn.execute(
            "SELECT * FROM legs ORDER BY sort_order, depart_at"
        ).fetchall()]
        activities = [_clean(r) for r in conn.execute(
            "SELECT * FROM activities ORDER BY sort_order, id"
        ).fetchall()]
        photos = [
            _photo_meta(r)
            for r in conn.execute(
                """
                SELECT id, stop_id, caption, created_at
                FROM photos ORDER BY created_at
                """
            ).fetchall()
        ]
    return {
        "stops": stops,
        "legs": legs,
        "activities": activities,
        "photos": photos,
    }


def _parse_now(raw: Optional[str]) -> datetime:
    if not raw:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bad now") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _night_stop(stops: list[dict], when: datetime) -> Optional[dict]:
    matches = []
    for stop in stops:
        tz = ZoneInfo(stop["timezone"])
        arrive = stop["arrive_at"]
        depart = stop["depart_at"]
        if arrive <= when < depart:
            matches.append(stop)
            continue
        # Calendar-night rule when clocks are close to boundaries.
        local = when.astimezone(tz).date()
        arrive_d = arrive.astimezone(tz).date()
        depart_d = depart.astimezone(tz).date()
        if arrive_d <= local < depart_d:
            matches.append(stop)
    if not matches:
        return None
    matches.sort(key=lambda s: s["arrive_at"], reverse=True)
    return matches[0]


def _active_leg(legs: list[dict], when: datetime) -> Optional[dict]:
    for leg in legs:
        depart = leg.get("depart_at")
        arrive = leg.get("arrive_at")
        if depart and arrive and depart <= when < arrive:
            return leg
    return None


def _progress(when: datetime) -> float:
    total = (TRIP_END - TRIP_START).total_seconds()
    if when <= TRIP_START:
        return 0.0
    if when >= TRIP_END:
        return 1.0
    return max(0.0, min(1.0, (when - TRIP_START).total_seconds() / total))


@app.get("/api/today")
def today(
    now: Optional[str] = None,
    _: None = Depends(require_session),
) -> dict:
    when = _parse_now(now)
    with get_conn() as conn:
        stops = list(conn.execute(
            "SELECT * FROM stops ORDER BY sort_order, arrive_at"
        ).fetchall())
        legs = list(conn.execute(
            "SELECT * FROM legs ORDER BY sort_order, depart_at"
        ).fetchall())
    if when < TRIP_START:
        delta = int((TRIP_START - when).total_seconds())
        return {
            "phase": "countdown",
            "label": "Not yet departed",
            "sublabel": "Wheels up from Perth · 10 Nov 2026 00:25",
            "countdown_seconds": delta,
            "target": TRIP_START.isoformat(),
            "stop": None,
            "leg": None,
            "progress": _progress(when),
            "now": when.isoformat(),
        }
    if when >= TRIP_END:
        return {
            "phase": "back_home",
            "label": "Back home",
            "sublabel": "Perth · trip complete",
            "countdown_seconds": 0,
            "target": None,
            "stop": None,
            "leg": None,
            "progress": 1.0,
            "now": when.isoformat(),
        }
    if HOME_AFTER_ASIA <= when < VN_START:
        delta = int((VN_START - when).total_seconds())
        return {
            "phase": "home_break",
            "label": "Back home",
            "sublabel": "Perth · Vietnam departs 9 Jan 2027 05:15",
            "countdown_seconds": delta,
            "target": VN_START.isoformat(),
            "stop": None,
            "leg": None,
            "progress": _progress(when),
            "now": when.isoformat(),
        }
    leg = _active_leg(legs, when)
    stop = _night_stop(stops, when)
    if leg and (not stop or (leg["depart_at"] and when < (
        stop["arrive_at"] if stop else when
    ))):
        return {
            "phase": "in_transit",
            "label": f"{leg['from_label']} → {leg['to_label']}",
            "sublabel": " ".join(
                x for x in (leg.get("carrier"), leg.get("flight_no")) if x
            ) or "On the move",
            "countdown_seconds": 0,
            "target": None,
            "stop": _clean(stop),
            "leg": _clean(leg),
            "progress": _progress(when),
            "now": when.isoformat(),
        }
    if stop:
        tz = ZoneInfo(stop["timezone"])
        local = when.astimezone(tz)
        arrive_d = stop["arrive_at"].astimezone(tz).date()
        depart_d = stop["depart_at"].astimezone(tz).date()
        nights = max(1, (depart_d - arrive_d).days)
        day_n = min(nights, max(1, (local.date() - arrive_d).days + 1))
        return {
            "phase": "on_trip",
            "label": stop["name"],
            "sublabel": (
                f"Day {day_n} of {nights} · {stop['city']}, {stop['country']}"
            ),
            "countdown_seconds": 0,
            "target": None,
            "stop": _clean(stop),
            "leg": _clean(leg),
            "progress": _progress(when),
            "now": when.isoformat(),
        }
    return {
        "phase": "in_transit",
        "label": "Between stays",
        "sublabel": "Check the timeline",
        "countdown_seconds": 0,
        "target": None,
        "stop": None,
        "leg": _clean(leg),
        "progress": _progress(when),
        "now": when.isoformat(),
    }


@app.get("/api/photos/{photo_id}")
def get_photo(
    photo_id: int,
    size: str = "full",
    _: None = Depends(require_session),
):
    want_thumb = size == "thumb"
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT thumb_bytes, full_bytes, content_type
            FROM photos WHERE id = %s
            """,
            (photo_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    payload = row["thumb_bytes"] if want_thumb else row["full_bytes"]
    return Response(content=bytes(payload), media_type=row["content_type"])


@app.post("/api/photos")
async def upload_photo(
    stop_id: int = Form(...),
    caption: Optional[str] = Form(None),
    file: UploadFile = File(...),
    _: None = Depends(require_session),
) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="file too large")
    try:
        full_b, thumb_b, width, height = process_image(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="not an image") from exc
    with get_conn() as conn:
        stop = conn.execute(
            "SELECT id FROM stops WHERE id = %s", (stop_id,)
        ).fetchone()
        if not stop:
            raise HTTPException(status_code=404, detail="stop not found")
        row = conn.execute(
            """
            INSERT INTO photos (
                stop_id, caption, content_type, full_bytes, thumb_bytes,
                width, height
            ) VALUES (%s, %s, 'image/jpeg', %s, %s, %s, %s)
            RETURNING id, stop_id, caption, created_at
            """,
            (stop_id, caption, full_b, thumb_b, width, height),
        ).fetchone()
    return _photo_meta(row)


@app.delete("/api/photos/{photo_id}")
def delete_photo(
    photo_id: int,
    _: None = Depends(require_session),
) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM photos WHERE id = %s RETURNING id",
            (photo_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


def _insert_stop(body: StopBody) -> dict:
    payload = body.model_dump()
    if not payload.get("slug"):
        payload["slug"] = payload["name"].lower().replace(" ", "-")[:48]
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO stops (
                slug, name, city, country, country_code, lat, lng, timezone,
                arrive_at, depart_at, lodging_name, lodging_address,
                confirmation, lodging_notes, lodging_booked, sort_order
            ) VALUES (
                %(slug)s, %(name)s, %(city)s, %(country)s, %(country_code)s,
                %(lat)s, %(lng)s, %(timezone)s, %(arrive_at)s, %(depart_at)s,
                %(lodging_name)s, %(lodging_address)s, %(confirmation)s,
                %(lodging_notes)s, %(lodging_booked)s, %(sort_order)s
            )
            RETURNING *
            """,
            payload,
        ).fetchone()
    return _clean(row)


@app.post("/api/stops")
def create_stop(body: StopBody, _: None = Depends(require_session)) -> dict:
    return _insert_stop(body)


@app.patch("/api/stops/{stop_id}")
def patch_stop(
    stop_id: int,
    body: StopPatch,
    _: None = Depends(require_session),
) -> dict:
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="empty patch")
    sets = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [stop_id]
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE stops SET {sets} WHERE id = %s RETURNING *",
            values,
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return _clean(row)


@app.delete("/api/stops/{stop_id}")
def delete_stop(stop_id: int, _: None = Depends(require_session)) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM stops WHERE id = %s RETURNING id",
            (stop_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.post("/api/legs")
def create_leg(body: LegBody, _: None = Depends(require_session)) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO legs (
                from_stop_id, to_stop_id, kind, booked, carrier, flight_no,
                confirmation, depart_at, arrive_at, from_label, to_label,
                from_lat, from_lng, to_lat, to_lng, notes, sort_order
            ) VALUES (
                %(from_stop_id)s, %(to_stop_id)s, %(kind)s, %(booked)s,
                %(carrier)s, %(flight_no)s, %(confirmation)s, %(depart_at)s,
                %(arrive_at)s, %(from_label)s, %(to_label)s, %(from_lat)s,
                %(from_lng)s, %(to_lat)s, %(to_lng)s, %(notes)s, %(sort_order)s
            )
            RETURNING *
            """,
            body.model_dump(),
        ).fetchone()
    return _clean(row)


@app.patch("/api/legs/{leg_id}")
def patch_leg(
    leg_id: int,
    body: LegPatch,
    _: None = Depends(require_session),
) -> dict:
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="empty patch")
    sets = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [leg_id]
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE legs SET {sets} WHERE id = %s RETURNING *",
            values,
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return _clean(row)


@app.delete("/api/legs/{leg_id}")
def delete_leg(leg_id: int, _: None = Depends(require_session)) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM legs WHERE id = %s RETURNING id",
            (leg_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


@app.post("/api/activities")
def create_activity(
    body: ActivityBody,
    _: None = Depends(require_session),
) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO activities (
                stop_id, day, title, notes, booked, optional, sort_order
            ) VALUES (
                %(stop_id)s, %(day)s, %(title)s, %(notes)s, %(booked)s,
                %(optional)s, %(sort_order)s
            )
            RETURNING *
            """,
            body.model_dump(),
        ).fetchone()
    return _clean(row)


@app.patch("/api/activities/{activity_id}")
def patch_activity(
    activity_id: int,
    body: ActivityPatch,
    _: None = Depends(require_session),
) -> dict:
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="empty patch")
    sets = ", ".join(f"{k} = %s" for k in fields)
    values = list(fields.values()) + [activity_id]
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE activities SET {sets} WHERE id = %s RETURNING *",
            values,
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return _clean(row)


@app.delete("/api/activities/{activity_id}")
def delete_activity(
    activity_id: int,
    _: None = Depends(require_session),
) -> dict:
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM activities WHERE id = %s RETURNING id",
            (activity_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return {"ok": True}


def _static_page(*parts: str) -> FileResponse:
    path = static_dir().joinpath(*parts)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="frontend not built")
    return FileResponse(path)


@app.get("/login")
@app.get("/login/")
def login_page() -> FileResponse:
    return _static_page("login", "index.html")


@app.get("/admin")
@app.get("/admin/")
def admin_page() -> FileResponse:
    return _static_page("admin", "index.html")


@app.get("/")
def index_page() -> FileResponse:
    return _static_page("index.html")


_static = static_dir()
if _static.is_dir():
    app.mount("/", StaticFiles(directory=str(_static), html=True), name="static")
