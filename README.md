# Namma Kannada (ನಮ್ಮ ಕನ್ನಡ)

An interactive map of how spoken Kannada changes across Karnataka. Pick a place to see its words and phrases next to standard Kannada, with meaning, a cultural note and a link to the source.

Built for the Kannada Digital Innovation Hackathon 2026, problem statement 4: Regional Language Explorer.

## Features

- **Map:** 16 places across 5 regions on a district-level map of Karnataka. A hollow pin means no words yet.
- **Word cards:** dialect form, transliteration, English meaning, standard Kannada, note, source link and whether a native speaker has checked it.
- **Compare:** the same phrase side by side across regions.
- **Search:** in Kannada script, English or transliteration.
- **Guess the region:** a quiz built from the dataset that marks the answer on the map.
- **Add a word:** visitors add a word from their town. It is saved on their device, can be copied as JSON, and can be sent to you through a Google Form (set `GOOGLE_FORM_URL` in `js/config.js`).

## Sound

- **Play recording:** a clip recorded by a Kannada speaker, with the real local accent.
- **Listen:** a computer voice reading the spelling in a standard accent. Where the [Alar voice corpus](https://github.com/Aditya-ds-1806/Alar-voice-corpus) (GPL-2.0, generated with Google TTS) has the word, its clip in `audio/alar/` plays in any browser; this covers 17 dialect words and 21 standard forms. Otherwise the browser's built-in Kannada voice is used, which Microsoft Edge on Windows and Chrome on Android have; the button is hidden in browsers without one. **Demo in Edge.**

To add recordings, open `#/record` in the site (also linked from Sources), record and save each word, move the files into `audio/`, then run:

```bash
node scripts/link-audio.mjs
```

It matches files to entries by name (`kun-02.webm` → entry `kun-02`) and adds the `audio` field.

## Run it

The site is plain HTML, CSS and JavaScript with no build step. It loads `data/dialects.json`, so it needs a local server; double-clicking `index.html` will not work.

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the address it prints.

## Deploy

- **Vercel:** import the GitHub repo and deploy with no settings, or run `npx vercel` in this folder.
- **GitHub Pages:** Settings → Pages → deploy from the `main` branch, root folder.

## Add or fix words

Everything lives in `data/dialects.json`.

```json
{
  "id": "mys-01",
  "place": "mysuru",
  "type": "word",
  "english": "what",
  "standard": { "kn": "ಏನು", "tr": "enu" },
  "dialect": { "kn": "…", "tr": "…" },
  "note": "Optional cultural note",
  "source": "native",
  "confidence": "reference",
  "verified": true,
  "audio": "audio/mys-01.mp3"
}
```

- `place` must match a place `id` in the same file.
- `type` is one of `word`, `phrase`, `grammar`, `sound`, `loanword`.
- `source` is a key in `sources`. For words you know first-hand, add `"native": "Native speaker (project author)"` to `sources`.
- Set `verified` to `true` once a native speaker has confirmed the entry.
- `audio` is optional. Put the MP3 in `audio/` and a Play button appears.
- Add a group to `compare_sets` to show entries side by side in Compare.

## Project structure

```
index.html          page shell
css/style.css       all styles
js/app.js           startup and routing
js/views.js         the panel views
js/map.js           SVG map and pins
js/map-data.js      generated district shapes (do not edit)
js/store.js         data loading, search, saved contributions
js/config.js        settings
data/dialects.json  the dataset
audio/              pronunciation clips
scripts/build-map.mjs  regenerates js/map-data.js from GeoJSON
```

## Data and credits

Every entry links to its source. See the Sources page in the app for the full list. Entries marked "Not yet checked by a speaker" come from published references, blogs or forums and still need a native speaker to confirm them.

Map boundaries: [india-maps-data](https://github.com/udit-001/india-maps-data) (2011 census districts). Regions are approximate cultural zones, not official divisions.
