"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { toast } from "react-hot-toast";

import { db } from "@/app/lib/firebase";
import {
  AWARD_CATEGORIES,
  AWARD_CATEGORY_DESCRIPTIONS,
  AwardCategory,
  getAwardCategoryDocId,
  getAwardCategoryFromDocId,
  getAwardYears,
} from "@/app/lib/awards";
import { useUser } from "@/app/context/UserContext";
import GamePickerModal from "@/app/components/GamePickerModal";
import LoadingSpinner from "../explore/loading";
import { IoCloseCircle } from "react-icons/io5";
import { FaInfoCircle } from "react-icons/fa";
import { useUI } from "@/app/context/UIContext";

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
interface ShelfAwardEntry {
  winner: ShelfGame | null;
  nominees: ShelfGame[];
}
type ShelfMap = Record<AwardCategory, ShelfAwardEntry>;
type ShelfByYear = Record<number, ShelfMap>;

type WinnerCelebrationState = {
  category: AwardCategory;
  token: number;
};

const parseStoredShelfGame = (value: unknown): ShelfGame | null => {
  if (
    !value ||
    typeof value !== "object" ||
    !("igdbId" in value) ||
    !("name" in value) ||
    !("cover" in value)
  ) {
    return null;
  }

  const rawValue = value as {
    igdbId: unknown;
    name: unknown;
    cover: unknown;
    status?: unknown;
    rating?: unknown;
    releaseDate?: unknown;
    performanceName?: unknown;
    performanceActorName?: unknown;
    performanceCharacterName?: unknown;
    performanceImageUrl?: unknown;
    nomineeEntryId?: unknown;
  };

  const rawReleaseDate = rawValue.releaseDate ?? null;

  return {
    igdbId: Number(rawValue.igdbId),
    name: String(rawValue.name),
    cover: String(rawValue.cover),
    status: typeof rawValue.status === "string" ? rawValue.status : "",
    rating: typeof rawValue.rating === "number" ? rawValue.rating : 0,
    releaseDate:
      rawReleaseDate instanceof Date
        ? rawReleaseDate
        : rawReleaseDate &&
            typeof rawReleaseDate === "object" &&
            "seconds" in rawReleaseDate
          ? new Date(
              Number((rawReleaseDate as { seconds: number }).seconds) * 1000,
            )
          : null,
    performanceName:
      typeof rawValue.performanceName === "string"
        ? rawValue.performanceName
        : undefined,
    performanceActorName:
      typeof rawValue.performanceActorName === "string"
        ? rawValue.performanceActorName
        : typeof rawValue.performanceName === "string"
          ? rawValue.performanceName
          : undefined,
    performanceCharacterName:
      typeof rawValue.performanceCharacterName === "string"
        ? rawValue.performanceCharacterName
        : undefined,
    performanceImageUrl:
      typeof rawValue.performanceImageUrl === "string"
        ? rawValue.performanceImageUrl
        : undefined,
    nomineeEntryId:
      typeof rawValue.nomineeEntryId === "string"
        ? rawValue.nomineeEntryId
        : undefined,
  };
};

const getErrorMessage = (error: unknown) => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown-error";
};

const toAwardShelfCover = (url?: string, category?: AwardCategory) => {
  if (!url) return url;
  if (!url.includes("igdb.com")) return url;
  return url.replace(
    /\/t_[^/]+\//,
    category === "Game of the Year" ? "/t_1080p/" : "/t_cover_big/",
  );
};

const toStoredShelfGame = (game: ShelfGame, category: AwardCategory) => {
  const performanceActorName =
    category === "Best Performance"
      ? (game.performanceActorName ?? game.performanceName)
      : undefined;
  const performanceCharacterName =
    category === "Best Performance" ? game.performanceCharacterName : undefined;
  const performanceImageUrl =
    category === "Best Performance" ? game.performanceImageUrl : undefined;

  return {
    igdbId: game.igdbId,
    name: game.name,
    cover: toAwardShelfCover(game.cover, category) || game.cover,
    status: game.status ?? "",
    rating: game.rating ?? 0,
    releaseDate: game.releaseDate ?? null,
    ...(performanceActorName
      ? {
          performanceName: performanceActorName,
          performanceActorName,
        }
      : {}),
    ...(performanceCharacterName ? { performanceCharacterName } : {}),
    ...(performanceImageUrl ? { performanceImageUrl } : {}),
    ...(game.nomineeEntryId ? { nomineeEntryId: game.nomineeEntryId } : {}),
  };
};

const createBestPerformanceEntryId = (
  game: Pick<
    ShelfGame,
    | "igdbId"
    | "performanceActorName"
    | "performanceName"
    | "performanceCharacterName"
  >,
  index: number,
) => {
  const actor = (game.performanceActorName ?? game.performanceName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const character = (game.performanceCharacterName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ["perf", game.igdbId, actor || "actor", character || "role", index]
    .filter(Boolean)
    .join("-");
};

const isSameBestPerformanceEntry = (a: ShelfGame, b: ShelfGame) =>
  a.igdbId === b.igdbId &&
  (a.performanceActorName ?? a.performanceName ?? "") ===
    (b.performanceActorName ?? b.performanceName ?? "") &&
  (a.performanceCharacterName ?? "") === (b.performanceCharacterName ?? "");

const normalizeBestPerformanceActorName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeBestPerformanceEntry = (
  winner: ShelfGame | null,
  nominees: ShelfGame[],
): ShelfAwardEntry => {
  const normalizedNominees = nominees.map((nominee, index) => ({
    ...nominee,
    nomineeEntryId:
      nominee.nomineeEntryId ?? createBestPerformanceEntryId(nominee, index),
  }));

  if (!winner) {
    return { winner: null, nominees: normalizedNominees };
  }

  const matchedNominee = normalizedNominees.find((nominee) =>
    isSameBestPerformanceEntry(nominee, winner),
  );

  return {
    winner: matchedNominee
      ? { ...winner, nomineeEntryId: matchedNominee.nomineeEntryId }
      : {
          ...winner,
          nomineeEntryId:
            winner.nomineeEntryId ??
            createBestPerformanceEntryId(winner, normalizedNominees.length),
        },
    nominees: normalizedNominees,
  };
};

function Poster({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className || ""}`}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        onLoad={() => setLoadedSrc(src)}
        className={`h-full w-full ${imgClassName || "object-cover"} transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

function FadeInImage({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800/70" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${imgClassName || "h-full w-full object-contain"} transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}

export default function ShelfPage() {
  const { user, loading: userLoading } = useUser();
  const { navbarLayout } = useUI();
  const today = new Date();
  const currentCalendarYear = today.getFullYear();
  const nominationsOpenDate = new Date(currentCalendarYear, 10, 17, 0, 0, 0, 0);
  const winnersOpenDate = new Date(currentCalendarYear, 11, 10, 0, 0, 0, 0);
  const awardYears = useMemo(() => getAwardYears(), []);
  const [selectedYear, setSelectedYear] = useState<number>(
    awardYears[awardYears.length - 1],
  );
  const [yearDirection, setYearDirection] = useState<1 | -1>(1);
  const [showIntro, setShowIntro] = useState(true);
  const [flickerOn, setFlickerOn] = useState(false);
  const [introAwardLoaded, setIntroAwardLoaded] = useState(false);

  const initialShelfForYear = useMemo(
    () =>
      AWARD_CATEGORIES.reduce((acc, category) => {
        acc[category] = { winner: null, nominees: [] };
        return acc;
      }, {} as ShelfMap),
    [],
  );
  const initialShelves = useMemo(
    () =>
      Object.fromEntries(
        awardYears.map((year) => [year, { ...initialShelfForYear }]),
      ) as ShelfByYear,
    [awardYears, initialShelfForYear],
  );

  const [gamesByYear, setGamesByYear] = useState<ShelfByYear>(initialShelves);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<AwardCategory | null>(
    null,
  );

  useEffect(() => {
    if (modalOpen || !currentCategory) return;
    const id = window.setTimeout(() => setCurrentCategory(null), 220);
    return () => window.clearTimeout(id);
  }, [modalOpen, currentCategory]);

  useEffect(() => {
    if (!user) return;

    const loadShelf = async () => {
      try {
        const yearSnapshots = await Promise.allSettled(
          awardYears.map(async (year) => ({
            year,
            snap: await getDocs(
              collection(
                db,
                "users",
                user.uid,
                "awards",
                String(year),
                "categories",
              ),
            ),
          })),
        );
        const loaded: ShelfByYear = Object.fromEntries(
          awardYears.map((year) => [year, { ...initialShelfForYear }]),
        ) as ShelfByYear;

        yearSnapshots.forEach((result) => {
          if (result.status !== "fulfilled") return;

          const { year, snap } = result.value;
          snap.forEach((d) => {
            const category = getAwardCategoryFromDocId(d.id);
            if (!category) return;

            const data = d.data();
            const winner =
              parseStoredShelfGame(data?.winner) ?? parseStoredShelfGame(data);
            const nominees = Array.isArray(data?.nominees)
              ? (data.nominees
                  .map((nominee) => parseStoredShelfGame(nominee))
                  .filter(Boolean) as ShelfGame[])
              : [];

            loaded[year][category] =
              category === "Best Performance"
                ? normalizeBestPerformanceEntry(winner, nominees)
                : {
                    winner,
                    nominees,
                  };
          });
        });

        setGamesByYear(loaded);
      } catch (error) {
        console.error("Failed to load shelf:", error);
        toast.error(`Failed to load shelf: ${getErrorMessage(error)}`);
      }
    };

    loadShelf();
  }, [user, awardYears, initialShelfForYear]);

  useEffect(() => {
    if (!introAwardLoaded) return;

    const timers = [
      window.setTimeout(() => setFlickerOn(true), 1050),
      window.setTimeout(() => setFlickerOn(false), 1150),
      window.setTimeout(() => setFlickerOn(true), 1230),
      window.setTimeout(() => setFlickerOn(false), 1300),
      window.setTimeout(() => setFlickerOn(true), 1380),
      window.setTimeout(() => setFlickerOn(false), 1460),
      window.setTimeout(() => setShowIntro(false), 1800),
    ];

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [introAwardLoaded]);

  const changeYear = (year: number) => {
    if (year === selectedYear) return;

    setYearDirection(year > selectedYear ? 1 : -1);
    setSelectedYear(year);
  };

  const selectedYearIndex = awardYears.indexOf(selectedYear);

  const filledCount = useMemo(
    () =>
      Object.values(gamesByYear[selectedYear] ?? {}).filter(
        (entry) => !!entry?.winner,
      ).length,
    [gamesByYear, selectedYear],
  );
  const nomineeCategories = useMemo(
    () => AWARD_CATEGORIES.filter((c) => c !== "Game of the Year"),
    [],
  );
  const gamesByCategory = gamesByYear[selectedYear] ?? initialShelfForYear;
  const knownPerformanceImages = useMemo(() => {
    const imageMap: Record<string, string> = {};

    Object.values(gamesByYear).forEach((yearEntries) => {
      Object.values(yearEntries).forEach((entry) => {
        const candidates = [entry.winner, ...entry.nominees].filter(
          Boolean,
        ) as ShelfGame[];

        candidates.forEach((candidate) => {
          const actorName =
            candidate.performanceActorName ?? candidate.performanceName ?? "";
          const imageUrl = candidate.performanceImageUrl ?? "";
          const normalizedActor = normalizeBestPerformanceActorName(actorName);

          if (!normalizedActor || !imageUrl || imageMap[normalizedActor]) {
            return;
          }

          imageMap[normalizedActor] = imageUrl;
        });
      });
    });

    return imageMap;
  }, [gamesByYear]);
  const isCurrentYearSelected = selectedYear === currentCalendarYear;
  const isSelectedYearNominationLocked =
    isCurrentYearSelected && today < nominationsOpenDate;
  const isSelectedYearWinnerLocked =
    isCurrentYearSelected && today < winnersOpenDate;
  const winnerLockMessage = isSelectedYearWinnerLocked
    ? `Winners can be chosen on December 10, ${currentCalendarYear}.`
    : undefined;
  const [winnerCelebration, setWinnerCelebration] =
    useState<WinnerCelebrationState | null>(null);
  const [showConfettiBurst, setShowConfettiBurst] = useState(false);
  const spotlightCelebrationActive =
    !!winnerCelebration && winnerCelebration.category !== "Game of the Year";

  const openModal = (category: AwardCategory) => {
    if (isSelectedYearNominationLocked) return;
    setCurrentCategory(category);
    setModalOpen(true);
  };

  const triggerWinnerCelebration = (category: AwardCategory) => {
    setWinnerCelebration({ category, token: Date.now() });
    window.setTimeout(() => {
      setWinnerCelebration((prev) =>
        prev?.category === category ? null : prev,
      );
    }, 2000);

    if (category === "Game of the Year") {
      setShowConfettiBurst(true);
      window.setTimeout(() => {
        setShowConfettiBurst(false);
      }, 1400);
    }
  };

  const currentCategoryEntry = currentCategory
    ? gamesByCategory[currentCategory]
    : null;

  const saveNominees = async (
    nominees: ShelfGame[],
    extras?: { performanceName?: string },
  ) => {
    if (!user || !currentCategory) return;

    const preparedNominees = nominees.map((nominee) =>
      toStoredShelfGame(nominee, currentCategory),
    );

    try {
      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "awards",
          String(selectedYear),
          "categories",
          getAwardCategoryDocId(currentCategory),
        ),
        {
          winner: currentCategoryEntry?.winner
            ? toStoredShelfGame(currentCategoryEntry.winner, currentCategory)
            : null,
          nominees: preparedNominees,
        },
      );

      setGamesByYear((prev) => ({
        ...prev,
        [selectedYear]: {
          ...(prev[selectedYear] ?? initialShelfForYear),
          [currentCategory]: {
            ...(prev[selectedYear]?.[currentCategory] ?? {
              winner: null,
              nominees: [],
            }),
            nominees: preparedNominees,
          },
        },
      }));
    } catch (error) {
      console.error("Failed to save nominees:", error);
      toast.error(`Failed to save nominees: ${getErrorMessage(error)}`);
    }
  };

  const pickGame = async (
    winner: ShelfGame,
    nominees?: ShelfGame[],
    extras?: { performanceName?: string },
  ) => {
    if (!user || !currentCategory) return;

    const upgradedCover =
      toAwardShelfCover(winner.cover, currentCategory) || winner.cover;
    const preparedNominees = (nominees ?? []).map((nominee) =>
      toStoredShelfGame(nominee, currentCategory),
    );

    try {
      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "awards",
          String(selectedYear),
          "categories",
          getAwardCategoryDocId(currentCategory),
        ),
        {
          winner: {
            ...toStoredShelfGame(
              { ...winner, cover: upgradedCover },
              currentCategory,
            ),
          },
          nominees: preparedNominees,
        },
      );

      setGamesByYear((prev) => ({
        ...prev,
        [selectedYear]: {
          ...(prev[selectedYear] ?? initialShelfForYear),
          [currentCategory]: {
            winner: {
              ...winner,
              cover: upgradedCover,
            },
            nominees: preparedNominees,
          },
        },
      }));

      triggerWinnerCelebration(currentCategory);

      const winnerAnnouncement =
        currentCategory === "Best Performance"
          ? winner.performanceActorName || winner.performanceName
            ? winner.performanceCharacterName
              ? `${winner.performanceActorName || winner.performanceName} as ${winner.performanceCharacterName}`
              : winner.performanceActorName || winner.performanceName
            : winner.name
          : winner.name;

      toast.success(
        <span>
          <span className="text-black pr-1">And the winner of</span>
          <span className="font-bold">{currentCategory}</span>
          <span className="text-black px-1">is</span>
          <span className="font-bold">{winnerAnnouncement}</span>
        </span>,
        { icon: "🎉" },
      );
    } catch (error) {
      console.error("Failed to save shelf game:", error);
      toast.error(`Failed to save game: ${getErrorMessage(error)}`);
    } finally {
      setModalOpen(false);
    }
  };

  const removeGame = async (category: AwardCategory) => {
    if (!user) return;

    try {
      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "awards",
          String(selectedYear),
          "categories",
          getAwardCategoryDocId(category),
        ),
        {
          winner: null,
          nominees: [],
        },
      );
      setGamesByYear((prev) => ({
        ...prev,
        [selectedYear]: {
          ...(prev[selectedYear] ?? initialShelfForYear),
          [category]: {
            winner: null,
            nominees: [],
          },
        },
      }));
      toast.success(
        <span>
          <span className="font-bold pr-1">{category} </span>
          <span className="text-black">is now cleared</span>
        </span>,
      );
    } catch (error) {
      console.error("Failed to remove shelf game:", error);
      toast.error(`Failed to remove game: ${getErrorMessage(error)}`);
    }
  };

  const renderNomineeCard = (category: AwardCategory) => {
    const entry = gamesByCategory[category];
    const game = entry?.winner;
    const nomineeCount = entry?.nominees.length ?? 0;
    const isCelebrating = winnerCelebration?.category === category;
    const isSpotlightCelebrating =
      spotlightCelebrationActive && winnerCelebration?.category === category;
    return (
      <motion.div
        key={category}
        onClick={() => openModal(category)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(category);
          }
        }}
        role="button"
        tabIndex={0}
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={`group relative z-0 w-full overflow-visible rounded-2xl text-left transition-all duration-300 hover:z-40 focus-within:z-40 ${isCelebrating ? "z-60" : ""}`}
      >
        <motion.div
          animate={
            isCelebrating
              ? {
                  scale: isSpotlightCelebrating
                    ? [1, 1.03, 1.018]
                    : [1, 1.018, 1],
                  boxShadow: isSpotlightCelebrating
                    ? [
                        "0 0 0 1px rgba(251,191,36,0.18), 0 12px 28px rgba(0,0,0,0.28)",
                        "0 0 0 1px rgba(251,191,36,0.5), 0 0 38px rgba(251,191,36,0.28), 0 22px 44px rgba(0,0,0,0.42)",
                        "0 0 0 1px rgba(251,191,36,0.26), 0 14px 30px rgba(0,0,0,0.32)",
                      ]
                    : [
                        "0 0 0 1px rgba(251,191,36,0.12), 0 10px 24px rgba(0,0,0,0.24)",
                        "0 0 0 1px rgba(251,191,36,0.3), 0 0 30px rgba(251,191,36,0.16), 0 18px 36px rgba(0,0,0,0.34)",
                        "0 0 0 1px rgba(251,191,36,0.12), 0 10px 24px rgba(0,0,0,0.24)",
                      ],
                }
              : undefined
          }
          transition={{
            duration: isSpotlightCelebrating ? 2 : 0.72,
            ease: "easeOut",
          }}
          className={`relative h-full overflow-visible rounded-2xl border border-amber-200/25 bg-[#08090d] hover:border-amber-200/60 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_16px_36px_rgba(0,0,0,0.38)] ${isSpotlightCelebrating ? "ring-1 ring-amber-200/35" : ""}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18),transparent_58%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_26%,rgba(0,0,0,0.2)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-amber-100/10 to-transparent -translate-x-[125%] transition-transform duration-700 group-hover:translate-x-[125%]" />
          {isSpotlightCelebrating && (
            <motion.div
              initial={{ x: "-120%", opacity: 0 }}
              animate={{ x: ["-120%", "130%"], opacity: [0, 0.85, 0] }}
              transition={{ duration: 1.15, ease: "easeInOut", repeat: 1 }}
              className="pointer-events-none absolute inset-y-0 left-[-20%] w-[55%] skew-x-[-18deg] bg-[linear-gradient(90deg,transparent,rgba(255,251,235,0.75),transparent)] blur-md"
            />
          )}
          <div className="pointer-events-none absolute inset-x-3 bottom-2 h-2 rounded-full bg-black/40 blur-sm" />

          <div className="relative z-10 flex h-full min-h-[120px] items-center gap-3 p-3">
            <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-xl border border-amber-200/25 bg-zinc-900/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-transform duration-300 group-hover:scale-[1.05]">
              <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.45)_100%)]" />
              {game ? (
                <Poster
                  src={
                    category === "Best Performance" && game.performanceImageUrl
                      ? game.performanceImageUrl
                      : game.cover
                  }
                  alt={game.name}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl text-zinc-500">
                  +
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <p className="inline-flex rounded-md border border-amber-200/20 bg-amber-300/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-100/90 wrap-break-words">
                  {category}
                </p>
                <div className="group/info relative z-30">
                  <span
                    tabIndex={0}
                    role="button"
                    aria-label={`About ${category}`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px] text-amber-100/65 transition hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200/30"
                  >
                    <FaInfoCircle />
                  </span>
                  <div className="pointer-events-none absolute left-0 top-7 w-52 rounded-xl border border-amber-200/18 bg-black/92 p-2.5 text-[10px] leading-relaxed text-zinc-200 opacity-0 shadow-[0_18px_38px_rgba(0,0,0,0.42)] transition duration-200 group-hover/info:opacity-100 group-focus-within/info:opacity-100">
                    {AWARD_CATEGORY_DESCRIPTIONS[category]}
                  </div>
                </div>
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug text-white/95 wrap-break-word">
                {game ? game.name : "Select a nominee"}
              </p>
              {category === "Best Performance" &&
                (game?.performanceActorName || game?.performanceName) && (
                  <p className="mt-1 text-[11px] font-medium text-amber-100/90">
                    {game.performanceActorName || game.performanceName}
                  </p>
                )}
              {category === "Best Performance" &&
                game?.performanceCharacterName && (
                  <p className="mt-1 text-[11px] text-zinc-400">
                    as {game.performanceCharacterName}
                  </p>
                )}
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                {game ? "Award Winner" : "Choose nominees"}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                {nomineeCount} nominee{nomineeCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </motion.div>
        {game && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeGame(category);
            }}
            aria-label={`Remove ${category}`}
            className="group absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center gap-0 overflow-hidden rounded-full border border-white/20 bg-black/60 px-0 text-zinc-100 opacity-0 pointer-events-none shadow-lg backdrop-blur-sm transition-all duration-300 ease-out group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:w-28 hover:gap-1.5 hover:rounded-xl hover:border-red-300/60 hover:bg-red-500/25 hover:px-3 hover:text-red-100 focus-visible:w-28 focus-visible:gap-1.5 focus-visible:rounded-xl focus-visible:px-3 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
          >
            <IoCloseCircle size={18} className="shrink-0" />
          </button>
        )}
      </motion.div>
    );
  };

  const bestGame = gamesByCategory["Game of the Year"]?.winner;
  const isGotyCelebrating = winnerCelebration?.category === "Game of the Year";
  const bestCover = bestGame?.cover
    ? toAwardShelfCover(bestGame.cover, "Game of the Year") || bestGame.cover
    : null;

  if (userLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Helmet>
        <title>Awards Shelf • PlayCrew</title>
        <meta
          name="description"
          content="Build and manage your yearly PlayCrew game awards."
        />
      </Helmet>

      <main
        className={`theme-text ${
          navbarLayout === "sidebar"
            ? "pt-15"
            : "px-4 pb-6 pt-20 sm:px-6 lg:px-8 xl:h-svh xl:overflow-hidden xl:pb-3"
        } relative min-h-screen overflow-y-auto bg-[var(--theme-bg)]`}
      >
        <AnimatePresence>
          {showConfettiBurst && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-none fixed inset-0 z-80 overflow-hidden"
            >
              <motion.span
                initial={{ opacity: 0, x: "14vw", y: "-8vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["14vw", "10vw"],
                  y: ["-8vh", "105vh"],
                  rotate: [0, 180],
                }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="absolute top-0 h-3 w-2 rounded-sm bg-amber-300"
              />
              <motion.span
                initial={{ opacity: 0, x: "22vw", y: "-10vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["22vw", "28vw"],
                  y: ["-10vh", "106vh"],
                  rotate: [0, -220],
                }}
                transition={{ duration: 1.18, delay: 0.05, ease: "easeOut" }}
                className="absolute top-0 h-4 w-2 rounded-sm bg-orange-400"
              />
              <motion.span
                initial={{ opacity: 0, x: "31vw", y: "-7vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["31vw", "26vw"],
                  y: ["-7vh", "104vh"],
                  rotate: [0, 210],
                }}
                transition={{ duration: 1.08, delay: 0.08, ease: "easeOut" }}
                className="absolute top-0 h-3 w-2 rounded-sm bg-yellow-100"
              />
              <motion.span
                initial={{ opacity: 0, x: "39vw", y: "-9vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["39vw", "44vw"],
                  y: ["-9vh", "105vh"],
                  rotate: [0, -180],
                }}
                transition={{ duration: 1.22, delay: 0.03, ease: "easeOut" }}
                className="absolute top-0 h-4 w-2 rounded-sm bg-amber-200"
              />
              <motion.span
                initial={{ opacity: 0, x: "48vw", y: "-8vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["48vw", "43vw"],
                  y: ["-8vh", "106vh"],
                  rotate: [0, 240],
                }}
                transition={{ duration: 1.16, delay: 0.1, ease: "easeOut" }}
                className="absolute top-0 h-3 w-2 rounded-sm bg-amber-400"
              />
              <motion.span
                initial={{ opacity: 0, x: "57vw", y: "-9vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["57vw", "62vw"],
                  y: ["-9vh", "104vh"],
                  rotate: [0, -210],
                }}
                transition={{ duration: 1.14, delay: 0.06, ease: "easeOut" }}
                className="absolute top-0 h-4 w-2 rounded-sm bg-orange-300"
              />
              <motion.span
                initial={{ opacity: 0, x: "69vw", y: "-8vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["69vw", "64vw"],
                  y: ["-8vh", "107vh"],
                  rotate: [0, 200],
                }}
                transition={{ duration: 1.12, delay: 0.02, ease: "easeOut" }}
                className="absolute top-0 h-3 w-2 rounded-sm bg-yellow-50"
              />
              <motion.span
                initial={{ opacity: 0, x: "78vw", y: "-10vh", rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: ["78vw", "83vw"],
                  y: ["-10vh", "106vh"],
                  rotate: [0, -190],
                }}
                transition={{ duration: 1.2, delay: 0.07, ease: "easeOut" }}
                className="absolute top-0 h-4 w-2 rounded-sm bg-amber-500"
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(251,191,36,0.26),transparent_42%),radial-gradient(ellipse_at_0%_35%,rgba(245,158,11,0.14),transparent_42%),radial-gradient(ellipse_at_100%_35%,rgba(217,119,6,0.12),transparent_42%),linear-gradient(180deg,rgba(10,8,5,0.92),rgba(6,5,3,0.98))]" />
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.02)_0px,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_36px)] opacity-35" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,transparent_28%,rgba(0,0,0,0.58)_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[960px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.2),rgba(180,83,9,0.1)_46%,transparent_72%)] blur-2xl" />

        <AnimatePresence>
          {showIntro && (
            <motion.div
              key="shelf-intro"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/72 backdrop-blur-[1.5px]"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: flickerOn ? 0.75 : 0.08,
                }}
                transition={{ duration: 0.08 }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,251,235,0.98),rgba(251,191,36,0.38)_24%,rgba(245,158,11,0.2)_42%,transparent_64%)]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.5 : 0.02,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08 }}
                className="absolute left-1/2 top-[12%] h-[56%] w-0.5 -translate-x-1/2 bg-linear-to-b from-transparent via-amber-100 to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.35 : 0.01,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08, delay: 0.015 }}
                className="absolute left-[47%] top-[16%] h-[42%] w-0.5 bg-linear-to-b from-transparent via-amber-50 to-transparent blur-[0.5px]"
              />
              <motion.div
                initial={{ opacity: 0, scaleY: 0.2 }}
                animate={{
                  opacity: flickerOn ? 0.35 : 0.01,
                  scaleY: flickerOn ? 1 : 0.2,
                }}
                transition={{ duration: 0.08, delay: 0.02 }}
                className="absolute left-[53%] top-[18%] h-[40%] w-0.5 bg-linear-to-b from-transparent via-amber-50 to-transparent blur-[0.5px]"
              />
              <div className="relative flex flex-col items-center justify-center gap-5">
                <motion.div
                  initial={{
                    opacity: 0,
                    y: 18,
                    letterSpacing: "0.55em",
                    filter: "blur(12px)",
                  }}
                  animate={{
                    opacity: introAwardLoaded ? 1 : 0,
                    y: introAwardLoaded ? 0 : 18,
                    letterSpacing: introAwardLoaded ? "0.22em" : "0.55em",
                    filter: introAwardLoaded
                      ? "blur(0px) drop-shadow(0 0 26px rgba(251,191,36,0.28))"
                      : "blur(12px)",
                  }}
                  transition={{ duration: 1.05, ease: [0.2, 0.9, 0.2, 1] }}
                  className="relative z-10 text-center"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-amber-200/80 sm:text-[12px]">
                    The PlayCrew Awards
                  </p>
                </motion.div>

                <motion.div
                  initial={{
                    scale: 2.1,
                    opacity: 0.2,
                    filter: "brightness(0.75)",
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    filter: flickerOn
                      ? "brightness(1.95) drop-shadow(0 0 42px rgba(251,191,36,0.92))"
                      : "brightness(1.05) drop-shadow(0 0 28px rgba(245,158,11,0.55))",
                  }}
                  transition={{
                    scale: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.55 },
                    filter: { duration: 0.08 },
                  }}
                  className="relative w-[260px] sm:w-[340px] md:w-[430px] select-none"
                >
                  {!introAwardLoaded && (
                    <div className="absolute inset-0 animate-pulse rounded-full bg-amber-100/10" />
                  )}
                  <img
                    src="/Award.png"
                    alt="Awards intro"
                    onLoad={() => setIntroAwardLoaded(true)}
                    onError={() => setIntroAwardLoaded(true)}
                    className={`h-full w-full object-contain transition-opacity duration-500 ${
                      introAwardLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section
          className="relative z-10 mx-auto flex w-full max-w-[1550px] flex-col gap-3 cursor-default xl:h-full xl:min-h-0"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: showIntro ? 0 : 1, y: showIntro ? 10 : 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <header className="theme-panel-strong shrink-0 overflow-hidden rounded-2xl border backdrop-blur-xl">
            <div className="bg-linear-to-r from-amber-500/34 via-yellow-200/16 to-orange-500/28 px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.34em] text-amber-50 drop-shadow-[0_0_18px_rgba(251,191,36,0.32)]">
                  The PlayCrew Awards
                </p>
                <div className="h-px flex-1 bg-linear-to-r from-amber-200/45 to-transparent" />
              </div>
            </div>
            <div className="border-b border-[var(--theme-border)] px-4 py-3 sm:px-5">
              <div className="theme-surface-alt relative overflow-hidden rounded-2xl border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
                  {awardYears.map((year) => {
                    const isSelected = selectedYear === year;
                    const isNear =
                      Math.abs(awardYears.indexOf(year) - selectedYearIndex) <=
                      1;

                    return (
                      <motion.button
                        key={year}
                        layout
                        type="button"
                        onClick={() => changeYear(year)}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 28,
                          mass: 0.7,
                        }}
                        whileTap={{ scale: 0.97 }}
                        className={`min-w-[72px] rounded-full border px-4 py-2 text-sm font-semibold tracking-[0.08em] transition-all duration-300 ${
                          isSelected
                            ? "border-amber-200/60 bg-[linear-gradient(180deg,rgba(251,191,36,0.22),rgba(251,191,36,0.08))] text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.14),0_12px_26px_rgba(0,0,0,0.28)]"
                            : isNear
                              ? "border-[var(--theme-border)] bg-[var(--theme-panel-alt)] theme-text hover:border-white/18"
                              : "border-[var(--theme-border)] bg-[var(--theme-bg-elevated)] theme-text-muted hover:border-white/15 hover:theme-text"
                        }`}
                      >
                        {year}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 p-4 sm:p-5">
              <div className="max-w-[900px]">
                <div className="flex items-start gap-4">
                  <FadeInImage
                    src="/Title-Award.png"
                    alt="Game awards logo"
                    className="mt-0.5 h-14 w-14 shrink-0 sm:h-16 sm:w-16"
                    imgClassName="h-full w-full object-contain drop-shadow-[0_0_22px_rgba(251,191,36,0.45)]"
                  />
                  <div>
                    <p className="theme-accent-soft-text text-[11px] font-semibold uppercase tracking-[0.32em]">
                      The PlayCrew Awards
                    </p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.h1
                        key={selectedYear}
                        initial={{
                          opacity: 0,
                          y: yearDirection > 0 ? 22 : -22,
                        }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: yearDirection > 0 ? -22 : 22 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                        className="mt-1 capitalize bg-linear-to-r from-white via-amber-50 to-amber-200 bg-clip-text text-2xl font-black text-transparent drop-shadow-[0_0_24px_rgba(251,191,36,0.12)] sm:text-3xl lg:text-4xl"
                      >
                        {selectedYear} Awards Shelf
                      </motion.h1>
                    </AnimatePresence>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={`subtitle-${selectedYear}`}
                        initial={{
                          opacity: 0,
                          y: yearDirection > 0 ? 16 : -16,
                        }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: yearDirection > 0 ? -16 : 16 }}
                        transition={{ duration: 0.24, ease: "easeOut" }}
                        className="theme-text-muted mt-1.5 max-w-152 text-sm lg:text-[15px]"
                      >
                        The Game Awards are cooked. These are the real winners.
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="theme-surface rounded-xl border px-3 py-2 text-right shadow-[0_8px_26px_rgba(0,0,0,0.25)]">
                  <p className="theme-text-muted text-xs uppercase tracking-[0.14em]">
                    Winners Locked
                  </p>
                  <p className="text-xl font-bold text-amber-300">
                    {filledCount}
                    <span className="theme-text-muted pl-1">
                      / {AWARD_CATEGORIES.length}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, y: yearDirection > 0 ? 24 : -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: yearDirection > 0 ? -24 : 24 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative grid gap-3 xl:grid-cols-[420px_minmax(0,1fr)] xl:flex-1 xl:min-h-0"
            >
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className={`theme-panel-strong flex flex-col overflow-hidden rounded-2xl border backdrop-blur-xl xl:min-h-0 ${isSelectedYearNominationLocked ? "pointer-events-none select-none" : ""}`}
              >
                <div className="flex items-center justify-center border-b border-[var(--theme-border)] px-3 py-2.5">
                  <p className="text-md font-bold uppercase tracking-[0.4em] text-amber-100/85">
                    The Game of the Year
                  </p>
                </div>

                <div
                  onClick={() => openModal("Game of the Year")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openModal("Game of the Year");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="group relative block w-full p-3"
                >
                  <motion.div
                    animate={
                      isGotyCelebrating
                        ? {
                            scale: [1, 1.015, 1],
                            boxShadow: [
                              "0 0 0 1px rgba(251,191,36,0.16)",
                              "0 0 0 1px rgba(251,191,36,0.34), 0 0 42px rgba(251,191,36,0.22), 0 22px 50px rgba(0,0,0,0.48)",
                              "0 0 0 1px rgba(251,191,36,0.16)",
                            ],
                          }
                        : undefined
                    }
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="theme-surface relative mx-auto h-[min(48vh,420px)] w-full max-w-[390px] overflow-hidden rounded-2xl border shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.16)] transition-all duration-300 group-hover:border-amber-200/60 group-hover:shadow-[0_0_0_1px_rgba(var(--theme-accent-rgb),0.28),0_18px_40px_rgba(0,0,0,0.35)] sm:h-[min(52vh,500px)] xl:h-[clamp(300px,52vh,620px)]"
                  >
                    <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18),transparent_58%)]" />
                    <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%,rgba(0,0,0,0.24)_100%)]" />
                    <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-r from-transparent via-amber-100/12 to-transparent -translate-x-[125%] transition-transform duration-700 group-hover:translate-x-[125%]" />
                    <div className="absolute inset-0 rounded-2xl">
                      {bestCover ? (
                        <Poster
                          src={bestCover}
                          alt={bestGame?.name || "Best game"}
                          imgClassName="object-cover bg-[var(--theme-bg-elevated)]"
                        />
                      ) : (
                        <div className="theme-text-muted flex h-full flex-col items-center justify-center">
                          <img
                            src="/Award.png"
                            alt="Award trophy"
                            className="mb-2 h-12 w-12 object-contain opacity-90"
                          />
                          <span className="text-sm uppercase tracking-[0.18em]">
                            Choose Winner
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                  {bestGame && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeGame("Game of the Year");
                      }}
                      aria-label={`Remove ${selectedYear} Game of the Year`}
                      className="theme-surface group absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center gap-0 overflow-hidden rounded-full border px-0 theme-text opacity-0 pointer-events-none shadow-lg backdrop-blur-sm transition-all duration-300 ease-out group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:w-28 hover:gap-1.5 hover:rounded-xl hover:border-red-300/60 hover:bg-red-500/25 hover:px-3 hover:text-red-100 focus-visible:w-28 focus-visible:gap-1.5 focus-visible:rounded-xl focus-visible:px-3 focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
                    >
                      <IoCloseCircle size={18} className="shrink-0" />
                    </button>
                  )}
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={`theme-panel flex flex-col overflow-visible rounded-2xl border backdrop-blur-xl xl:min-h-0 xl:max-w-[1120px] ${isSelectedYearNominationLocked ? "pointer-events-none select-none" : ""}`}
              >
                <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-3 py-2.5">
                  <p className="theme-text-muted text-xs uppercase tracking-[0.2em]">
                    {selectedYear} Categories
                  </p>
                  <span className="theme-text-muted text-xs">
                    Tap any card to pick a game
                  </span>
                </div>

                <div className="grid auto-rows-fr gap-2 overflow-x-hidden overflow-y-visible p-3 sm:grid-cols-2 lg:grid-cols-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overflow-x-hidden">
                  {nomineeCategories.map((category) =>
                    renderNomineeCard(category),
                  )}
                </div>
              </motion.section>

              {isSelectedYearNominationLocked && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl border border-amber-200/20 bg-[linear-gradient(180deg,rgba(var(--theme-bg-rgb),0.35),rgba(var(--theme-bg-rgb),0.82))] backdrop-blur-sm">
                  <div className="theme-panel mx-4 max-w-xl rounded-3xl border px-6 py-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                    <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/75">
                      Awards Locked
                    </p>
                    <h3 className="mt-3 text-xl font-semibold text-amber-50 sm:text-2xl">
                      Nominations open on November 17th, {currentCalendarYear}
                    </h3>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.section>

        {currentCategory && (
          <GamePickerModal
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            currentCategory={currentCategory}
            awardYear={selectedYear}
            currentWinner={gamesByCategory[currentCategory]?.winner ?? null}
            currentNominees={gamesByCategory[currentCategory]?.nominees ?? []}
            pickGame={pickGame}
            saveNominees={saveNominees}
            winnerSelectionLocked={isSelectedYearWinnerLocked}
            winnerSelectionLockedMessage={winnerLockMessage}
            theme="shelf"
            knownPerformanceImages={knownPerformanceImages}
          />
        )}
      </main>
    </>
  );
}
