"""Resize uploads to ~1600px plus a thumbnail."""

from __future__ import annotations

import io

from PIL import Image, ImageOps

FULL_MAX = 1600
THUMB_MAX = 400
JPEG_QUALITY = 85


def _to_rgb(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        converted = image.convert("RGBA")
        background.paste(converted, mask=converted.split()[-1])
        return background
    return image.convert("RGB")


def process_image(data: bytes) -> tuple[bytes, bytes, int, int]:
    with Image.open(io.BytesIO(data)) as raw:
        image = _to_rgb(raw)
        image.thumbnail((FULL_MAX, FULL_MAX), Image.Resampling.LANCZOS)
        width, height = image.size
        full_buf = io.BytesIO()
        image.save(full_buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        thumb = image.copy()
        thumb.thumbnail((THUMB_MAX, THUMB_MAX), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb.save(thumb_buf, format="JPEG", quality=80, optimize=True)
    return full_buf.getvalue(), thumb_buf.getvalue(), width, height
