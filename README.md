# lead-finder-ts (Google Places API — New)

Find local businesses that **have no website or only a Facebook website**, then export them to a CSV you can import into your outreach tracker.

> Works great for your “Website-in-a-Day” FB → proper site offer.

---

## Quick start

1) **Enable APIs & create key**
- In Google Cloud, enable **Places API**.
- Create an API key and restrict it to HTTP(S) and Places API.
- Note: The new Places API **requires a FieldMask** on every request.

2) **Clone and install**
```bash
cd lead-finder-ts
cp .env.example .env
# put your key in GOOGLE_PLACES_API_KEY=...
npm i
```

3) **Run a search**
```bash
npm run find -- --categories "barber,cafe,beauty salon" --neighborhoods "Nea Smyrni,Kallithea" --city Athens --country Greece --max 40 --out leads.csv
```

Options:
- `--categories`: comma-separated (free text, used in `textQuery`), default is a sensible local list.
- `--neighborhoods`: comma-separated local areas.
- `--city`, `--country`: appended to the query.
- `--max`: max results to fetch per query (up to ~60 in Text Search limits).
- `--concurrency`: concurrent Place Details calls (default 5).
- `--includeWithWebsite=true`: don’t filter; include all, but still flag if the website is Facebook.

4) **Open CSV**
- Import `leads.csv` into your CRM sheet (or the Excel tracker I gave you earlier).

---

## How it works

- Uses **Text Search (New)** to get candidates by free text query.
- For each place, calls **Place Details (New)** to fetch `websiteUri`, phone, ratings, etc.
- Filters to **no website** or **website = facebook.com** by default.
- Outputs a clean CSV with name, category, address, phone, website, rating, Google Maps URL.

Docs:
- Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
- Place Details (New): https://developers.google.com/maps/documentation/places/web-service/place-details
- Choose fields (FieldMask): https://developers.google.com/maps/documentation/places/web-service/choose-fields

---

## Tips

- Tune categories (`src/config.ts`) for your niches.
- Keep `--concurrency` modest (e.g., 5–8) to be polite and avoid rate issues.
- Consider a daily neighborhood rotation for coverage.
- To find **all** businesses (even those with websites), pass `--includeWithWebsite=true` and look for `facebook.com` (or modify the filter for `instagram.com`, `linktr.ee`, etc.).

---

## License

MIT — use freely for your agency.