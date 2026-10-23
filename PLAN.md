# Build plan: Namma Kannada

Deadline: submit by 9 PM on 25 Oct (portal closes 10 PM).
Deliverables: GitHub repo, live URL, PPT, 3–5 minute video.

## Done (23 Oct)

- [x] Dataset: 46 sourced entries, 16 places, 5 regions (`data/dialects.json`)
- [x] District map of Karnataka with place pins
- [x] Word cards with source links and checked/not-checked status
- [x] Compare, search, Guess the region, Add a word, Sources
- [x] Works on phone and desktop

## 24 Oct: content and the voice feature

- [ ] Add 4–6 words each for Mysuru and Chikkamagaluru from your own speech (`"source": "native"`, `"verified": true`)
- [ ] Ask friends from Mangaluru, Udupi, Shivamogga or Kalaburagi for 2–3 words each to fill hollow pins
- [ ] Read through entries tagged `kn_check` and `informal`, and fix any Kannada spelling
- [ ] Record audio for 10–15 of the best words on your phone, save as `audio/<id>.mp3`, add `"audio"` to each entry
- [ ] Add 2 more compare sets (for example "what", "house")
- [ ] Stretch: "Say it" button using Chrome speech recognition (`kn-IN`) to check pronunciation
- [ ] Create a Google Form for contributions and paste its link in `js/config.js`
- [ ] Push to GitHub, deploy to Vercel, test the live link on your phone

## 25 Oct: present

- [ ] By 2 PM: freeze features, fix bugs only
- [ ] 2–5 PM: PPT (problem, gap, demo screenshots, data method, impact, future scope)
- [ ] 5–8 PM: record video (show map → Sirsi → Compare → quiz → Add a word)
- [ ] 8–9 PM: write README extras, submit repo, URL, PPT and video

## Pitch line

Information about Kannada dialects exists, but it is scattered across dictionaries, Wikipedia, research papers and blogs. Namma Kannada brings it onto one map, cites every word, and lets speakers fill in their own town.

## Future scope (for the PPT)

- Speaker-recorded audio for every word
- Moderated contributions with a review queue
- More places and community-verified entries
- Pronunciation practice with speech recognition
