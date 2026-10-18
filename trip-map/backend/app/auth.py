"""Signed httpOnly session cookie (30 days)."""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Optional

from fastapi import HTTPException, Request, Response

COOKIE_NAME = "trip_session"
TTL_SECONDS = 30 * 24 * 60 * 60
_SIG_LEN = 32  # hex-encoded sha256 truncated


def _secret() -> bytes:
    secret = os.environ.get("SESSION_SECRET", "")
    if not secret:
        raise RuntimeError("SESSION_SECRET is required")
    return secret.encode()


def _sign(payload: str) -> str:
    digest = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return digest[:_SIG_LEN]


def issue_session(response: Response) -> None:
    expiry = int(time.time()) + TTL_SECONDS
    payload = str(expiry)
    value = f"{payload}.{_sign(payload)}"
    secure = os.environ.get("RENDER") == "true"
    response.set_cookie(
        COOKIE_NAME,
        value,
        max_age=TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def read_session(request: Request) -> bool:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw or "." not in raw:
        return False
    payload, sig = raw.rsplit(".", 1)
    if not hmac.compare_digest(sig, _sign(payload)):
        return False
    try:
        expiry = int(payload)
    except ValueError:
        return False
    return expiry >= int(time.time())


def require_session(request: Request) -> None:
    if not read_session(request):
        raise HTTPException(status_code=401, detail="login required")


def check_password(password: Optional[str]) -> bool:
    expected = os.environ.get("APP_PASSWORD", "")
    if not expected or password is None:
        return False
    return hmac.compare_digest(password.encode(), expected.encode())
