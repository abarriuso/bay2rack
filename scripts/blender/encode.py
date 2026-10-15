"""Frames from hero.py -> the hero video for the site and the GIFs for the README.

  python scripts/blender/encode.py            final: docs/blender/frames -> docs/video/hero.{mp4,webm}, poster, GIFs
  python scripts/blender/encode.py --preview  docs/blender/preview -> docs/blender/preview.mp4

The look is finished here, like a colour pass on camera footage: bloom on the bright LEDs,
1 px of chromatic aberration, a soft vignette and a little temporal film grain.
"""
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
BL = os.path.join(REPO, "docs", "blender")
OUT = os.path.join(REPO, "docs", "video")
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FPS = 30

LOOK = ("split=2[b][h];[h]curves=all='0/0 0.72/0 1/1',gblur=sigma=12[g];"
        "[b][g]blend=all_mode=screen:all_opacity=0.5,rgbashift=rh=-1:bh=1,"
        "vignette=angle=PI/5,noise=alls=4:allf=t+u")


def run(*args):
    print(" ".join(args))
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def main():
    preview = "--preview" in sys.argv
    src = os.path.join(BL, "preview" if preview else "frames", "f_%04d.png")
    if preview:
        run("-framerate", str(FPS), "-i", src, "-vf", LOOK + ",format=yuv420p", "-c:v", "libx264", "-crf", "22",
            "-preset", "fast", os.path.join(BL, "preview.mp4"))
        return
    os.makedirs(OUT, exist_ok=True)
    fps = FPS
    frames = os.path.join(BL, "frames")
    if os.path.exists(os.path.join(frames, "h_0001.png")) and "--fps30" not in sys.argv:
        # 60 fps: interleave f_n and the in-between h_n (hero.py --between) into one numbered sequence
        seq = os.path.join(BL, "seq60")
        shutil.rmtree(seq, ignore_errors=True)
        os.makedirs(seq)
        n = 0
        for i in range(1, 10000):
            f = os.path.join(frames, f"f_{i:04d}.png")
            if not os.path.exists(f):
                break
            for p in (f, os.path.join(frames, f"h_{i:04d}.png")):
                if os.path.exists(p):
                    n += 1
                    os.link(p, os.path.join(seq, f"s_{n:05d}.png"))
        src, fps = os.path.join(seq, "s_%05d.png"), FPS * 2
    graded = os.path.join(BL, "graded.mov")
    # one graded master (lossless-ish), then every delivery format from it
    if "--gifs" not in sys.argv:
        run("-framerate", str(fps), "-i", src, "-vf", LOOK, "-c:v", "prores_ks", "-profile:v", "3", graded)
    run("-i", graded, "-vf", "scale=1600:-2,format=yuv420p", "-c:v", "libx264", "-crf", "21", "-preset", "slow",
        "-movflags", "+faststart", "-an", os.path.join(OUT, "hero.mp4"))
    run("-i", graded, "-vf", "scale=1600:-2,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34",
        "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-an", os.path.join(OUT, "hero.webm"))
    # poster = the last frame (the hero shot), also the og:image
    run("-sseof", "-0.05", "-i", graded, "-frames:v", "1", "-vf", "scale=1600:-2", os.path.join(OUT, "hero.webp"))
    run("-sseof", "-0.05", "-i", graded, "-frames:v", "1", "-vf", "scale=1600:-2", os.path.join(REPO, "docs", "img", "hero.png"))
    # README: the unfold + assembly, a short GIF with their own palette (a few MB each)
    for name, extra, width, fps in (("assemble.gif", ["-ss", "1.45", "-t", "4.6"], 560, 12),):
        pal = os.path.join(BL, "palette.png")
        run(*extra, "-i", graded, "-vf", f"fps={fps},scale={width}:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff", pal)
        run(*extra, "-i", graded, "-i", pal, "-lavfi",
            f"fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
            os.path.join(OUT, name))
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")


main()
