export type Lead = {
  businessName: string;
  category: string;
  city: string;
  country: string;
  address: string;
  phone?: string;
  website?: string;
  hasWebsite: 'Y' | 'N';
  facebookUrl?: string;
  rating?: number;
  ratingCount?: number;
  googleMapsUrl?: string;
  source: 'Maps';
};