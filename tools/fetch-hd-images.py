#!/usr/bin/env python3
"""Download high-resolution character art from each series' Fandom wiki.

    python3 tools/fetch-hd-images.py               # every character without an HD image yet
    python3 tools/fetch-hd-images.py --force       # redo all
    python3 tools/fetch-hd-images.py gojo madara   # only these ids (always redone)

Saves images/<id>.webp (max 1100px tall), which the game prefers over the
smaller AniList images. Needs Pillow (pip install pillow).

By default it takes the main image of the character's wiki page. If that image
is a bad fit (a childhood version, a manga panel...), set `wikiImage` on the
character in js/characters.js to a file name from that wiki, e.g.
wikiImage: "Madara_Uchiha_Anime.png".
"""
import io
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
MAX_H = 1100

WIKIS = {
    "Dragon Ball Super": "dragonball.fandom.com",
    "One Punch Man": "onepunchman.fandom.com",
    "One Piece": "onepiece.fandom.com",
    "Naruto": "naruto.fandom.com",
    "Jujutsu Kaisen": "jujutsu-kaisen.fandom.com",
    "Bleach": "bleach.fandom.com",
    "My Hero Academia": "myheroacademia.fandom.com",
    "Attack on Titan": "attackontitan.fandom.com",
    "Hunter x Hunter": "hunterxhunter.fandom.com",
    "Demon Slayer": "kimetsu-no-yaiba.fandom.com",
    "Death Note": "deathnote.fandom.com",
    "Mob Psycho 100": "mob-psycho-100.fandom.com",
    "Classroom of the Elite": "you-zitsu.fandom.com",
    "Code Geass": "codegeass.fandom.com",
    "Dr. Stone": "dr-stone.fandom.com",
    "Umineko When They Cry": "07th-expansion.fandom.com",
    "That Time I Got Reincarnated as a Slime": "tensura.fandom.com",
    "Solo Leveling": "solo-leveling.fandom.com",
    "The Misfit of Demon King Academy": "maou-gakuin.fandom.com",
    "Overlord": "overlordmaruyama.fandom.com",
    "The Seven Deadly Sins": "nanatsu-no-taizai.fandom.com",
    "Fate": "typemoon.fandom.com",
    "Hellsing": "hellsing.fandom.com",
    "A Certain Magical Index": "toarumajutsunoindex.fandom.com",
    "Black Clover": "blackclover.fandom.com",
    "Chainsaw Man": "chainsaw-man.fandom.com",
    "Monster": "monster.fandom.com",
    "Neon Genesis Evangelion": "evangelion.fandom.com",
    "Sword Art Online": "swordartonline.fandom.com",
    "JoJo's Bizarre Adventure": "jojo.fandom.com",
    "Fairy Tail": "fairytail.fandom.com",
    "Darling in the Franxx": "darling-in-the-franxx.fandom.com",
    "My Dress-Up Darling": "sono-bisque-doll-wa-koi-wo-suru.fandom.com",
    "Spy x Family": "spy-x-family.fandom.com",
    "Re:Zero": "rezero.fandom.com",
    "Akame ga Kill!": "akamegakill.fandom.com",
    "Frieren": "frieren.fandom.com",
}


def load_roster():
    js = "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.CHARACTERS))"
    out = subprocess.check_output(["node", "-e", js, str(ROOT / "js/characters.js")])
    return json.loads(out)


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "anime-draft-image-fetcher/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def image_url(c):
    host = WIKIS[c["series"]]
    api = f"https://{host}/api.php?format=json&action=query&redirects=1"
    if c.get("wikiImage"):
        title = "File:" + c["wikiImage"]
        data = get_json(f"{api}&prop=imageinfo&iiprop=url&iiurlheight={MAX_H}&titles={urllib.parse.quote(title)}")
        page = next(iter(data["query"]["pages"].values()))
        info = (page.get("imageinfo") or [{}])[0]
        return info.get("thumburl") or info.get("url"), title
    title = c.get("wiki") or c.get("search") or c["name"]
    data = get_json(f"{api}&prop=pageimages&pithumbsize=1400&titles={urllib.parse.quote(title)}")
    page = next(iter(data["query"]["pages"].values()))
    thumb = page.get("thumbnail")
    return (thumb["source"] if thumb else None), page.get("title", title)


def save(c, url):
    req = urllib.request.Request(url, headers={"User-Agent": "anime-draft-image-fetcher/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        im = Image.open(io.BytesIO(r.read()))
    im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
    if im.height > MAX_H:
        im = im.resize((round(im.width * MAX_H / im.height), MAX_H), Image.LANCZOS)
    out = IMAGES / f"{c['id']}.webp"
    im.save(out, "WEBP", quality=82, method=6)
    return out, im.size


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    IMAGES.mkdir(exist_ok=True)
    for c in load_roster():
        if args and c["id"] not in args:
            continue
        if c.get("noHd"):
            continue
        if not args and not force and (IMAGES / f"{c['id']}.webp").exists():
            continue
        try:
            url, title = image_url(c)
            if not url:
                print(f"✗ {c['id']}: no image on '{title}'")
                continue
            out, size = save(c, url)
            print(f"✓ {c['id']:10} {size[0]}x{size[1]}  {title}  ({out.stat().st_size // 1024} KB)")
        except Exception as e:  # keep going; the game falls back to the AniList image
            print(f"✗ {c['id']}: {e}")
        time.sleep(0.3)


if __name__ == "__main__":
    main()
