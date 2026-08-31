"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { FaStar } from "react-icons/fa6";
import { GiTrophy } from "react-icons/gi";
import { IoCloseCircle } from "react-icons/io5";

import { db } from "@/app/lib/firebase";
import { isAwardCategory } from "@/app/lib/awards";
import { useUser } from "../context/UserContext";
import WheelLockSwitch from "./WheelLockSwitch";

interface ShelfGame {
  igdbId: number;
  name: string;
  cover: string;
  status: string;
  rating: number;
  releaseDate: Date | null;
  performanceName?: string;
  performanceActorName?: string;
  performanceCharacterName?: string;
  performanceImageUrl?: string;
  nomineeEntryId?: string;
}

interface IgdbSearchGame {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
  rating?: number;
  total_rating?: number;
}

interface ModalProps {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  currentCategory: string | null;
  awardYear?: number | null;
  currentWinner?: ShelfGame | null;
  currentNominees?: ShelfGame[];
  pickGame: (
    winner: ShelfGame,
    nominees?: ShelfGame[],
    extras?: { performanceName?: string },
  ) => Promise<void>;
  saveNominees?: (
    nominees: ShelfGame[],
    extras?: { performanceName?: string },
  ) => Promise<void>;
  winnerSelectionLocked?: boolean;
  winnerSelectionLockedMessage?: string;
  disabledGameIds?: number[];
  disabledOverlayText?: string;
  theme?: "shelf" | "default";
  knownPerformanceImages?: Record<string, string>;
}

type SortOption = "rating" | "name";

const PAGE_SIZE = 12;
const DEFAULT_MAX_NOMINEES = 5;
const EMPTY_GAMES: ShelfGame[] = [];

const ROMAN_NUMERAL_TO_ARABIC: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};

const normalizeForSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g,
      (token) => ROMAN_NUMERAL_TO_ARABIC[token] ?? token,
    )
    .replace(/\s+/g, " ")
    .trim();

const normalizePerformerName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const PACKAGE_TITLE_PATTERN =
  /\b(bundle|edition|pack|collection|anthology|season\s+pass|cloud\s+version|complete\s+edition|definitive\s+edition|collector'?s\s+edition|premium\s+bundle|deluxe\s+edition|ultimate\s+edition|gold\s+edition|goty\s+edition|game\s+of\s+the\s+year\s+edition)\b/i;

const isPackageTitle = (name: string) => PACKAGE_TITLE_PATTERN.test(name);

const getNomineeEntryId = (game: ShelfGame) =>
  game.nomineeEntryId ?? `game-${game.igdbId}`;

const toHighQualityCover = (url: string) => {
  if (!url) return url;
  if (!url.includes("igdb.com")) return url;
  return url.replace(/\/t_[^/]+\//, "/t_cover_big/");
};

const toPickerGame = (game: IgdbSearchGame): ShelfGame | null => {
  if (!game.id || !game.name || !game.cover?.url) return null;

  return {
    igdbId: game.id,
    name: game.name,
    cover: `https:${game.cover.url.replace("t_thumb", "t_cover_big")}`,
    status: "",
    rating: game.rating ?? game.total_rating ?? 0,
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
  };
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

const uploadImageToCloudinary = async (userId: string, source: string) => {
  const publicId = `playcrew/users/${userId}/awards/performance-${crypto.randomUUID()}`;
  const assetFolder = `playcrew/users/${userId}/awards`;

  const signRes = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId, assetFolder }),
  });

  if (!signRes.ok) {
    throw new Error("Signature request failed");
  }

  const {
    cloudName,
    apiKey,
    timestamp,
    signature,
    publicId: signedPublicId,
    assetFolder: signedAssetFolder,
  } = (await signRes.json()) as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    publicId: string;
    assetFolder?: string | null;
  };

  const body = new FormData();
  if (/^https?:\/\//i.test(source)) {
    body.append("file", source);
  } else {
    const blob = await fetch(source).then((r) => r.blob());
    const ext = (blob.type.split("/")[1] || "png").split(";")[0];
    body.append("file", blob, `performance.${ext}`);
  }
  body.append("api_key", apiKey);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);
  body.append("public_id", signedPublicId);
  if (signedAssetFolder) body.append("asset_folder", signedAssetFolder);
  body.append("overwrite", "true");
  body.append("invalidate", "true");

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body,
    },
  );

  const uploadJson = (await uploadRes.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };

  if (!uploadRes.ok || !uploadJson.secure_url) {
    throw new Error(uploadJson.error?.message || "Upload failed");
  }

  return uploadJson.secure_url;
};

const sortGames = (games: ShelfGame[], sortBy: SortOption) =>
  [...games].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }

    return (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name);
  });

export default function GamePickerModal({
  modalOpen,
  setModalOpen,
  currentCategory,
  awardYear = null,
  currentWinner = null,
  currentNominees,
  pickGame,
  saveNominees,
  winnerSelectionLocked = false,
  winnerSelectionLockedMessage,
  disabledGameIds = [],
  disabledOverlayText = "Already Added",
  theme = "default",
  knownPerformanceImages = {},
}: ModalProps) {
  const { user } = useUser();
  const categoryName = currentCategory ?? "";

  const [libraryGames, setLibraryGames] = useState<ShelfGame[]>([]);
  const [igdbGames, setIgdbGames] = useState<ShelfGame[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("rating");
  const [libraryOnly, setLibraryOnly] = useState(false);
  const [includeAdjacentYear, setIncludeAdjacentYear] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [nominees, setNominees] = useState<ShelfGame[]>([]);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loadingIgdb, setLoadingIgdb] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [pickingGameId, setPickingGameId] = useState<number | null>(null);
  const [savingNominees, setSavingNominees] = useState(false);
  const [savingNomineeGameId, setSavingNomineeGameId] = useState<number | null>(
    null,
  );
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const [editingPerformanceGameId, setEditingPerformanceGameId] = useState<
    string | null
  >(null);
  const [pendingPerformanceNominee, setPendingPerformanceNominee] =
    useState<ShelfGame | null>(null);
  const [performanceActorDraft, setPerformanceActorDraft] = useState("");
  const [performanceCharacterDraft, setPerformanceCharacterDraft] =
    useState("");
  const [performanceImageUrlDraft, setPerformanceImageUrlDraft] = useState("");
  const [performanceImageDataDraft, setPerformanceImageDataDraft] = useState<
    string | null
  >(null);
  const [performanceImageMode, setPerformanceImageMode] = useState<
    "url" | "upload"
  >("url");
  const [performanceImageAutofilled, setPerformanceImageAutofilled] =
    useState(false);
  const [performanceSuggestion, setPerformanceSuggestion] = useState<{
    actorName: string;
    imageUrl: string;
  } | null>(null);
  const [performanceSuggestionSeenFor, setPerformanceSuggestionSeenFor] =
    useState<string | null>(null);
  const [savingPerformanceDetails, setSavingPerformanceDetails] =
    useState(false);

  const isScreenshotsPicker = categoryName === "Screenshots Gallery";
  const isShelfTheme = theme === "shelf";
  const isMostAnticipated = categoryName === "Most Anticipated Game";
  const isBestPerformance = categoryName === "Best Performance";
  const currentCalendarYear = new Date().getFullYear();
  const includeUnreleased =
    isMostAnticipated && awardYear === currentCalendarYear;
  const targetAwardYear =
    awardYear && isMostAnticipated ? awardYear + 1 : awardYear;
  const adjacentAwardYears = targetAwardYear
    ? isMostAnticipated
      ? [targetAwardYear + 1, targetAwardYear + 2]
      : [targetAwardYear - 1, targetAwardYear - 2]
    : [];
  const maxNominees = DEFAULT_MAX_NOMINEES;
  const seededCurrentNominees = currentNominees ?? EMPTY_GAMES;

  useEffect(() => {
    if (!modalOpen) return;

    setSearch("");
    setSortBy("rating");
    setLibraryOnly(false);
    setIncludeAdjacentYear(false);
    setPage(1);
    setLoadedImages({});
    setEditingPerformanceGameId(null);
    setPendingPerformanceNominee(null);
    setPerformanceActorDraft("");
    setPerformanceCharacterDraft("");
    setPerformanceImageUrlDraft("");
    setPerformanceImageDataDraft(null);
    setPerformanceImageAutofilled(false);
    setPerformanceSuggestion(null);
    setPerformanceSuggestionSeenFor(null);
    const seededNominees =
      seededCurrentNominees.length > 0
        ? seededCurrentNominees
        : currentWinner
          ? [currentWinner]
          : [];
    setNominees(seededNominees);
    setSelectedWinnerId(
      currentWinner ? getNomineeEntryId(currentWinner) : null,
    );
    setDrawerOpen(seededNominees.length > 0);
  }, [modalOpen, categoryName, awardYear]);

  useEffect(() => {
    if (!modalOpen || !user) return;

    const fetchLibrary = async () => {
      setLoadingLibrary(true);

      try {
        const snapshot = await getDocs(
          collection(db, "users", user.uid, "games_igdb"),
        );
        const loaded = snapshot.docs
          .map((entry) => {
            const data = entry.data();

            if (!data?.igdb?.id || !data?.name || !data?.igdb?.cover)
              return null;

            return {
              igdbId: data.igdb.id,
              name: data.name,
              cover: data.igdb.cover,
              status: data.status ?? "",
              rating: data.my_rating ?? data.igdb.rating ?? 0,
              releaseDate: data.igdb.releaseDate?.seconds
                ? new Date(data.igdb.releaseDate.seconds * 1000)
                : null,
            };
          })
          .filter(Boolean) as ShelfGame[];

        setLibraryGames(loaded);
      } catch (error) {
        console.error("Failed to fetch library games:", error);
        toast.error("Failed to fetch your library");
      } finally {
        setLoadingLibrary(false);
      }
    };

    void fetchLibrary();
  }, [modalOpen, user]);

  useEffect(() => {
    if (!modalOpen) return;

    let cancelled = false;
    setSearching(true);
    setLoadingIgdb(true);

    const timer = window.setTimeout(async () => {
      try {
        const requestPayload = {
          query: search.trim(),
          year: targetAwardYear,
          includeUnreleased,
          includeAdjacentYear: true,
          adjacentYearCount: 2,
          adjacentYearDirection: isMostAnticipated ? "next" : "previous",
          category: categoryName,
        };

        const response = await fetch("/api/igdb/awards-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        });

        const rawData = await response.json();
        const data = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.games)
            ? rawData.games
            : [];

        const transformed = data
          .map(toPickerGame)
          .filter(Boolean) as ShelfGame[];

        if (!cancelled) {
          if (search.trim() && transformed.length === 0) {
            return;
          }
          setIgdbGames(transformed);
        }
      } catch (error) {
        console.error("Failed to search IGDB:", error);
        if (!cancelled) {
          setIgdbGames([]);
          toast.error("Failed to search IGDB");
        }
      } finally {
        if (!cancelled) {
          setLoadingIgdb(false);
          setSearching(false);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    modalOpen,
    targetAwardYear,
    includeUnreleased,
    includeAdjacentYear,
    isMostAnticipated,
    categoryName,
    search,
  ]);

  const modalTitle = isScreenshotsPicker
    ? "Pick a Game for Screenshots Gallery"
    : isMostAnticipated && targetAwardYear
      ? `Pick a Winner for ${targetAwardYear} ${categoryName}`
      : awardYear
        ? `Pick a Winner for ${awardYear} ${categoryName}`
        : `Pick a Winner for ${categoryName}`;

  const accentBorder = isShelfTheme
    ? "border-amber-200/30"
    : "border-cyan-500/30";
  const accentGlow = isShelfTheme
    ? "bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.14),transparent_55%),linear-gradient(180deg,rgba(5,5,5,0.35),transparent_32%)]"
    : "bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.14),transparent_55%),linear-gradient(180deg,rgba(5,5,5,0.35),transparent_32%)]";
  const accentIcon = isShelfTheme ? "text-amber-300" : "text-cyan-500";
  const accentInputBorder = isShelfTheme
    ? "border-amber-200/20"
    : "border-cyan-500/20";
  const accentToggleOn = isShelfTheme
    ? "border-amber-200/35 bg-amber-300/12 text-amber-100"
    : "border-cyan-500/35 bg-cyan-500/12 text-cyan-100";
  const accentDisabledPill = isShelfTheme
    ? "border-amber-200/40 text-amber-100"
    : "border-cyan-500/40 text-cyan-500";
  const accentLoading = isShelfTheme ? "text-amber-200" : "text-cyan-500";
  const accentCardBorder = isShelfTheme
    ? "border-amber-200/20"
    : "border-cyan-500/20";

  const libraryGameIds = useMemo(
    () => new Set(libraryGames.map((game) => game.igdbId)),
    [libraryGames],
  );
  const nomineeIds = useMemo(
    () => new Set(nominees.map((game) => game.igdbId)),
    [nominees],
  );
  const selectedWinner =
    nominees.find((game) => getNomineeEntryId(game) === selectedWinnerId) ??
    null;
  const editingPerformanceNominee =
    pendingPerformanceNominee ??
    nominees.find(
      (game) => getNomineeEntryId(game) === editingPerformanceGameId,
    ) ??
    null;
  const performancePreviewSrc =
    performanceImageDataDraft ||
    performanceImageUrlDraft.trim() ||
    editingPerformanceNominee?.performanceImageUrl ||
    editingPerformanceNominee?.cover ||
    "/placeholder-game.jpg";

  const syncNominees = async (nextNominees: ShelfGame[]) => {
    if (!saveNominees) return;

    setSavingNominees(true);
    try {
      await saveNominees(nextNominees);
    } finally {
      setSavingNominees(false);
    }
  };

  const openPerformanceEditor = (
    game: ShelfGame,
    options?: { pending?: boolean },
  ) => {
    setEditingPerformanceGameId(getNomineeEntryId(game));
    setPendingPerformanceNominee(options?.pending ? game : null);
    setPerformanceActorDraft(
      game.performanceActorName ?? game.performanceName ?? "",
    );
    setPerformanceCharacterDraft(game.performanceCharacterName ?? "");
    setPerformanceImageUrlDraft(game.performanceImageUrl ?? "");
    setPerformanceImageDataDraft(null);
    setPerformanceImageMode("url");
    setPerformanceImageAutofilled(false);
    setPerformanceSuggestion(null);
    setPerformanceSuggestionSeenFor(null);
  };

  const closePerformanceEditor = () => {
    setEditingPerformanceGameId(null);
    setPendingPerformanceNominee(null);
    setPerformanceActorDraft("");
    setPerformanceCharacterDraft("");
    setPerformanceImageUrlDraft("");
    setPerformanceImageDataDraft(null);
    setPerformanceImageMode("url");
    setPerformanceImageAutofilled(false);
    setPerformanceSuggestion(null);
    setPerformanceSuggestionSeenFor(null);
  };

  const applySuggestedPerformanceData = (
    actorName: string,
    imageUrl: string,
  ) => {
    setPerformanceActorDraft(actorName);
    setPerformanceImageUrlDraft(imageUrl);
    setPerformanceImageDataDraft(null);
    setPerformanceImageMode("url");
    setPerformanceImageAutofilled(true);
    setPerformanceSuggestion(null);
    setPerformanceSuggestionSeenFor(normalizePerformerName(actorName));
  };

  const dismissPerformanceSuggestion = (normalizedActor?: string) => {
    setPerformanceSuggestion(null);
    if (normalizedActor) {
      setPerformanceSuggestionSeenFor(normalizedActor);
    }
  };

  const updatePerformanceActorDraft = (nextValue: string) => {
    setPerformanceActorDraft(nextValue);

    if (performanceImageDataDraft) return;

    const normalizedActor = normalizePerformerName(nextValue);
    const matchedImageUrl = normalizedActor
      ? knownPerformanceImages[normalizedActor]
      : "";

    if (!matchedImageUrl) {
      setPerformanceSuggestion(null);
      setPerformanceSuggestionSeenFor(null);

      if (performanceImageAutofilled) {
        setPerformanceImageUrlDraft("");
        setPerformanceImageMode("url");
        setPerformanceImageAutofilled(false);
      }
      return;
    }

    if (performanceSuggestionSeenFor !== normalizedActor) {
      setPerformanceSuggestion({
        actorName:
          nextValue.trim() || performanceActorDraft.trim() || nextValue,
        imageUrl: matchedImageUrl,
      });
      setPerformanceSuggestionSeenFor(normalizedActor);
    }
  };

  const commitPendingPerformanceNominee = async (nominee: ShelfGame) => {
    const nextNominees = [...nominees, nominee];
    setNominees(nextNominees);
    setDrawerOpen(true);
    await syncNominees(nextNominees);
  };

  const savePerformanceDetails = async () => {
    if (!editingPerformanceGameId) return;

    setSavingPerformanceDetails(true);
    try {
      let nextImageUrl = performanceImageUrlDraft.trim();
      if (user?.uid && performanceImageDataDraft) {
        nextImageUrl = await uploadImageToCloudinary(
          user.uid,
          performanceImageDataDraft,
        );
      } else if (user?.uid && nextImageUrl) {
        nextImageUrl = await uploadImageToCloudinary(user.uid, nextImageUrl);
      }

      const finalizedNominee = {
        ...(pendingPerformanceNominee ??
          nominees.find(
            (game) => getNomineeEntryId(game) === editingPerformanceGameId,
          )!),
        performanceName: performanceActorDraft.trim() || undefined,
        performanceActorName: performanceActorDraft.trim() || undefined,
        performanceCharacterName: performanceCharacterDraft.trim() || undefined,
        performanceImageUrl: nextImageUrl || undefined,
      };

      if (pendingPerformanceNominee) {
        await commitPendingPerformanceNominee(finalizedNominee);
      } else {
        const nextNominees = nominees.map((game) =>
          getNomineeEntryId(game) === editingPerformanceGameId
            ? finalizedNominee
            : game,
        );

        setNominees(nextNominees);
        await syncNominees(nextNominees);
      }
      closePerformanceEditor();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown save failure";
      toast.error(`Failed to save performance details: ${message}`);
    } finally {
      setSavingPerformanceDetails(false);
    }
  };

  const addGameOnlyWithoutPerformanceDetails = async () => {
    if (!pendingPerformanceNominee) return;

    setSavingPerformanceDetails(true);
    try {
      await commitPendingPerformanceNominee(pendingPerformanceNominee);
      closePerformanceEditor();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown save failure";
      toast.error(`Failed to add game: ${message}`);
    } finally {
      setSavingPerformanceDetails(false);
    }
  };

  const addNominee = async (game: ShelfGame) => {
    if (
      !isBestPerformance &&
      nominees.some((entry) => entry.igdbId === game.igdbId)
    )
      return;
    if (nominees.length >= maxNominees) return;

    const nominee = isBestPerformance
      ? { ...game, nomineeEntryId: crypto.randomUUID() }
      : { ...game };

    if (isBestPerformance) {
      openPerformanceEditor(nominee, { pending: true });
      return;
    }

    const nextNominees = [...nominees, nominee];

    setNominees(nextNominees);
    setDrawerOpen(true);
    await syncNominees(nextNominees);
  };

  const removeNominee = async (nomineeEntryId: string) => {
    const nextNominees = nominees.filter(
      (game) => getNomineeEntryId(game) !== nomineeEntryId,
    );

    setNominees(nextNominees);
    setSelectedWinnerId((prev) => (prev === nomineeEntryId ? null : prev));
    if (editingPerformanceGameId === nomineeEntryId) {
      closePerformanceEditor();
    }
    await syncNominees(nextNominees);
  };

  const filteredGames = useMemo(() => {
    const now = new Date();
    const normalizedSearch = normalizeForSearch(search);

    const sourceGames = libraryOnly ? libraryGames : igdbGames;

    const filtered = sourceGames.filter((game) => {
      if (!game.name || isPackageTitle(game.name)) return false;

      if (
        normalizedSearch &&
        !normalizeForSearch(game.name).includes(normalizedSearch)
      ) {
        return false;
      }

      const isReleased = !!game.releaseDate && game.releaseDate <= now;
      const releaseYear = game.releaseDate?.getFullYear() ?? null;
      const allowedYears = [targetAwardYear, ...adjacentAwardYears].filter(
        (year): year is number => typeof year === "number",
      );

      if (libraryOnly && !libraryGameIds.has(game.igdbId)) {
        return false;
      }

      if (
        allowedYears.length > 0 &&
        releaseYear &&
        !allowedYears.includes(releaseYear)
      ) {
        return false;
      }

      if (allowedYears.length > 0 && !releaseYear && !includeUnreleased) {
        return false;
      }

      if (!isAwardCategory(categoryName)) {
        return includeUnreleased || isReleased;
      }

      if (isMostAnticipated) {
        return true;
      }

      return includeUnreleased ? true : isReleased;
    });

    return [...filtered].sort((a, b) => {
      const yearA = a.releaseDate?.getFullYear() ?? 0;
      const yearB = b.releaseDate?.getFullYear() ?? 0;

      // Newer years first
      if (yearA !== yearB) {
        return yearB - yearA;
      }

      // Within the same year, newer release dates first
      const dateA = a.releaseDate?.getTime() ?? 0;
      const dateB = b.releaseDate?.getTime() ?? 0;

      return dateB - dateA;
    });
  }, [
    igdbGames,
    search,
    targetAwardYear,
    adjacentAwardYears,
    includeUnreleased,
    sortBy,
    categoryName,
    isMostAnticipated,
    libraryOnly,
    libraryGameIds,
  ]);

  const loading = loadingLibrary || searching || loadingIgdb;

  useEffect(() => {
    if (!modalOpen || loading || searching || filteredGames.length > 0) {
      setShowEmptyState(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowEmptyState(true);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [modalOpen, loading, filteredGames.length]);

  useEffect(() => {
    if (!modalOpen) return;
    setPage(1);
  }, [modalOpen, search, libraryOnly, includeAdjacentYear]);

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!modalOpen) return;
    resultsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [modalOpen, page]);

  useEffect(() => {
    setShowEmptyState(false);
  }, [search]);

  const paginatedGames = filteredGames.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const canSaveWinner = !!selectedWinner;
  const nomineeSlots = Array.from(
    { length: maxNominees },
    (_, index) => nominees[index] ?? null,
  );

  const formatRating = (rating?: number | null) => {
    if (rating == null) return "N/A";

    const value = rating / 10;

    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  };

  if (!currentCategory) return null;

  return (
    <AnimatePresence mode="wait">
      {modalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-1200 flex items-center justify-center bg-black/80 p-3 sm:p-5"
          onClick={() => setModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={`relative flex h-[min(96dvh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border bg-zinc-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.65)] ${accentBorder}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`pointer-events-none absolute inset-0 ${accentGlow}`}
            />

            <div className="relative z-10 border-b border-white/10 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                    <GiTrophy className={accentIcon} />
                    <span>{modalTitle}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-2.5">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`Search games for ${targetAwardYear ?? "this award"}...`}
                      className={`w-full rounded-2xl border bg-black/45 px-4 py-3 pr-12 text-sm text-white placeholder:text-zinc-500 ${accentInputBorder}`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-white"
                        aria-label="Clear search"
                        title="Clear search"
                      >
                        <IoCloseCircle className="text-[20px]" />
                      </button>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-center gap-2">
                    <div className="inline-flex min-h-12 items-center justify-between gap-3 rounded-xl border border-amber-200/20 bg-zinc-900/65 px-3 py-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                        Library Only
                      </span>
                      <WheelLockSwitch
                        checked={libraryOnly}
                        onChange={(next) => {
                          setLibraryOnly(next);
                          setSearch("");
                        }}
                        theme={isShelfTheme ? "gold" : "default"}
                        title={
                          libraryOnly
                            ? "Showing only games from your library"
                            : "Showing all games"
                        }
                        ariaLabel={
                          libraryOnly
                            ? "Show all games"
                            : "Show only games from your library"
                        }
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen((prev) => !prev)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                    drawerOpen || nominees.length > 0
                      ? accentToggleOn
                      : "border-white/12 bg-black/20 text-zinc-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {nominees.length}/{maxNominees} nominees
                </button>

                {isBestPerformance && (
                  <div className="rounded-2xl border border-dashed border-amber-200/18 bg-black/25 px-4 py-3 text-sm text-zinc-400">
                    Add a game first, then use that nominee's details panel to
                    optionally enter actor, character, and image info. if its
                    too much then dont bother and only select the game.
                  </div>
                )}

                <div className="text-xs text-zinc-500">
                  Games already in your library are marked inline. You can add
                  up to {maxNominees} nominees.
                </div>
              </div>
            </div>

            <div className="relative z-10 min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-5">
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.div
                    key="modal-loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex h-full items-center justify-center"
                  >
                    <span
                      className={`loading loading-dots loading-xl ${accentLoading}`}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="modal-results"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="relative flex h-full min-h-0 gap-4"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      {showEmptyState ? (
                        <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/25 text-center text-zinc-400">
                          No games found for {targetAwardYear ?? "this award"}.
                        </div>
                      ) : (
                        <>
                          <div
                            ref={resultsScrollRef}
                            className="space-y-2 overflow-y-auto pr-1"
                          >
                            {paginatedGames.map((game) => {
                              const isDisabled = disabledGameIds.includes(
                                game.igdbId,
                              );
                              const isInLibrary = libraryGameIds.has(
                                game.igdbId,
                              );
                              const isNominee = isBestPerformance
                                ? false
                                : nomineeIds.has(game.igdbId);
                              const nomineeLimitReached =
                                nominees.length >= maxNominees && !isNominee;

                              return (
                                <motion.div
                                  key={
                                    isBestPerformance
                                      ? `${game.igdbId}-${game.name}`
                                      : game.igdbId
                                  }
                                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-black/35 px-3 py-3 text-left shadow-lg ${
                                    isNominee
                                      ? "border-amber-200/45 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),rgba(251,191,36,0.05)_34%,rgba(0,0,0,0.35)_78%)] shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_16px_34px_rgba(0,0,0,0.42)]"
                                      : accentCardBorder
                                  } ${isDisabled ? "opacity-80" : ""}`}
                                  whileHover={
                                    !isDisabled ? { y: -2, scale: 1.005 } : {}
                                  }
                                  transition={{
                                    type: "spring",
                                    stiffness: 220,
                                    damping: 22,
                                  }}
                                >
                                  <div
                                    className={`relative h-18 w-14 shrink-0 overflow-hidden rounded-lg border bg-zinc-900 ${isNominee ? "border-amber-200/35 shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_0_28px_rgba(251,191,36,0.14)]" : "border-white/10"}`}
                                  >
                                    <motion.img
                                      src={toHighQualityCover(game.cover)}
                                      alt={game.name}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                                      loading="lazy"
                                      decoding="async"
                                      initial={{ opacity: 0 }}
                                      animate={{
                                        opacity: loadedImages[game.igdbId]
                                          ? 1
                                          : 0,
                                      }}
                                      transition={{ duration: 0.3 }}
                                      onLoad={() =>
                                        setLoadedImages((prev) => ({
                                          ...prev,
                                          [game.igdbId]: true,
                                        }))
                                      }
                                      onError={() =>
                                        setLoadedImages((prev) => ({
                                          ...prev,
                                          [game.igdbId]: true,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1 self-stretch">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="truncate text-[1.05rem] font-semibold leading-tight text-white">
                                        {game.name}
                                      </h4>
                                      {isInLibrary && (
                                        <span className="shrink-0 rounded-md border border-amber-200/18 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-100/90">
                                          In Library
                                        </span>
                                      )}
                                      {isNominee && (
                                        <span className="shrink-0 rounded-md border border-amber-200/30 bg-amber-300/14 px-2 py-0.5 text-[10px] font-medium text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]">
                                          Nominee
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-zinc-300/90">
                                      <span className="inline-flex items-center gap-1">
                                        <FaStar
                                          size={11}
                                          className="text-amber-300"
                                        />
                                        {formatRating(game.rating) || "Unrated"}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-sm text-zinc-400">
                                      {game.releaseDate
                                        ? game.releaseDate.toLocaleDateString(
                                            "en-US",
                                            {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                            },
                                          )
                                        : "Release TBA"}
                                    </div>
                                  </div>
                                  <div className="shrink-0 self-center sm:self-auto">
                                    <button
                                      type="button"
                                      disabled={
                                        isDisabled ||
                                        isNominee ||
                                        savingNominees
                                      }
                                      onClick={async () => {
                                        if (isDisabled || savingNominees)
                                          return;
                                        if (nomineeLimitReached) {
                                          toast.error(
                                            `You can only add ${maxNominees} nominees`,
                                          );
                                          return;
                                        }

                                        setSavingNomineeGameId(game.igdbId);
                                        try {
                                          await addNominee(game);
                                        } finally {
                                          setSavingNomineeGameId((prev) =>
                                            prev === game.igdbId ? null : prev,
                                          );
                                        }
                                      }}
                                      className={`${isNominee ? "hidden sm:inline-flex" : "inline-flex"} max-w-[190px] items-center justify-center rounded-lg border px-2.5 py-2 text-xs sm:max-w-none sm:px-3 sm:text-sm transition ${
                                        isNominee
                                          ? "cursor-default border-amber-200/28 bg-amber-300/12 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]"
                                          : nomineeLimitReached
                                            ? "cursor-not-allowed border-white/12 bg-white/5 text-zinc-500"
                                            : "border-amber-200/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/16"
                                      }`}
                                    >
                                      {isNominee ? (
                                        <>
                                          <span className="hidden sm:inline">
                                            {categoryName} Contender
                                          </span>
                                          <span className="sm:hidden">
                                            Contender
                                          </span>
                                        </>
                                      ) : nomineeLimitReached ? (
                                        "Limit Reached"
                                      ) : savingNomineeGameId ===
                                        game.igdbId ? (
                                        <div className="px-[32.5px]">
                                          <span className="loading loading-dots loading-sm" />
                                        </div>
                                      ) : (
                                        "Add Nominee"
                                      )}
                                    </button>
                                  </div>

                                  {isDisabled && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                                      <span
                                        className={`rounded-full border bg-black/70 px-3 py-1 text-xs font-semibold ${accentDisabledPill}`}
                                      >
                                        {disabledOverlayText}
                                      </span>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>

                          {totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-center gap-3 border-t border-white/10 pt-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setPage((prev) => Math.max(1, prev - 1))
                                }
                                disabled={page === 1}
                                className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                Prev
                              </button>
                              <span className="rounded-full border border-white/12 bg-black/25 px-3 py-1 text-sm text-zinc-300">
                                {page} / {totalPages}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPage((prev) =>
                                    Math.min(totalPages, prev + 1),
                                  )
                                }
                                disabled={page === totalPages}
                                className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {drawerOpen && (
                        <motion.aside
                          initial={{ opacity: 0, x: 28 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 28 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="hidden w-[320px] max-w-[34vw] shrink-0 flex-col rounded-3xl border border-amber-200/18 bg-black/45 p-4 md:flex"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">
                                Nominees
                              </p>
                              <p className="mt-1 text-sm text-zinc-400">
                                Add contenders, then lock one as the winner.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setDrawerOpen(false)}
                              className="rounded-lg border border-white/15 bg-black/20 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
                            >
                              Hide
                            </button>
                          </div>

                          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
                            <div className="grid grid-cols-1 gap-2">
                              {nomineeSlots.map((game, index) => {
                                const isWinner =
                                  !!game &&
                                  selectedWinnerId === getNomineeEntryId(game);

                                if (!game) {
                                  return (
                                    <div
                                      key={`slot-${index}`}
                                      className="relative overflow-hidden rounded-2xl border border-dashed border-white/10 bg-black/18 p-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="h-16 w-12 shrink-0 rounded-lg bg-white/6" />
                                        <div className="min-w-0 flex-1 self-stretch">
                                          <div className="h-3 w-28 rounded bg-white/6" />
                                          <div className="mt-2 h-2.5 w-20 rounded bg-white/5" />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <motion.div
                                    key={getNomineeEntryId(game)}
                                    initial={{
                                      opacity: 0,
                                      y: -22,
                                      scale: 0.96,
                                    }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{
                                      duration: 0.22,
                                      ease: "easeOut",
                                    }}
                                    className={`rounded-2xl border ${isBestPerformance ? "p-2.5" : "p-2"} transition ${
                                      isWinner
                                        ? "border-amber-200/45 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),rgba(251,191,36,0.08)_42%,transparent_78%)] shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_18px_38px_rgba(0,0,0,0.35)]"
                                        : "border-white/10 bg-black/18 hover:border-white/14"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <img
                                        src={toHighQualityCover(
                                          game.performanceImageUrl ||
                                            game.cover,
                                        )}
                                        alt={game.name}
                                        className={`${isBestPerformance ? "h-14 w-10" : "h-12 w-9"} shrink-0 rounded-md border object-cover ${
                                          isWinner
                                            ? "border-amber-200/35"
                                            : "border-white/10"
                                        }`}
                                      />
                                      <div className="min-w-0 flex-1 self-stretch">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="truncate text-[13px] font-semibold leading-tight text-white">
                                            {game.name}
                                          </p>
                                          <button
                                            type="button"
                                            disabled={savingNominees}
                                            onClick={async () => {
                                              if (savingNominees) return;
                                              await removeNominee(
                                                getNomineeEntryId(game),
                                              );
                                            }}
                                            className="shrink-0 rounded-lg px-1 text-[11px] text-zinc-300 transition hover:text-red-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                                          >
                                            <IoCloseCircle
                                              size={18}
                                              className="shrink-0"
                                            />
                                          </button>
                                        </div>
                                        {isBestPerformance &&
                                          (game.performanceActorName ||
                                            game.performanceName) && (
                                            <p className="mt-0.5 truncate text-[11px] font-medium text-amber-100/85">
                                              {game.performanceActorName ||
                                                game.performanceName}
                                            </p>
                                          )}
                                        {isBestPerformance &&
                                          game.performanceCharacterName && (
                                            <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                                              as {game.performanceCharacterName}
                                            </p>
                                          )}
                                        <div
                                          className={`${isBestPerformance ? "mt-3 space-y-2.5" : "mt-1.5 space-y-1.5"}`}
                                        >
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span
                                              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                                                isWinner
                                                  ? "border-amber-200/28 bg-amber-300/10 text-amber-100/90"
                                                  : "border-white/10 bg-black/18 text-zinc-500"
                                              }`}
                                            >
                                              {isWinner ? "Winner" : "Nominee"}
                                            </span>
                                            {isBestPerformance && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  openPerformanceEditor(game)
                                                }
                                                className="rounded-full border border-white/12 bg-black/20 px-3 py-1 text-[11px] text-zinc-300 transition hover:border-amber-200/30 hover:text-white"
                                              >
                                                {game.performanceActorName ||
                                                game.performanceCharacterName ||
                                                game.performanceImageUrl
                                                  ? "Edit Details"
                                                  : "Add Details"}
                                              </button>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (winnerSelectionLocked) return;
                                              setSelectedWinnerId(
                                                getNomineeEntryId(game),
                                              );
                                            }}
                                            disabled={winnerSelectionLocked}
                                            className={`w-full rounded-xl border px-3 ${isBestPerformance ? "py-2" : "py-1.5"} text-[11px] font-medium transition ${
                                              winnerSelectionLocked
                                                ? "cursor-not-allowed border-white/10 bg-black/15 text-zinc-500"
                                                : isWinner
                                                  ? "border-amber-200/35 bg-amber-300/16 text-amber-50 shadow-[0_0_18px_rgba(251,191,36,0.14)]"
                                                  : "border-white/12 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
                                            }`}
                                          >
                                            {winnerSelectionLocked
                                              ? "Available Dec 10"
                                              : isWinner
                                                ? "Winner Selected"
                                                : "Pick Winner"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-4 border-t border-white/10 pt-4">
                            {winnerSelectionLocked &&
                              winnerSelectionLockedMessage && (
                                <p className="mb-3 rounded-2xl border border-amber-200/18 bg-amber-300/8 px-3 py-2 text-center text-xs text-amber-100/90">
                                  {winnerSelectionLockedMessage}
                                </p>
                              )}
                            <button
                              type="button"
                              disabled={
                                !canSaveWinner ||
                                pickingGameId !== null ||
                                savingNominees ||
                                winnerSelectionLocked
                              }
                              onClick={async () => {
                                if (!selectedWinner) return;

                                setPickingGameId(selectedWinner.igdbId);
                                try {
                                  await pickGame(selectedWinner, nominees);
                                } finally {
                                  setPickingGameId(null);
                                }
                              }}
                              className="w-full rounded-2xl border border-amber-200/28 bg-amber-300/12 px-4 py-3 text-sm font-medium text-amber-50 transition hover:bg-amber-300/18 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Announce Winner
                            </button>
                          </div>
                        </motion.aside>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {isBestPerformance && editingPerformanceNominee && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-90 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm"
                        >
                          <motion.div
                            initial={{ opacity: 0, y: 18, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="w-full max-w-xl rounded-3xl border border-amber-200/18 bg-[var(--theme-surface-strong)] p-5 shadow-[var(--theme-shadow)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">
                                  Best Performance
                                </p>
                                <h4 className="mt-1 text-lg font-semibold text-white">
                                  Which performance made you pick this nominee?
                                </h4>
                                <p className="mt-2 text-sm text-zinc-400">
                                  Add details for{" "}
                                  {editingPerformanceNominee.name}. Everything
                                  here is optional.
                                  {pendingPerformanceNominee
                                    ? " Close to cancel adding this game, or save/ignore to add it."
                                    : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={closePerformanceEditor}
                                className="rounded-lg border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10"
                              >
                                Close
                              </button>
                            </div>

                            <div className="mt-5 grid gap-4">
                              <label className="text-sm text-zinc-300">
                                <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-amber-100/70">
                                  Voice Actor (Optional)
                                </span>
                                <input
                                  type="text"
                                  value={performanceActorDraft}
                                  onChange={(e) =>
                                    updatePerformanceActorDraft(e.target.value)
                                  }
                                  placeholder="Ben Starr"
                                  className={`w-full rounded-2xl border bg-black/45 px-4 py-3 text-sm text-white placeholder:text-zinc-500 ${accentInputBorder}`}
                                />
                              </label>

                              <label className="text-sm text-zinc-300">
                                <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-amber-100/70">
                                  Character (Optional)
                                </span>
                                <input
                                  type="text"
                                  value={performanceCharacterDraft}
                                  onChange={(e) =>
                                    setPerformanceCharacterDraft(e.target.value)
                                  }
                                  placeholder="Verso"
                                  className={`w-full rounded-2xl border bg-black/45 px-4 py-3 text-sm text-white placeholder:text-zinc-500 ${accentInputBorder}`}
                                />
                              </label>

                              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[11px] uppercase tracking-[0.16em] text-amber-100/70">
                                    Performance Image (Optional)
                                  </p>
                                  <div className="inline-flex rounded-full border border-white/10 bg-black/30 p-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPerformanceImageMode("url")
                                      }
                                      className={`rounded-full px-3 py-1 text-[11px] transition ${performanceImageMode === "url" ? "bg-amber-300/14 text-amber-50" : "text-zinc-400 hover:text-white"}`}
                                    >
                                      Image Link
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPerformanceImageMode("upload")
                                      }
                                      className={`rounded-full px-3 py-1 text-[11px] transition ${performanceImageMode === "upload" ? "bg-amber-300/14 text-amber-50" : "text-zinc-400 hover:text-white"}`}
                                    >
                                      Upload
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_160px] md:items-start">
                                  <div>
                                    {performanceImageMode === "url" ? (
                                      <label className="text-sm text-zinc-300">
                                        <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-amber-100/70">
                                          Image Link (Optional)
                                        </span>
                                        <input
                                          type="url"
                                          value={performanceImageUrlDraft}
                                          onChange={(e) => {
                                            setPerformanceImageUrlDraft(
                                              e.target.value,
                                            );
                                            setPerformanceImageDataDraft(null);
                                            setPerformanceImageAutofilled(
                                              false,
                                            );
                                            setPerformanceSuggestion(null);
                                          }}
                                          placeholder="https://..."
                                          className={`w-full rounded-2xl border bg-black/45 px-4 py-3 text-sm text-white placeholder:text-zinc-500 ${accentInputBorder}`}
                                        />
                                      </label>
                                    ) : (
                                      <label className="text-sm text-zinc-300">
                                        <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-amber-100/70">
                                          Upload Image (Optional)
                                        </span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                              const dataUrl =
                                                await fileToDataUrl(file);
                                              setPerformanceImageDataDraft(
                                                dataUrl,
                                              );
                                              setPerformanceImageUrlDraft("");
                                              setPerformanceImageAutofilled(
                                                false,
                                              );
                                              setPerformanceSuggestion(null);
                                            } catch (error) {
                                              const message =
                                                error instanceof Error
                                                  ? error.message
                                                  : "Failed to read file";
                                              toast.error(message);
                                            }
                                          }}
                                          className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-xl file:border file:border-amber-200/20 file:bg-amber-300/10 file:px-3 file:py-2 file:text-sm file:text-amber-100"
                                        />
                                      </label>
                                    )}
                                  </div>

                                  <div className="rounded-2xl border border-amber-200/12 bg-black/30 p-3">
                                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                      Preview
                                    </p>
                                    <div className="mx-auto h-40 w-28 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                                      <img
                                        src={performancePreviewSrc}
                                        alt={editingPerformanceNominee.name}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                                      Preview updates as soon as you paste a
                                      link or choose a file. Uploaded files are
                                      sent to Cloudinary when you save details.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-5 flex gap-3 border-t border-white/10 pt-4">
                              <button
                                type="button"
                                onClick={closePerformanceEditor}
                                className="flex-1 rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/10"
                              >
                                Ignore And Add Game Only
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingPerformanceDetails || savingNominees
                                }
                                onClick={savePerformanceDetails}
                                className="flex-1 rounded-2xl border border-amber-200/28 bg-amber-300/12 px-4 py-3 text-sm font-medium text-amber-50 transition hover:bg-amber-300/18 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {savingPerformanceDetails ? (
                                  <div>
                                    <span className="loading loading-dots loading-xs" />
                                  </div>
                                ) : (
                                  "Save Details"
                                )}
                              </button>
                            </div>
                          </motion.div>

                          <AnimatePresence>
                            {performanceSuggestion && (
                              <motion.aside
                                initial={{ opacity: 0, y: 28 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 28 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="fixed inset-x-4 bottom-4 z-95 md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]"
                              >
                                <div className="overflow-hidden rounded-[28px] border border-amber-200/18 bg-[linear-gradient(180deg,rgba(18,12,3,0.98),rgba(4,3,1,0.98))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                                  <div className="grid gap-4 sm:grid-cols-[92px_minmax(0,1fr)] sm:items-start">
                                    <div className="mx-auto h-36 w-24 overflow-hidden rounded-3xl border border-amber-200/20 bg-black/30 sm:h-32 sm:w-22">
                                      <img
                                        src={performanceSuggestion.imageUrl}
                                        alt={performanceSuggestion.actorName}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[11px] uppercase tracking-[0.24em] text-amber-100/72">
                                        Recognized Actor
                                      </p>
                                      <h5 className="mt-1 text-lg font-semibold leading-tight text-white">
                                        This actor was nominated before
                                      </h5>
                                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                                        We found saved actor data for{" "}
                                        {performanceSuggestion.actorName}. Do
                                        you want to use the same image here?
                                      </p>
                                      <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            applySuggestedPerformanceData(
                                              performanceSuggestion.actorName,
                                              performanceSuggestion.imageUrl,
                                            )
                                          }
                                          className="rounded-2xl border border-amber-200/30 bg-amber-300/14 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/20"
                                        >
                                          Use Same Data
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            dismissPerformanceSuggestion(
                                              normalizePerformerName(
                                                performanceSuggestion.actorName,
                                              ),
                                            )
                                          }
                                          className="rounded-2xl border border-white/12 bg-black/20 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
                                        >
                                          Not Now
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.aside>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
