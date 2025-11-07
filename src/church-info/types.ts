/**
 * Church information type for embedding in API responses
 */
export interface ChurchInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  byline: string | null;
}
