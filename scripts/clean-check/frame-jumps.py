#!/usr/bin/env python3
# Frame-to-frame jumps of a rendered video (rule "frame-jump" in
# components/video/clean/rules.ts): the mean absolute change between two
# frames at 192×108 (0–255). A cut that drops a scene at once or a card that
# pops from nothing shows as a spike; the rule keeps every jump at or under 25.
#
#   python3 scripts/clean-check/frame-jumps.py video1.mp4 [video2.mp4 …]
#
# Uses Remotion's bundled ffmpeg; needs numpy and Pillow. Exits 1 when a video
# has a jump over the limit.
import glob, os, shutil, subprocess, sys, tempfile

import numpy as np
from PIL import Image

LIMIT = 25
FF = "node_modules/@remotion/compositor-linux-x64-gnu"


def jumps(path):
    tmp = tempfile.mkdtemp(dir="node_modules/.cache")
    try:
        subprocess.run([f"{FF}/ffmpeg", "-loglevel", "error", "-i", path, "-s", "192x108", f"{tmp}/%05d.png"], env={**os.environ, "LD_LIBRARY_PATH": FF}, check=True)
        frames = np.stack([np.asarray(Image.open(f).convert("RGB"), np.int16) for f in sorted(glob.glob(f"{tmp}/*.png"))])
    finally:
        shutil.rmtree(tmp)
    return np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2, 3))


failed = 0
for p in sys.argv[1:]:
    d = jumps(p)
    top = sorted(enumerate(d), key=lambda x: -x[1])[:5]
    ok = d.max() <= LIMIT
    failed += not ok
    print(f"{'ok  ' if ok else 'FAIL'} {p}: max {d.max():.1f} (limit {LIMIT}), top frames {[(i + 1, round(float(v), 1)) for i, v in top]}")
sys.exit(1 if failed else 0)
