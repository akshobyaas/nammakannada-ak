"""Generate natural Kannada audio for every word with Sarvam AI (Bulbul).

Run from the project folder:
    python scripts/generate-voice.py

It asks for your Sarvam API key (or reads SARVAM_API_KEY), saves clips to
audio/ai/, and records them in data/dialects.json under "voice". The site then
plays these clips (after any real recordings, before dictionary or browser voices).

Uses only the Python standard library, so no pip install is needed.
Get a key: sign up at https://dashboard.sarvam.ai and create an API key.

Options:
    --speaker NAME   Bulbul v3 voice (default: kavitha). Others: roopa, shruti,
                     anand, aditya, vijay, ...
    --pace N         0.5 to 2.0 (default 0.9, a little slower for learners)
    --limit N        only do the first N clips (try --limit 2 first)
    --force          regenerate clips that already exist
"""
import argparse
import base64
import getpass
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API_URL = os.environ.get("SARVAM_URL", "https://api.sarvam.ai/text-to-speech")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data", "dialects.json")
OUT_DIR = os.path.join(ROOT, "audio", "ai")


def speakable(kn):
    """'ಎಂತ / ಎಂತದು' -> 'ಎಂತ, ಎಂತದು' so variants are read with a short pause."""
    return re.sub(r"\s*[/;]\s*", ", ", kn.strip())


def synth(key, text, speaker, pace):
    body = json.dumps({
        "text": text,
        "language_code": "kn-IN",
        "model": "bulbul:v3",
        "speaker": speaker,
        "pace": pace,
        "output_audio_codec": "mp3",
    }).encode("utf-8")
    req = urllib.request.Request(API_URL, data=body, method="POST", headers={
        "api-subscription-key": key,
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=60) as res:
        data = json.loads(res.read().decode("utf-8"))
    audio = base64.b64decode(data["audios"][0])
    ext = "wav" if audio[:4] == b"RIFF" else "mp3"
    return audio, ext


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--speaker", default="kavitha")
    ap.add_argument("--pace", type=float, default=0.9)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    key = os.environ.get("SARVAM_API_KEY") or getpass.getpass("Sarvam API key (input hidden): ").strip()
    if not key:
        sys.exit("No API key given. Set SARVAM_API_KEY or paste it when asked.")

    with open(DATA, encoding="utf-8") as f:
        data = json.load(f)
    os.makedirs(OUT_DIR, exist_ok=True)

    jobs = []
    for e in data["entries"]:
        for side in ("dialect", "standard"):
            kn = (e.get(side) or {}).get("kn")
            if kn:
                jobs.append((e, side, speakable(kn)))
    if args.limit:
        jobs = jobs[: args.limit]

    made = skipped = failed = 0
    for i, (e, side, text) in enumerate(jobs, 1):
        stem = f"{e['id']}-{side}"
        existing = [x for x in os.listdir(OUT_DIR) if x.startswith(stem + ".")]
        if existing and not args.force:
            e.setdefault("voice", {})[side] = f"audio/ai/{existing[0]}"
            skipped += 1
            continue
        try:
            audio, ext = synth(key, text, args.speaker, args.pace)
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:300]
            if err.code in (401, 403):
                sys.exit(f"The API key was rejected ({err.code}). Check it on dashboard.sarvam.ai.\n{detail}")
            print(f"[{i}/{len(jobs)}] {stem}: failed with HTTP {err.code}: {detail}")
            failed += 1
            if err.code == 429:
                time.sleep(5)
            continue
        except urllib.error.URLError as err:
            sys.exit(f"Could not reach Sarvam ({err.reason}). Check your internet connection.")
        name = f"{stem}.{ext}"
        with open(os.path.join(OUT_DIR, name), "wb") as f:
            f.write(audio)
        e.setdefault("voice", {})[side] = f"audio/ai/{name}"
        made += 1
        print(f"[{i}/{len(jobs)}] {stem}: {text}")
        time.sleep(0.3)  # stay well under rate limits

    data["sources"]["sarvam_voice"] = "https://www.sarvam.ai/text-to-speech"
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"\nDone. {made} new clips, {skipped} already there, {failed} failed.")
    if made or skipped:
        print("Reload the site: words now play the Sarvam voice.")


if __name__ == "__main__":
    main()
