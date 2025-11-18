export interface Game {
  id: number;
  name: string;
  slug: string;
  description: string;
  background_image: string;
  rating: number;
  released?: string;
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[];
  short_screenshots?: { id?: number; image: string }[];
  stores?: {
    id: number;
    url?: string;
    url_en?: string;
    store: {
      id: number;
      name: string;
      slug: string;
    };
  }[];
  ratings?: { id: number; title: string; count: number; percent: number }[];
  reviews_count?: number;
  metacritic?: number;
  tags?: { id: number; name: string; slug: string }[];
  added_by_status?: {
    yet?: number;
    owned?: number;
    beaten?: number;
    toplay?: number;
    dropped?: number;
    playing?: number;
  };
}
