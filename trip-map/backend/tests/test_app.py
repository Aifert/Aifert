"""Login gate, seed, and photo lifecycle against Postgres."""

from __future__ import annotations

import io
import os

import pytest
from fastapi.testclient import TestClient
from PIL import Image

os.environ.setdefault("APP_PASSWORD", "CONQUERTHEWORLD")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-please-change")

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL is required")
    with TestClient(app) as test_client:
        yield test_client


def test_health_open(client: TestClient) -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_api_requires_cookie(client: TestClient) -> None:
    client.cookies.clear()
    res = client.get("/api/trip")
    assert res.status_code == 401


def test_wrong_password(client: TestClient) -> None:
    client.cookies.clear()
    res = client.post("/api/login", json={"password": "nope"})
    assert res.status_code == 401
    assert "trip_session" not in res.cookies


def test_login_seed_photos(client: TestClient) -> None:
    bad = client.post("/api/login", json={"password": "wrong"})
    assert bad.status_code == 401

    ok = client.post("/api/login", json={"password": "CONQUERTHEWORLD"})
    assert ok.status_code == 200
    assert ok.cookies.get("trip_session")

    trip = client.get("/api/trip")
    assert trip.status_code == 200
    data = trip.json()
    slugs = {s["slug"] for s in data["stops"]}
    expected = {
        "tokyo",
        "hakone",
        "kyoto",
        "osaka",
        "taipei",
        "beijing",
        "zhangjiajie",
        "wulingyuan",
        "furong",
        "fenghuang",
        "harbin",
        "yabuli",
        "xuexiang",
        "tbd-dec",
        "shanghai",
        "hanoi",
    }
    assert expected <= slugs
    assert len(data["legs"]) >= 18
    assert any(leg["flight_no"] == "CX140" for leg in data["legs"])
    assert any(leg["flight_no"] == "MM25" for leg in data["legs"])
    assert any(not leg["booked"] for leg in data["legs"])

    tokyo = next(s for s in data["stops"] if s["slug"] == "tokyo")
    img = Image.new("RGB", (2000, 800), (200, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    upload = client.post(
        "/api/photos",
        data={"stop_id": tokyo["id"], "caption": "test shot"},
        files={"file": ("test.png", buf.getvalue(), "image/png")},
    )
    assert upload.status_code == 200
    photo = upload.json()
    assert photo["caption"] == "test shot"

    full = client.get(photo["url"])
    assert full.status_code == 200
    assert full.headers["content-type"] == "image/jpeg"
    fetched = Image.open(io.BytesIO(full.content))
    assert max(fetched.size) <= 1600

    thumb = client.get(photo["thumb_url"])
    assert thumb.status_code == 200
    th = Image.open(io.BytesIO(thumb.content))
    assert max(th.size) <= 400

    gone = client.delete(f"/api/photos/{photo['id']}")
    assert gone.status_code == 200
    assert client.get(photo["url"]).status_code == 404


def test_today_countdown(client: TestClient) -> None:
    client.post("/api/login", json={"password": "CONQUERTHEWORLD"})
    res = client.get("/api/today?now=2026-10-01T00:00:00+08:00")
    assert res.status_code == 200
    body = res.json()
    assert body["phase"] == "countdown"
    assert body["countdown_seconds"] > 0
