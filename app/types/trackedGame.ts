export type StoredRating = number | "excluded" | null;

export interface CategoryRatings {
  graphics: StoredRating;
  gameplay: StoredRating;
  story: StoredRating;
  ost: StoredRating;
  cinematics: StoredRating;
  voiceActing: StoredRating;
}

export interface TrackedGame {
  _docId: string;

  name: string;

  playtime?: number;
  my_rating?: number;
  status?: string;
  progress?: number;
  notes?: string;
  categoryRatings?: CategoryRatings;
  favorite?: boolean;
  favoriteAllTime?: boolean;
  lastUpdated?: any;

  igdb: {
    id: number;
    name: string;
    cover?: string;
    rating?: number;
    releaseDate?: Date;

    genres?: string[];
  };
}
