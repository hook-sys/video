#!/usr/bin/env python3
# Empty frames of a studio video (rule "no-empty-cut" in
# components/video/clean/rules.ts): a frame is empty when it differs from the
# same frame of the background alone (StudioFilm `bare`) by less than EMPTY
# (mean absolute difference at 192×108, 0–255). The rule allows no run of
# more than LIMIT empty frames.
#
#   python3 scripts/clean-check/empty-frames.py full.mp4 bare.mp4 [full2.mp4 bare2.mp4 …]
#
# Uses Remotion's bundled ffmpeg; needs numpy and Pillow. Exits 1 when a video
# has a longer run.
import glob, os, shutil, subprocess, sys, tempfile

import numpy as np
from PIL import Image

EMPTY = 4.0
LIMIT = 6
FF = "node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"


def frames(path):
    d = tempfile.mkdtemp()
    subprocess.run([FF, "-loglevel", "error", "-i", path, "-s", "192x108", f"{d}/f_%05d.png"], check=True)
    out = [np.asarray(Image.open(f).convert("L"), dtype=np.float32) for f in sorted(glob.glob(f"{d}/f_*.png"))]
    shutil.rmtree(d)
    return out


def runs(full, bare):
    a, b = frames(full), frames(bare)
    n = min(len(a), len(b))
    diff = [float(np.abs(a[i] - b[i]).mean()) for i in range(n)]
    found, start = [], None
    for i, v in enumerate(diff + [99]):
        if v < EMPTY and start is None:
            start = i
        elif v >= EMPTY and start is not None:
            found.append((start, i - start))
            start = None
    return found


bad = False
args = sys.argv[1:]
for full, bare in zip(args[::2], args[1::2]):
    r = sorted(runs(full, bare), key=lambda x: -x[1])
    worst = r[0][1] if r else 0
    ok = worst <= LIMIT
    bad |= not ok
    print(f"{'ok  ' if ok else 'FAIL'} {os.path.basename(full)}: longest empty run {worst} frames (limit {LIMIT}); runs {[(s, n) for s, n in r[:5]]}")
sys.exit(1 if bad else 0)
