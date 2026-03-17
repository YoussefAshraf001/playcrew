export type StoredRating = number | "excluded" | null;

export interface CategoryRatings {
  graphics: StoredRating;
  gameplay: StoredRating;
  story: StoredRating;
  ost: StoredRating;
  cinematics: StoredRating;
  voiceActing: StoredRating;
}

export interface PlaySession {
  playedAt: any;
  durationHours: number;
}

export interface SaveUpload {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: any;
  storageKey: string;
  savePath?: string;
}

export interface TrackedGame {
  _docId: string;

  name: string;

  playtime?: number;
  my_rating?: number | null;
  status?: string;
  progress?: number;
  notes?: string;
  categoryRatings?: CategoryRatings;
  favorite?: boolean;
  favoriteAllTime?: boolean;
  notInterested?: boolean;
  playedSessions?: PlaySession[];
  saveUploads?: SaveUpload[];
  lastUpdated?: any;
  recentActionSummary?: string;

  igdb: {
    id: number;
    name: string;
    cover?: string;
    rating?: number;
    genres?: string[];
    releaseDate?: Date;
  };
}
