import 'dotenv/config';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in env.");
  process.exit(1);
}

export type TextSearchPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  name?: string; // places/{place_id}
};

export type PlaceDetails = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
};

type TextSearchResponse = {
  places?: TextSearchPlace[];
  nextPageToken?: string;
};

const BASE = "https://places.googleapis.com/v1";

export async function textSearch(query: string, pageToken?: string, pageSize = 20): Promise<TextSearchResponse> {
  const url = `${BASE}/places:searchText`;
  const body: any = {
    textQuery: query,
    pageSize
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY!,
      // Ask only for fields we need to minimize cost.
      // See: https://developers.google.com/maps/documentation/places/web-service/text-search
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,nextPageToken'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TextSearch error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  // placeId here is the plain id (like ChIJ...); new API also uses resource name "places/PLACE_ID" in `name`.
  const url = `${BASE}/places/${placeId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY!,
      // Website, phone, ratings, maps link, address, name
      // See: https://developers.google.com/maps/documentation/places/web-service/place-details
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,internationalPhoneNumber,nationalPhoneNumber,websiteUri,rating,userRatingCount,googleMapsUri'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PlaceDetails error ${res.status}: ${text}`);
  }
  return res.json();
}

/** Pulls the plain id from a resource name like "places/ChIJ...". */
export function extractIdFromResourceName(resourceName?: string): string | undefined {
  if (!resourceName) return undefined;
  if (resourceName.startsWith("places/")) return resourceName.split("/")[1];
  return resourceName;
}