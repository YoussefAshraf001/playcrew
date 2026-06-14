import type { ReleaseDatePrecision } from "@/app/lib/releaseDates";

export type StoredRating = number | "excluded" | null;

export type PickerGame = {
  igdbId: number;
  name: string;
  cover: string;
  status?: string;
  rating: number;
  releaseDate: Date | null;
};

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
  location?: string;
}

export interface TrackedGame {
  _docId: string;

  name: string;

  playtime?: number;
  my_rating?: number | null;
  status?: string;
  progress?: number;
  review: {
    text: string;
    sticker: string | null;
  };

  favorite?: boolean;
  favoriteOrder?: number;
  favoriteAllTime?: boolean;
  notInterested?: boolean;
  playedSessions?: PlaySession[];
  saveUploads?: SaveUpload[];
  save?: {
    storageKey: string;
    fileName: string;
    sizeBytes: number;
    uploadedAt: Date;
  } | null;
  lastUpdated?: any;
  recentActionSummary?: string;

  igdb: {
    id: number;
    name: string;
    cover?: string;
    rating?: number;
    genres?: string[];
    releaseDate?: Date;
    releaseDatePrecision?: ReleaseDatePrecision | null;
  };
}
