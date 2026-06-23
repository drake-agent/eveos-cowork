#!/usr/bin/env python3

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "resources"
ICONSET = RESOURCES / "icon.iconset"

CREAM = (255, 248, 243, 255)
IVORY = (255, 253, 249, 255)
ROSE = (212, 113, 122, 255)
ROSE_DEEP = (185, 78, 88, 255)
CHARCOAL = (43, 43, 43, 255)
BLUSH = (245, 221, 214, 255)
TRANSPARENT = (0, 0, 0, 0)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_zero_ring(size: int, color: tuple[int, int, int, int], width: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(layer)
    draw.ellipse(
        (size * 0.20, size * 0.30, size * 0.80, size * 0.70),
        outline=color,
        width=width,
    )
    return layer.rotate(-11, resample=Image.Resampling.BICUBIC, center=(size / 2, size / 2))


def draw_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(image)

    pad = int(size * 0.066)
    radius = int(size * 0.215)
    draw.rounded_rectangle(
        (pad, pad, size - pad, size - pad),
        radius=radius,
        fill=CREAM,
        outline=ROSE,
        width=max(2, int(size * 0.018)),
    )

    inner_pad = int(size * 0.145)
    draw.rounded_rectangle(
        (inner_pad, inner_pad, size - inner_pad, size - inner_pad),
        radius=int(size * 0.145),
        outline=BLUSH,
        width=max(1, int(size * 0.008)),
    )

    ring_width = max(2, int(size * 0.034))
    image.alpha_composite(draw_zero_ring(size, ROSE, ring_width))
    image.alpha_composite(draw_zero_ring(size, ROSE_DEEP, max(1, ring_width // 3)))

    mark_font = font(int(size * 0.47))
    bbox = draw.textbbox((0, 0), "B", font=mark_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        ((size - text_w) / 2 - bbox[0], (size - text_h) / 2 - bbox[1] - size * 0.015),
        "B",
        font=mark_font,
        fill=CHARCOAL,
    )

    dot = int(size * 0.055)
    dot_center = (int(size * 0.70), int(size * 0.28))
    draw.ellipse(
        (
            dot_center[0] - dot,
            dot_center[1] - dot,
            dot_center[0] + dot,
            dot_center[1] + dot,
        ),
        fill=ROSE,
    )
    draw.ellipse(
        (
            dot_center[0] - dot // 3,
            dot_center[1] - dot // 3,
            dot_center[0] + dot // 3,
            dot_center[1] + dot // 3,
        ),
        fill=IVORY,
    )

    return image


def draw_tray(size: int, color: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(image)
    draw.ellipse(
        (size * 0.16, size * 0.28, size * 0.84, size * 0.72),
        outline=color,
        width=max(2, size // 12),
    )
    mark_font = font(int(size * 0.56))
    bbox = draw.textbbox((0, 0), "B", font=mark_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        ((size - text_w) / 2 - bbox[0], (size - text_h) / 2 - bbox[1] - size * 0.02),
        "B",
        font=mark_font,
        fill=color,
    )
    return image


def save_png(path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    draw_icon(size).save(path)


def main() -> None:
    RESOURCES.mkdir(parents=True, exist_ok=True)
    ICONSET.mkdir(parents=True, exist_ok=True)

    master = draw_icon(1024)
    master.save(RESOURCES / "icon.png")
    master.save(RESOURCES / "logo.png")
    master.resize((801, 801), Image.Resampling.LANCZOS).save(
        ROOT / "src" / "renderer" / "assets" / "logo.png"
    )
    master.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / "public" / "logo.png")
    master.resize((32, 32), Image.Resampling.LANCZOS).save(ROOT / "public" / "favicon.png")

    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(RESOURCES / "icon.ico", sizes=ico_sizes)

    iconset_sizes = {
        "icon_16x16.png": 16,
        "icon_16x16@2x.png": 32,
        "icon_32x32.png": 32,
        "icon_32x32@2x.png": 64,
        "icon_128x128.png": 128,
        "icon_128x128@2x.png": 256,
        "icon_256x256.png": 256,
        "icon_256x256@2x.png": 512,
        "icon_512x512.png": 512,
        "icon_512x512@2x.png": 1024,
    }
    for filename, size in iconset_sizes.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(ICONSET / filename)

    if shutil.which("iconutil"):
        subprocess.run(
            ["iconutil", "-c", "icns", str(ICONSET), "-o", str(RESOURCES / "icon.icns")],
            check=True,
        )

    draw_tray(32, ROSE_DEEP).save(RESOURCES / "tray-icon.png")
    draw_tray(32, (0, 0, 0, 255)).save(RESOURCES / "tray-iconTemplate.png")


if __name__ == "__main__":
    main()
