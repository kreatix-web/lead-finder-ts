import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pLimit from 'p-limit';
import { DEFAULT_CATEGORIES, DEFAULT_NEIGHBORHOODS, DEFAULT_CITY, DEFAULT_COUNTRY } from './config.js';
import { textSearch, getPlaceDetails, extractIdFromResourceName, TextSearchPlace } from './googlePlaces.js';
import type { Lead } from './types.js';

type Args = {
  categories: string[];
  neighborhoods: string[];
  city: string;
  country: string;
  maxPerQuery: number;
  detailsConcurrency: number;
  out: string;
  includeWithWebsite: boolean; // if true, don't filter by website
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const getFlag = (name: string) => {
    const idx = argv.findIndex(a => a === name || a.startsWith(name + "="));
    if (idx === -1) return undefined;
    const eq = argv[idx].indexOf("=");
    if (eq !== -1) return argv[idx].slice(eq + 1);
    return argv[idx + 1];
  };

  const categories = (getFlag("--categories") || getFlag("-c") || DEFAULT_CATEGORIES.join(",")).split(",").map(s => s.trim()).filter(Boolean);
  const neighborhoods = (getFlag("--neighborhoods") || getFlag("-n") || DEFAULT_NEIGHBORHOODS.join(",")).split(",").map(s => s.trim()).filter(Boolean);
  const city = (getFlag("--city") || DEFAULT_CITY).trim();
  const country = (getFlag("--country") || DEFAULT_COUNTRY).trim();
  const maxPerQuery = parseInt(getFlag("--max") || "40", 10);
  const detailsConcurrency = parseInt(getFlag("--concurrency") || "5", 10);
  const out = (getFlag("--out") || "leads.csv").trim();
  const includeWithWebsite = (getFlag("--includeWithWebsite") || "false").toLowerCase() === "true";

  return { categories, neighborhoods, city, country, maxPerQuery, detailsConcurrency, out, includeWithWebsite };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function looksLikeFacebook(url?: string): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes("facebook.com") || u.includes("m.facebook.com");
}

function sanitize(str?: string): string {
  if (!str) return "";
  return str.replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchAllForQuery(textQuery: string, take: number): Promise<TextSearchPlace[]> {
  let token: string | undefined;
  const all: TextSearchPlace[] = [];
  while (all.length < take) {
    const remaining = take - all.length;
    const pageSize = Math.min(20, remaining);
    const res = await textSearch(textQuery, token, pageSize);
    const places = res.places || [];
    all.push(...places);
    token = res.nextPageToken;
    if (!token || places.length === 0) break;
    // Per docs, slight delay before next page is available.
    await sleep(1000);
  }
  return all;
}

async function main() {
  const args = parseArgs();
  console.log("Lead Finder — Google Places (New)");
  console.log("Categories:", args.categories.join(", "));
  console.log("Neighborhoods:", args.neighborhoods.join(", "));
  console.log("City:", args.city, "Country:", args.country);
  console.log("Max per query:", args.maxPerQuery, "Concurrency:", args.detailsConcurrency);
  console.log("Output:", args.out);

  const limit = pLimit(args.detailsConcurrency);
  const leads: Lead[] = [];

  for (const category of args.categories) {
    for (const hood of args.neighborhoods) {
      const query = `${category} in ${hood}, ${args.city}, ${args.country}`;
      console.log(`\nSearching: "${query}" ...`);
      try {
        const found = await fetchAllForQuery(query, args.maxPerQuery);
        console.log(`  Found ${found.length} candidates. Getting details...`);

        const tasks = found.map(place => limit(async () => {
          try {
            const placeId = place.id || extractIdFromResourceName(place.name);
            if (!placeId) return;

            const details = await getPlaceDetails(placeId);

            const website = details.websiteUri;
            const hasWebsite = website ? 'Y' : 'N';
            const fbUrl = looksLikeFacebook(website) ? website : undefined;

            if (!args.includeWithWebsite) {
              // Skip if they already have a proper website (non-Facebook)
              if (website && !fbUrl) return;
            }

            const lead: Lead = {
              businessName: sanitize(details.displayName?.text || place.displayName?.text),
              category,
              city: args.city,
              country: args.country,
              address: sanitize(details.formattedAddress || place.formattedAddress),
              phone: details.internationalPhoneNumber || details.nationalPhoneNumber,
              website: website,
              hasWebsite,
              facebookUrl: fbUrl,
              rating: details.rating,
              ratingCount: details.userRatingCount,
              googleMapsUrl: details.googleMapsUri || place.googleMapsUri,
              source: 'Maps'
            };
            leads.push(lead);
          } catch (e: any) {
            console.warn("  Details error:", e?.message || e);
          }
        }));

        await Promise.all(tasks);
      } catch (e: any) {
        console.warn("  Search error:", e?.message || e);
      }
    }
  }

  // CSV export
  const headers = [
    "Business Name",
    "Category",
    "City",
    "Country",
    "Address",
    "Phone",
    "Website",
    "Has Website? (Y/N)",
    "Facebook URL",
    "Google Maps URL",
    "Rating",
    "Rating Count",
    "Source"
  ];

  const rows = [headers.join(",")];
  for (const l of leads) {
    const r = [
      l.businessName,
      l.category,
      l.city,
      l.country,
      l.address,
      l.phone || "",
      l.website || "",
      l.hasWebsite,
      l.facebookUrl || "",
      l.googleMapsUrl || "",
      l.rating?.toString() || "",
      l.ratingCount?.toString() || "",
      l.source
    ].map(v => {
      const s = (v ?? "").toString();
      if (s.includes(",") || s.includes("\n") || s.includes("\\")) {
        // naïve CSV escaping
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(",");
    rows.push(r);
  }

  const outPath = path.resolve(process.cwd(), args.out);
  fs.writeFileSync(outPath, rows.join("\n"), "utf8");
  console.log(`\nSaved ${leads.length} leads to: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});