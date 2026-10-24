"""First Sarvam call: say one Kannada word with a native Kannada voice and save it.

Run from the project folder:  python scripts/sarvam_first_call.py
Needs SARVAM_API_KEY in .env (or in the environment).
"""
import base64
import os
import pathlib

from sarvamai import SarvamAI

ROOT = pathlib.Path(__file__).resolve().parent.parent


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


load_env()
key = os.environ.get("SARVAM_API_KEY", "").strip()
if not key:
    raise SystemExit("SARVAM_API_KEY is empty. Paste your key into .env, then run this again.")

client = SarvamAI(api_subscription_key=key)
res = client.text_to_speech.convert(
    text="ಬತ್ತೆ",                      # batte, "I will come" (Sirsi)
    language_code="kn-IN",
    model="bulbul:v4-flash",
    speaker="chaitra_kn_conversation",  # native Kannada voice
    output_audio_codec="mp3",
)

audio = base64.b64decode(res.audios[0])
ext = "wav" if audio[:4] == b"RIFF" else "mp3"
out = ROOT / f"sarvam-test.{ext}"
out.write_bytes(audio)
print(f"request_id: {res.request_id}")
print(f"Saved {len(audio):,} bytes of audio to {out.name}. Open it to hear 'batte'.")
