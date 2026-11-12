#!/usr/bin/env python3
"""Recompute activity pause times after a module video is rebuilt.

    python3 tools/retime.py activities/MOS-220.times.json SC-M5 ../live/<pkg>/media/SC-M5.vtt SC-M5-01 SC-M5-02 ...

A pause sits at the end of its segment's last caption cue. Segments are
found in the captions where one cue ends more than 0.05 s before the next
starts (the gap assemble_video.py puts between segments). Give the
video's segment ids in order; every entry in the times file for that video
is moved to the end of its segment, and the file is rewritten.
"""
import json
import re
import sys


def secs(t):
    h, m, s = t.replace(",", ".").split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def segment_ends(vtt):
    cues = [(secs(a), secs(b)) for a, b in re.findall(
        r"(\d+:\d\d:\d\d[.,]\d+)\s*-->\s*(\d+:\d\d:\d\d[.,]\d+)", open(vtt, encoding="utf-8").read())]
    groups = []
    for a, b in cues:
        if groups and a - groups[-1][1] <= 0.05:
            groups[-1][1] = b
        else:
            groups.append([a, b])
    return [b for _, b in groups]


def main():
    times_file, video, vtt, *ids = sys.argv[1:]
    ends = segment_ends(vtt)
    if len(ends) != len(ids):
        sys.exit(f"{len(ends)} caption groups but {len(ids)} segment ids given")
    times = json.load(open(times_file, encoding="utf-8"))
    moved = 0
    for key, entry in times.items():
        if entry["video"] != video:
            continue
        seg = key if key in ids else None
        if seg is None:
            sys.exit(f"{key} is not one of the segment ids given")
        t = round(ends[ids.index(seg)], 2)
        if t != entry["t"]:
            print(f"{key}: {entry['t']} -> {t}")
            entry["t"] = t
            moved += 1
    with open(times_file, "w", encoding="utf-8") as f:
        json.dump(times, f, indent=1, ensure_ascii=False)
    print(f"{video}: {moved} pause(s) moved")


if __name__ == "__main__":
    main()
