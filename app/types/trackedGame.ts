import type { ReleaseDatePrecision } from "@/app/lib/releaseDates";

export type StoredRating = number | "excluded" | null;
export type RefreshBlockField =
  | "name"
  | "cover"
  | "genres"
  | "rating"
  | "platforms"
  | "released";

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

export type PlayedOnPlatform =
  | "steam"
  | "epic-games"
  | "gog"
  | "xbox"
  | "xbox-360"
  | "xbox-one"
  | "xbox-series"
  | "xbox-game-pass-pc"
  | "playstation"
  | "playstation-2"
  | "playstation-3"
  | "playstation-4"
  | "playstation-5"
  | "psp"
  | "ps-vita"
  | "nintendo"
  | "ea-app"
  | "ubisoft-connect"
  | "battle-net"
  | "riot-games"
  | "offline-activation"
  | "pirated";

export type PreReleaseAccessType =
  | "early-access"
  | "advanced-access"
  | "leaked";

export interface PreReleaseAccess {
  type: PreReleaseAccessType;
  unlockedAt: Date;
  dateSource: "unlock" | "official";
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
    createdAt?: any;
    updatedAt?: any;
  };

  favorite?: boolean;
  favoriteOrder?: number;
  favoriteAllTime?: boolean;
  wantToPlayOrder?: number;
  notInterested?: boolean;
  playedSessions?: PlaySession[];
  playedOn?: PlayedOnPlatform | PlayedOnPlatform[] | null;
  lastUpdated?: any;
  recentActionSummary?: string;
  recentActionSource?: "user" | "refresh";
  preReleaseAccess?: PreReleaseAccess | null;
  refreshExcluded?: boolean;
  refreshBlockedFields?: Partial<Record<RefreshBlockField, boolean>>;
  protectCustomCoverFromRefresh?: boolean;

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
