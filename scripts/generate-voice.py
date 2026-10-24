"""Generate natural Kannada audio for every word with Sarvam AI (Bulbul).

Run from the project folder:
    python scripts/generate-voice.py

Reads SARVAM_API_KEY from .env, saves clips to audio/ai/, and records them in
data/dialects.json under "voice". The site plays these clips after any real
recordings and before dictionary or browser voices.

Options:
    --speaker NAME   default chaitra_kn_conversation. Other native Kannada voices:
                     chaitra_kn_narration, chetan_kn_conversation, suchitra_kn_narration
    --model NAME     default bulbul:v4-flash
    --pace N         0.5 to 2.0 (default 0.9, a little slower for learners)
    --limit N        only do the first N clips (try --limit 4 first)
    --force          regenerate clips that already exist
"""
import argparse
import base64
import json
import os
import pathlib
import re
import time

from sarvamai import SarvamAI
from sarvamai.core.api_error import ApiError

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "dialects.json"
OUT_DIR = ROOT / "audio" / "ai"


def load_env():
    """Read KEY=value lines from .env without extra packages."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def speakable(kn):
    """'ಎಂತ / ಎಂತದು' -> 'ಎಂತ, ಎಂತದು' so variants are read with a short pause."""
    return re.sub(r"\s*[/;]\s*", ", ", kn.strip())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--speaker", default="chaitra_kn_conversation")
    ap.add_argument("--model", default="bulbul:v4-flash")
    ap.add_argument("--pace", type=float, default=0.9)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    load_env()
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    if not key:
        raise SystemExit("SARVAM_API_KEY is empty. Paste your key into .env, then run this again.")
    client = SarvamAI(api_subscription_key=key)

    data = json.loads(DATA.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

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
        existing = sorted(OUT_DIR.glob(stem + ".*"))
        if existing and not args.force:
            e.setdefault("voice", {})[side] = f"audio/ai/{existing[0].name}"
            skipped += 1
            continue
        try:
            res = client.text_to_speech.convert(
                text=text, language_code="kn-IN", model=args.model,
                speaker=args.speaker, pace=args.pace, output_audio_codec="mp3",
            )
        except ApiError as err:
            if err.status_code in (401, 403):
                raise SystemExit(f"Sarvam rejected the API key ({err.status_code}). Check it on dashboard.sarvam.ai.")
            print(f"[{i}/{len(jobs)}] {stem}: failed ({err.status_code}): {str(err.body)[:200]}")
            failed += 1
            if err.status_code == 429:
                time.sleep(5)
            continue
        audio = base64.b64decode(res.audios[0])
        ext = "wav" if audio[:4] == b"RIFF" else "mp3"
        (OUT_DIR / f"{stem}.{ext}").write_bytes(audio)
        e.setdefault("voice", {})[side] = f"audio/ai/{stem}.{ext}"
        made += 1
        # Print the id, not the Kannada text: some Windows consoles can't show Kannada.
        print(f"[{i}/{len(jobs)}] {stem}: {len(audio):,} bytes")
        time.sleep(0.3)

    data["sources"]["sarvam_voice"] = "https://www.sarvam.ai/text-to-speech"
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"\nDone. {made} new clips, {skipped} already there, {failed} failed.")
    if made or skipped:
        print("Reload the site: words now play the Sarvam voice.")


if __name__ == "__main__":
    main()
