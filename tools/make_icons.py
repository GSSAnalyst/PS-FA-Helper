#!/usr/bin/env python3
"""Draws the extension icons (icons/icon-{16,32,48,128}.png) with no dependencies.

The icon is an open book (the PeopleBook) on the panel's bay-blue, with a gold
bookmark. Shapes are defined on a 128x128 grid and supersampled for smooth edges.

Usage: python3 tools/make_icons.py
"""
import os, struct, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "icons")

BAY = (13, 79, 122)
WHITE = (255, 255, 255)
GOLD = (233, 169, 8)
SPINE = (198, 214, 228)


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_bookmark(x, y):
    # Ribbon hanging from the top of the right page, with a V notch at the bottom.
    x0, x1, y0, y1 = 82, 94, 30, 62
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    notch = (y1 - y) < 7 - abs(x - (x0 + x1) / 2) * 7 / ((x1 - x0) / 2)
    return not notch


def color_at(x, y):
    """Colour of the 128-grid point (x, y), or None for transparent."""
    if not in_round_rect(x, y, 4, 4, 124, 124, 26):
        return None
    if in_bookmark(x, y):
        return GOLD
    # Pages tilt down toward the spine, like an open book seen from above.
    left = in_round_rect(x, y - (x - 26) * 0.08, 24, 36, 62, 94, 5)
    right = in_round_rect(x, y - (102 - x) * 0.08, 66, 36, 104, 94, 5)
    if left or right:
        return WHITE
    if 61 <= x <= 67 and 40 <= y <= 98:
        return SPINE
    return BAY


def render(size, ss=4):
    rows = []
    step = 128 / (size * ss)
    for py in range(size):
        row = bytearray([0])  # PNG filter: none
        for px in range(size):
            r = g = b = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((px * ss + sx + 0.5) * step, (py * ss + sy + 0.5) * step)
                    if c:
                        r += c[0]; g += c[1]; b += c[2]; a += 1
            n = ss * ss
            if a:
                row += bytes([r // a, g // a, b // a, round(255 * a / n)])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    return png(size, size, b"".join(rows))


def png(w, h, raw):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        with open(path, "wb") as f:
            f.write(render(size))
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
