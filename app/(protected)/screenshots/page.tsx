"use client";

import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Cropper, { type Area } from "react-easy-crop";
import {
  FaImages,
  FaFolderOpen,
  FaUpload,
  FaPhotoVideo,
  FaArrowRight,
  FaArrowLeft,
} from "react-icons/fa";
import { FiCheck, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

import { db } from "@/app/lib/firebase";
import { useUI } from "@/app/context/UIContext";
import { useUser } from "@/app/context/UserContext";
import { useGames } from "@/app/context/GameContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import ConfirmModal from "@/app/components/ConfirmModal";
import WheelLockSwitch from "@/app/components/WheelLockSwitch";
import getCroppedImg from "@/app/lib/getCroppedImg";
import ScreenshotsGamePickerModal from "@/app/components/ScreenshotsGamePickerModal";
import { PickerGame } from "@/app/types/trackedGame";

export const dynamic = "force-dynamic";

const FEATURE_KEY = "screenshots_feature_enabled_v1";
const CAROUSEL_ACTIVE_FOLDER_KEY = "screenshots_carousel_active_folder_v1";
const CAROUSEL_WHEEL_ENABLED_KEY = "screenshots_carousel_wheel_enabled_v1";

type Folder = {
  id: string;
  name: string;
  igdbId?: number | null;
  igdbCoverUrl?: string | null;
  coverUrl?: string | null;
  coverPublicId?: string | null;
  customCoverUrl?: string | null;
  customCoverPublicId?: string | null;
  createdAt?: unknown;
};

type Shot = {
  id: string;
  url: string;
  publicId: string;
  bytes?: number;
  createdAt?: unknown;
};

function DecodedCoverImage({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      {!failed && (
        <div
          className={`pointer-events-none absolute inset-0 bg-zinc-800/80 transition-opacity duration-500 ${
            ready ? "opacity-0" : "animate-pulse opacity-100"
          }`}
        />
      )}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={async (event) => {
          const image = event.currentTarget;
          try {
            await image.decode();
          } catch {
            // Reveal after load when explicit decoding is unavailable.
          }
          setReady(true);
        }}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover opacity-0 transition-opacity duration-700 ease-out ${
          ready ? "opacity-100" : ""
        }`}
      />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-xs font-semibold text-zinc-400">
          Image unavailable
        </div>
      )}
    </>
  );
}

const FEATURES = [
  {
    title: "Curated Collections",
    body: "Create one gallery collection per game and keep visuals organized.",
    icon: FaFolderOpen,
  },
  {
    title: "High-Quality Uploads",
    body: "Upload shots, keep only your best captures, remove the rest.",
    icon: FaUpload,
  },
  {
    title: "Featured Cover",
    body: "Set one screenshot as your collection poster/cover.",
    icon: FaPhotoVideo,
  },
];

const sanitizeFolderSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const normalizeFolderName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toHighQualityIgdbCover = (url?: string | null) => {
  if (!url) return null;
  if (!url.includes("igdb.com")) return url;
  return url.replace(/\/t_[^/]+\//, "/t_cover_big_2x/");
};

function ScreenshotsPageContent() {
  const { navbarLayout } = useUI();
  const { user, loading: userLoading } = useUser();
  const { games } = useGames();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [enabled, setEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [featureResolved, setFeatureResolved] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);

  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverAction, setCoverAction] = useState<
    "upload" | "remove" | "game-poster" | null
  >(null);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    () => void | Promise<void>
  >(() => {});

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [wheelScrollEnabled, setWheelScrollEnabled] = useState(false);
  const [isMdUp, setIsMdUp] = useState(false);
  const [customCoverCropSrc, setCustomCoverCropSrc] = useState<string | null>(
    null,
  );
  const [customCoverCrop, setCustomCoverCrop] = useState({ x: 0, y: 0 });
  const [customCoverZoom, setCustomCoverZoom] = useState(1);
  const [customCoverCroppedPixels, setCustomCoverCroppedPixels] =
    useState<Area | null>(null);
  const [savingCroppedCustomCover, setSavingCroppedCustomCover] =
    useState(false);
  const [coverSourceModalOpen, setCoverSourceModalOpen] = useState(false);
  const [coverLink, setCoverLink] = useState("");
  const editCoverInputRef = useRef<HTMLInputElement | null>(null);
  const lastRestoredFolderIdRef = useRef<string | null>(null);
  const [rotationStep, setRotationStep] = useState(0);
  const [isCarouselMoving, setIsCarouselMoving] = useState(false);
  const carouselMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const wheelDeltaRef = useRef(0);
  const lastWheelStepAtRef = useRef(0);
  const [carouselRevealed, setCarouselRevealed] = useState(false);
  const [activeCoverReady, setActiveCoverReady] = useState(false);
  const returnFolderId = searchParams.get("folder");

  const customGamePosters = useMemo(() => {
    const posters = new Map<number, string>();

    games.forEach((game) => {
      const igdbId = game.igdb?.id;
      const cover = game.igdb?.cover;

      if (
        typeof igdbId === "number" &&
        typeof cover === "string" &&
        cover.trim()
      ) {
        posters.set(igdbId, cover);
      }
    });

    return posters;
  }, [games]);

  const carouselFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const slotCount = useMemo(
    () => Math.max(carouselFolders.length, 1),
    [carouselFolders.length],
  );
  const cardBaseWidth = isMdUp ? 304 : 240;
  const cardGap = isMdUp ? 12 : 10;

  const scaleForOffset = (absOffset: number) =>
    absOffset === 0 ? 1 : Math.max(0.62, 1 - absOffset * 0.12);

  const xDistanceForOffset = (offset: number) => {
    if (offset === 0) return 0;

    const absOffset = Math.abs(offset);
    let distance = 0;

    for (let step = 1; step <= absOffset; step += 1) {
      const prevScale = scaleForOffset(step - 1);
      const currScale = scaleForOffset(step);
      distance +=
        (cardBaseWidth * prevScale) / 2 +
        (cardBaseWidth * currScale) / 2 +
        cardGap;
    }

    return Math.sign(offset) * distance;
  };

  const frontFolderIndex = useMemo(() => {
    if (!carouselFolders.length) return -1;
    const step = 360 / slotCount;
    let bestIdx = 0;
    let bestAbs = Number.POSITIVE_INFINITY;

    for (let i = 0; i < carouselFolders.length; i += 1) {
      const raw = i * step - rotationStep * step;
      const normalized = ((((raw + 180) % 360) + 360) % 360) - 180;
      const abs = Math.abs(normalized);
      if (abs < bestAbs) {
        bestAbs = abs;
        bestIdx = i;
      }
    }

    return bestIdx;
  }, [carouselFolders.length, rotationStep, slotCount]);

  const selectedFolder = useMemo(() => {
    if (frontFolderIndex >= 0 && carouselFolders[frontFolderIndex]) {
      return carouselFolders[frontFolderIndex];
    }
    return folders.find((f) => f.id === selectedFolderId) ?? null;
  }, [carouselFolders, folders, frontFolderIndex, selectedFolderId]);
  const selectedGamePoster = selectedFolder?.igdbId
    ? (customGamePosters.get(selectedFolder.igdbId) ?? null)
    : null;

  useEffect(() => {
    const sources = carouselFolders
      .map((folder) =>
        toHighQualityIgdbCover(
          folder.customCoverUrl ??
            (folder.igdbId
              ? customGamePosters.get(folder.igdbId)
              : null) ??
            folder.coverUrl,
        ),
      )
      .filter((source): source is string => Boolean(source));

    sources.forEach((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      void image.decode().catch(() => undefined);
    });
  }, [carouselFolders, customGamePosters]);

  useEffect(
    () => () => {
      if (carouselMotionTimerRef.current) {
        clearTimeout(carouselMotionTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!carouselFolders.length) {
      setSelectedFolderId(null);
      return;
    }
    if (frontFolderIndex < 0 || !carouselFolders[frontFolderIndex]) return;
    const activeId = carouselFolders[frontFolderIndex].id;
    setSelectedFolderId((prev) => (prev === activeId ? prev : activeId));
  }, [carouselFolders, frontFolderIndex]);

  useEffect(() => {
    if (!hydrated || !enabled || frontFolderIndex < 0) return;
    const frontFolder = carouselFolders[frontFolderIndex];
    if (!frontFolder) return;
    sessionStorage.setItem(CAROUSEL_ACTIVE_FOLDER_KEY, frontFolder.id);
  }, [hydrated, enabled, carouselFolders, frontFolderIndex]);

  useEffect(() => {
    const storedWheelEnabled = localStorage.getItem(CAROUSEL_WHEEL_ENABLED_KEY);
    if (storedWheelEnabled !== null) {
      setWheelScrollEnabled(storedWheelEnabled === "1");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.uid) {
      const stored = localStorage.getItem(FEATURE_KEY) === "1";
      setEnabled(stored);
      setFeatureResolved(true);
      return;
    }

    let cancelled = false;

    const resolveFeatureState = async () => {
      const stored = localStorage.getItem(FEATURE_KEY) === "1";
      let nextEnabled = stored;

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data() as
          | {
              features?: { screenshotsFeatureEnabled?: boolean };
            }
          | undefined;

        const cloudEnabled = data?.features?.screenshotsFeatureEnabled;

        if (typeof cloudEnabled === "boolean") {
          nextEnabled = nextEnabled || cloudEnabled;
        }

        if (!nextEnabled) {
          const foldersRef = collection(
            db,
            "users",
            user.uid,
            "screenshotFolders",
          );
          const existing = await getDocs(query(foldersRef, limit(1)));
          if (!existing.empty) nextEnabled = true;
        }

        if (nextEnabled && cloudEnabled !== true) {
          await setDoc(
            userRef,
            {
              features: { screenshotsFeatureEnabled: true },
            },
            { merge: true },
          );
        }
      } catch (error) {
        console.error("Failed to resolve screenshots feature state", error);
      }

      if (cancelled) return;
      setEnabled(nextEnabled);
      localStorage.setItem(FEATURE_KEY, nextEnabled ? "1" : "0");
      setFeatureResolved(true);
    };

    void resolveFeatureState();

    return () => {
      cancelled = true;
    };
  }, [hydrated, user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMdUp(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled || !user) {
      setFolders([]);
      setFoldersLoading(false);
      return;
    }

    setFoldersLoading(true);

    const foldersRef = collection(db, "users", user.uid, "screenshotFolders");
    const q = query(foldersRef, orderBy("createdAt", "desc"));

    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
              }) as Folder,
          )
          .sort((a, b) =>
            (a.name ?? "").localeCompare(b.name ?? "", undefined, {
              sensitivity: "base",
            }),
          );

        setFolders(next);
        setSelectedFolderId((prev) => {
          if (!next.length) return null;
          if (prev && next.some((f) => f.id === prev)) return prev;
          return next[0].id;
        });
        setFoldersLoading(false);
      },
      (err) => {
        console.error("Failed to load screenshot folders", err);
        setFoldersLoading(false);
      },
    );
  }, [enabled, user]);

  useEffect(() => {
    if (!hydrated || !enabled) return;
    if (!folders.length) {
      setCarouselRevealed(true);
      return;
    }

    const preferredFolderId =
      returnFolderId || sessionStorage.getItem(CAROUSEL_ACTIVE_FOLDER_KEY);
    if (!preferredFolderId) {
      setCarouselRevealed(true);
      return;
    }
    if (preferredFolderId === lastRestoredFolderIdRef.current) {
      setCarouselRevealed(true);
      return;
    }

    const storedIndex = folders.findIndex(
      (folder) => folder.id === preferredFolderId,
    );
    if (storedIndex < 0) {
      setCarouselRevealed(true);
      return;
    }

    setCarouselRevealed(false);
    lastRestoredFolderIdRef.current = preferredFolderId;
    setRotationStep(storedIndex);
    setSelectedFolderId(preferredFolderId);
    sessionStorage.setItem(CAROUSEL_ACTIVE_FOLDER_KEY, preferredFolderId);

    const frame = window.requestAnimationFrame(() => {
      setCarouselRevealed(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrated, enabled, folders, returnFolderId]);

  useEffect(() => {
    if (!enabled || !selectedFolder) {
      setActiveCoverReady(false);
      return;
    }

    const coverSrc =
      toHighQualityIgdbCover(
        selectedFolder.customCoverUrl ??
          selectedGamePoster ??
          selectedFolder.coverUrl,
      ) || "/placeholder-game.jpg";

    if (activeCoverReady) {
      // Keep carousel visible during rotation; just warm-load the next cover.
      const img = new Image();
      img.src = coverSrc;
      return;
    }

    let cancelled = false;

    const img = new Image();
    img.onload = () => {
      if (!cancelled) setActiveCoverReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setActiveCoverReady(true);
    };
    img.src = coverSrc;

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    activeCoverReady,
    selectedFolder?.id,
    selectedFolder?.coverUrl,
    selectedFolder?.customCoverUrl,
    selectedGamePoster,
  ]);

  const activeFolderId = selectedFolder?.id ?? selectedFolderId;

  useEffect(() => {
    if (!enabled || !user || !activeFolderId) {
      setShots([]);
      return;
    }

    const shotsRef = collection(
      db,
      "users",
      user.uid,
      "screenshotFolders",
      activeFolderId,
      "shots",
    );
    const q = query(shotsRef, orderBy("createdAt", "desc"));

    return onSnapshot(q, (snap) => {
      const next = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          }) as Shot,
      );
      setShots(next);
    });
  }, [enabled, user, activeFolderId]);

  useEffect(() => {
    if (selectedFolder) {
      setRenameValue(selectedFolder.name);
      setRenaming(false);
    }
  }, [selectedFolder?.id]);

  useEffect(() => {
    if (!renaming) return;
    if (gamePickerOpen || confirmOpen || customCoverCropSrc) {
      setRenaming(false);
    }
  }, [renaming, gamePickerOpen, confirmOpen, customCoverCropSrc]);

  useEffect(
    () => () => {
      if (customCoverCropSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(customCoverCropSrc);
      }
    },
    [customCoverCropSrc],
  );

  const enableFeature = () => {
    if (enabling || !user) return;
    setEnabling(true);
    window.setTimeout(async () => {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            features: { screenshotsFeatureEnabled: true },
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Failed to persist screenshots feature state", error);
      } finally {
        localStorage.setItem(FEATURE_KEY, "1");
        setEnabled(true);
        setFeatureResolved(true);
        setEnabling(false);
      }
    }, 700);
  };

  const createFolder = async (
    nameInput?: string,
    initialCoverUrl?: string,
    igdbId?: number,
  ) => {
    if (!user) return;

    const name = (nameInput ?? folderName).trim();
    if (!name) {
      toast.error("Collection name is required");
      return;
    }

    setCreatingFolder(true);
    try {
      const foldersRef = collection(db, "users", user.uid, "screenshotFolders");
      let createdId: string;

      if (typeof igdbId === "number") {
        // Guard against stale UI state and race-click duplicates.
        const existingByGame = await getDocs(
          query(foldersRef, where("igdbId", "==", igdbId)),
        );
        if (!existingByGame.empty) {
          toast.error("This game is already added.");
          return;
        }

        // Deterministic id prevents duplicate docs for the same game.
        const stableFolderRef = doc(
          db,
          "users",
          user.uid,
          "screenshotFolders",
          `igdb-${igdbId}`,
        );
        const stableDoc = await getDoc(stableFolderRef);
        if (stableDoc.exists()) {
          toast.error("This game is already added.");
          return;
        }

        // Legacy compatibility for old folders without igdbId.
        const allFoldersSnap = await getDocs(foldersRef);
        const duplicateByName = allFoldersSnap.docs.some((folderDoc) => {
          const existingName = String(folderDoc.data()?.name ?? "");
          return (
            normalizeFolderName(existingName) === normalizeFolderName(name)
          );
        });
        if (duplicateByName) {
          toast.error("This game is already added.");
          return;
        }

        await setDoc(stableFolderRef, {
          name,
          slug: sanitizeFolderSlug(name),
          igdbId,
          igdbCoverUrl: toHighQualityIgdbCover(initialCoverUrl),
          coverUrl: toHighQualityIgdbCover(initialCoverUrl),
          coverPublicId: null,
          customCoverUrl: null,
          customCoverPublicId: null,
          createdAt: serverTimestamp(),
        });
        createdId = stableFolderRef.id;
      } else {
        const docRef = await addDoc(foldersRef, {
          name,
          slug: sanitizeFolderSlug(name),
          igdbId: null,
          igdbCoverUrl: toHighQualityIgdbCover(initialCoverUrl),
          coverUrl: toHighQualityIgdbCover(initialCoverUrl),
          coverPublicId: null,
          customCoverUrl: null,
          customCoverPublicId: null,
          createdAt: serverTimestamp(),
        });
        createdId = docRef.id;
      }

      setFolderName("");
      // Keep current selection so "Add" feels additive, not replacing.
      setSelectedFolderId((prev) => prev ?? createdId);
      toast.success("Collection created");
    } catch (err) {
      console.error(err);
      toast.error("Could not create collection");
    } finally {
      setCreatingFolder(false);
    }
  };

  const renameFolder = async () => {
    if (!user || !selectedFolder) return;
    const newName = renameValue.trim();
    if (!newName) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        selectedFolder.id,
      );
      await updateDoc(folderRef, {
        name: newName,
        slug: sanitizeFolderSlug(newName),
      });
      setRenameValue(newName);
      setRenaming(false);
      toast.success("Collection renamed");
    } catch (err) {
      console.error(err);
      toast.error("Could not rename collection");
    }
  };

  const removeCustomCover = async () => {
    if (!user || !selectedFolder) return;

    const customId = selectedFolder.customCoverPublicId ?? null;
    const customUrl = selectedFolder.customCoverUrl ?? null;
    if (!customId && !customUrl) {
      toast.error("No custom cover to remove.");
      return;
    }

    setCoverUploading(true);
    setCoverAction("remove");
    try {
      const shouldRestoreLegacyBase =
        !!customId && selectedFolder.coverPublicId === customId;

      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        selectedFolder.id,
      );
      const restoredBaseCoverUrl = selectedFolder.igdbCoverUrl ?? null;
      await updateDoc(folderRef, {
        customCoverUrl: null,
        customCoverPublicId: null,
        ...(shouldRestoreLegacyBase
          ? {
              coverUrl: restoredBaseCoverUrl,
              coverPublicId: null,
            }
          : {}),
      });

      if (customId && !shots.some((shot) => shot.publicId === customId)) {
        await destroyInCloudinary(customId).catch(() => undefined);
      }

      setRenaming(false);
      toast.success(`${selectedFolder.name}'s custom image removed`);
    } catch (err) {
      console.error(err);
      toast.error("Could not remove custom cover");
    } finally {
      setCoverUploading(false);
      setCoverAction(null);
    }
  };

  const useSavedGamePoster = async () => {
    if (!user || !selectedFolder || !selectedGamePoster) return;

    setCoverUploading(true);
    setCoverAction("game-poster");

    try {
      const oldCustomCoverId = selectedFolder.customCoverPublicId ?? null;
      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        selectedFolder.id,
      );

      await updateDoc(folderRef, {
        customCoverUrl: selectedGamePoster,
        customCoverPublicId: null,
      });

      if (
        oldCustomCoverId &&
        !shots.some((shot) => shot.publicId === oldCustomCoverId)
      ) {
        await destroyInCloudinary(oldCustomCoverId).catch(() => undefined);
      }

      toast.success("Using the game poster from Library");
      setCoverSourceModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not use the saved game poster");
    } finally {
      setCoverUploading(false);
      setCoverAction(null);
    }
  };

  const useCoverFromLink = async () => {
    if (!user || !selectedFolder) return;

    const value = coverLink.trim();
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(value);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Unsupported protocol");
      }
    } catch {
      toast.error("Enter a valid http or https image link");
      return;
    }

    setCoverUploading(true);
    setCoverAction("upload");

    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Image could not be loaded"));
        image.src = parsedUrl.toString();
      });

      const oldCustomCoverId = selectedFolder.customCoverPublicId ?? null;
      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        selectedFolder.id,
      );

      await updateDoc(folderRef, {
        customCoverUrl: parsedUrl.toString(),
        customCoverPublicId: null,
      });

      if (
        oldCustomCoverId &&
        !shots.some((shot) => shot.publicId === oldCustomCoverId)
      ) {
        await destroyInCloudinary(oldCustomCoverId).catch(() => undefined);
      }

      setCoverLink("");
      setCoverSourceModalOpen(false);
      toast.success("Collection cover linked");
    } catch (err) {
      console.error(err);
      toast.error("That image link could not be loaded");
    } finally {
      setCoverUploading(false);
      setCoverAction(null);
    }
  };

  const uploadFolderCover = async (file: File) => {
    if (!user || !selectedFolder) return false;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return false;
    }

    setCoverUploading(true);
    setCoverAction("upload");
    try {
      const assetId = crypto.randomUUID();
      const publicId = `playcrew/users/${user.uid}/screenshots/${selectedFolder.id}/cover-${assetId}`;
      const assetFolder = `playcrew/users/${user.uid}/screenshots/${selectedFolder.id}`;

      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, assetFolder }),
      });
      if (!signRes.ok) throw new Error("Sign request failed");

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
      body.append("file", file);
      body.append("api_key", apiKey);
      body.append("timestamp", String(timestamp));
      body.append("signature", signature);
      body.append("public_id", signedPublicId);
      if (signedAssetFolder) body.append("asset_folder", signedAssetFolder);
      body.append("overwrite", "true");
      body.append("invalidate", "true");

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body },
      );

      const uploadJson = (await uploadRes.json()) as {
        secure_url?: string;
        public_id?: string;
        error?: { message?: string };
      };

      if (!uploadRes.ok || !uploadJson.secure_url || !uploadJson.public_id) {
        throw new Error(
          uploadJson.error?.message || "Cloudinary upload failed",
        );
      }

      const currentCoverId = selectedFolder.coverPublicId ?? null;
      const isCurrentCoverFromShot =
        !!currentCoverId &&
        shots.some((shot) => shot.publicId === currentCoverId);
      const oldCustomCoverId =
        selectedFolder.customCoverPublicId ??
        (currentCoverId && !isCurrentCoverFromShot ? currentCoverId : null);

      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        selectedFolder.id,
      );
      await updateDoc(folderRef, {
        customCoverUrl: uploadJson.secure_url,
        customCoverPublicId: uploadJson.public_id,
      });

      if (
        oldCustomCoverId &&
        oldCustomCoverId !== uploadJson.public_id &&
        !shots.some((shot) => shot.publicId === oldCustomCoverId)
      ) {
        await destroyInCloudinary(oldCustomCoverId).catch(() => undefined);
      }

      toast.success("Collection cover changed");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Could not change cover");
      return false;
    } finally {
      setCoverUploading(false);
      setCoverAction(null);
    }
  };

  const closeCustomCoverCrop = () => {
    setCustomCoverCropSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setCustomCoverCrop({ x: 0, y: 0 });
    setCustomCoverZoom(1);
    setCustomCoverCroppedPixels(null);
  };

  const isGifFile = (file: File) =>
    file.type === "image/gif" || /\.gif$/i.test(file.name);

  const openCustomCoverCrop = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }

    if (isGifFile(file)) {
      toast("GIF covers may affect performance.", { icon: "⚠️" });
      await uploadFolderCover(file);
      return;
    }

    setCustomCoverCropSrc((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCustomCoverCrop({ x: 0, y: 0 });
    setCustomCoverZoom(1);
    setCustomCoverCroppedPixels(null);
  };

  const saveCroppedCustomCover = async () => {
    if (!customCoverCropSrc || !customCoverCroppedPixels) return;

    setSavingCroppedCustomCover(true);
    try {
      const croppedBase64 = await getCroppedImg(
        customCoverCropSrc,
        customCoverCroppedPixels,
        1280,
        0.82,
      );
      const croppedBlob = await fetch(croppedBase64).then((res) => res.blob());
      const croppedFile = new File([croppedBlob], `cover-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      const ok = await uploadFolderCover(croppedFile);
      if (ok) {
        closeCustomCoverCrop();
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not prepare cover crop");
    } finally {
      setSavingCroppedCustomCover(false);
    }
  };

  const destroyInCloudinary = async (publicId: string) => {
    const res = await fetch("/api/cloudinary/destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    });
    if (!res.ok) throw new Error("Cloudinary delete failed");
  };

  const deleteFolder = async () => {
    if (!user || !selectedFolder) return;

    const folderId = selectedFolder.id;
    const shotsToDelete = [...shots];
    setDeletingFolder(true);
    setDeletingFolderId(folderId);
    try {
      for (const shot of shotsToDelete) {
        await destroyInCloudinary(shot.publicId).catch(() => undefined);
        const shotRef = doc(
          db,
          "users",
          user.uid,
          "screenshotFolders",
          folderId,
          "shots",
          shot.id,
        );
        await deleteDoc(shotRef);
      }

      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        folderId,
      );
      await deleteDoc(folderRef);
      toast.success("Collection deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete collection");
    } finally {
      setDeletingFolder(false);
      setDeletingFolderId(null);
    }
  };

  const openConfirmModal = (
    message: string,
    action: () => void | Promise<void>,
  ) => {
    setGamePickerOpen(false);
    setRenaming(false);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const handleAddFolder = async () => {
    setRenaming(false);
    setConfirmOpen(false);
    setGamePickerOpen(true);
  };

  const pickGameForFolder = async (game: PickerGame) => {
    const exists = folders.some((f) => f.igdbId === game.igdbId);
    const existsByName = folders.some(
      (f) => normalizeFolderName(f.name) === normalizeFolderName(game.name),
    );
    if (exists || existsByName) {
      toast.error("This game is already added.");
      return;
    }

    await createFolder(game.name, game.cover, game.igdbId);
    setGamePickerOpen(false);
  };

  const hasRenameChanges =
    !!selectedFolder && renameValue.trim() !== selectedFolder.name.trim();
  const selectedHasRemovableCustomCover = useMemo(() => {
    if (!selectedFolder) return false;
    return (
      !!selectedFolder.customCoverPublicId || !!selectedFolder.customCoverUrl
    );
  }, [selectedFolder]);

  const handleEditFolder = async () => {
    if (!selectedFolder) {
      toast.error("Select a folder first");
      return;
    }
    if (renaming) return;
    setGamePickerOpen(false);
    setConfirmOpen(false);
    setCoverSourceModalOpen(false);
    setCoverLink("");
    setRenaming(true);
  };

  const rotateCarousel = (steps: number) => {
    if (!steps) return;

    setIsCarouselMoving(true);
    setRotationStep((current) => current + steps);

    if (carouselMotionTimerRef.current) {
      clearTimeout(carouselMotionTimerRef.current);
    }

    carouselMotionTimerRef.current = setTimeout(() => {
      setIsCarouselMoving(false);
      carouselMotionTimerRef.current = null;
    }, 480);
  };

  const handleCarouselWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!wheelScrollEnabled) return;
    e.preventDefault();
    if (!carouselFolders.length) return;

    const dominantDelta =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    wheelDeltaRef.current += dominantDelta;

    const now = performance.now();
    if (
      Math.abs(wheelDeltaRef.current) < 42 ||
      now - lastWheelStepAtRef.current < 170
    ) {
      return;
    }

    const direction = wheelDeltaRef.current > 0 ? 1 : -1;
    wheelDeltaRef.current = 0;
    lastWheelStepAtRef.current = now;
    rotateCarousel(direction);
  };

  const setWheelScrollPreference = (next: boolean) => {
    setWheelScrollEnabled(next);
    localStorage.setItem(CAROUSEL_WHEEL_ENABLED_KEY, next ? "1" : "0");
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!hydrated || !featureResolved) {
    return (
      <main
        className={`page-top-offset relative h-svh overflow-hidden bg-[var(--theme-bg)] ${
          navbarLayout === "sidebar" ? "pt-10" : "pt-20"
        } text-white`}
      >
        <div className="mx-auto flex h-[calc(100svh-5rem)] max-w-6xl items-center justify-center px-4">
          <span className="loading loading-dots loading-xl text-cyan-500" />
        </div>
      </main>
    );
  }

  return (
    <>
      <main
        className={`theme-text relative h-svh overflow-hidden bg-[var(--theme-bg)] px-4 sm:px-6 lg:px-8 ${
          navbarLayout === "sidebar" ? "pt-20" : "pt-20"
        } `}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(6,182,212,0.12),transparent_35%),radial-gradient(circle_at_86%_80%,rgba(6,182,212,0.1),transparent_40%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[44px_44px]" />

        <section className="relative h-full w-full">
          {!enabled ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              className="theme-panel-strong rounded-3xl border p-6 shadow-[0_28px_80px_rgba(0,0,0,0.38)] sm:p-8"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/35 bg-cyan-500/10 text-cyan-500">
                <FaImages size={20} />
              </div>
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <h1 className="text-3xl font-bold sm:text-4xl">
                    Screenshot Art Gallery
                  </h1>
                  <p className="theme-text-muted mt-3 max-w-2xl text-sm sm:text-base">
                    Curate your best game captures as if each folder is a
                    private exhibition room.
                  </p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {FEATURES.map((item) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.title}
                          whileHover={{ y: -4 }}
                          className="theme-surface rounded-2xl border p-3.5 transition hover:border-cyan-500/35"
                        >
                          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-500">
                            <Icon size={14} />
                          </div>
                          <p className="theme-text text-sm font-semibold">
                            {item.title}
                          </p>
                          <p className="theme-text-muted mt-1 text-xs">
                            {item.body}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                <div className="theme-surface rounded-2xl border p-5">
                  <p className="text-[11px] uppercase tracking-[0.15em] text-cyan-500/80">
                    Start
                  </p>
                  <p className="theme-text mt-2 text-sm">
                    Enable the gallery workspace to create folders, upload
                    shots, set covers, rename collections, and delete content.
                  </p>
                  <motion.button
                    type="button"
                    onClick={enableFeature}
                    disabled={enabling}
                    whileHover={{ scale: enabling ? 1 : 1.03 }}
                    whileTap={{ scale: enabling ? 1 : 0.97 }}
                    className="mt-6 inline-flex min-w-[186px] items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-500 transition hover:bg-cyan-500/25 disabled:opacity-70"
                  >
                    {enabling ? (
                      <span className="loading loading-dots loading-sm" />
                    ) : (
                      "Enable Gallery"
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="theme-panel relative flex h-[calc(100svh-6.5rem)] flex-col overflow-hidden rounded-3xl border p-4 sm:p-6"
            >
              <header className="mb-4 flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <div className="lg:justify-self-start">
                  <h1 className="theme-text text-lg font-semibold tracking-wide sm:text-xl">
                    Screenshot Collections
                  </h1>
                  <div className="flex items-center gap-2">
                    <p className="theme-text-muted hidden text-xs sm:block">
                      Click arrows or scroll. Click center card to open folder.
                    </p>
                  </div>
                </div>
                <div className="hidden lg:flex lg:justify-center">
                  <div className="theme-surface inline-flex items-center gap-2 rounded-xl border px-3 py-1.5">
                    <span className="theme-text-muted text-[11px] font-semibold uppercase tracking-[0.12em]">
                      Use Scroll Wheel to move
                    </span>
                    <WheelLockSwitch
                      checked={wheelScrollEnabled}
                      onChange={setWheelScrollPreference}
                    />
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-full lg:justify-self-end">
                  <div className="w-full min-w-0 sm:w-auto sm:flex-none">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search collections..."
                      className="theme-surface-alt h-9 w-full rounded-xl border px-3 text-xs theme-text outline-none transition placeholder:text-zinc-500 focus:border-cyan-500/50 sm:w-56"
                    />
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={handleAddFolder}
                      disabled={creatingFolder}
                      className="h-9 shrink-0 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 text-xs font-semibold text-cyan-500 transition hover:bg-cyan-500/20 disabled:opacity-60"
                    >
                      {creatingFolder ? "Adding..." : "Add"}
                    </button>

                    <button
                      type="button"
                      onClick={handleEditFolder}
                      disabled={!selectedFolder || renaming}
                      className="theme-surface theme-hover-surface inline-flex h-9 min-w-[84px] shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-semibold theme-text transition disabled:opacity-45 sm:min-w-[92px] sm:px-4"
                    >
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <FiEdit2 size={11} />
                        <span>Edit</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedFolder) return;
                        openConfirmModal(
                          `Delete ${selectedFolder.name}'s collection and all screenshots?`,
                          deleteFolder,
                        );
                      }}
                      disabled={!selectedFolder || deletingFolder}
                      className="h-9 min-w-[84px] shrink-0 rounded-xl border border-red-300/35 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-45 sm:min-w-24 sm:px-4"
                    >
                      {deletingFolder ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </header>

              {!user ? (
                <p className="theme-text-muted text-sm">
                  You need to be logged in.
                </p>
              ) : (
                <>
                  <div className="theme-surface relative flex min-h-0 flex-1 flex-col rounded-2xl border p-3 sm:p-5">
                    <div
                      className="theme-surface-alt relative z-10 min-h-0 flex-1 select-none overflow-hidden rounded-xl border"
                      onWheel={handleCarouselWheel}
                    >
                      {foldersLoading ? (
                        <div className="flex h-full items-center justify-center">
                          <div className="inline-flex items-center gap-2 text-sm text-zinc-300">
                            <span className="loading loading-dots loading-lg" />
                          </div>
                        </div>
                      ) : !carouselFolders.length ? (
                        <div className="flex h-full items-center justify-center">
                          <p className="text-sm text-zinc-400">
                            {folders.length
                              ? "No matching collections."
                              : "No collections yet. Click Add to create one."}
                          </p>
                        </div>
                      ) : (
                        <div
                          className={`absolute inset-0 flex select-none items-center justify-center transition-opacity duration-200 ${
                            carouselRevealed && activeCoverReady
                              ? "opacity-100"
                              : "opacity-0"
                          } ${
                            carouselRevealed && activeCoverReady
                              ? ""
                              : "pointer-events-none"
                          }`}
                        >
                          {carouselFolders.map((folder, index) => {
                            const isSelected = index === frontFolderIndex;
                            const isDeletingThisFolder =
                              deletingFolder && deletingFolderId === folder.id;
                            const isRemovingCustomThisFolder =
                              coverUploading &&
                              coverAction === "remove" &&
                              selectedFolder?.id === folder.id;
                            const isUploadingCustomThisFolder =
                              coverUploading &&
                              coverAction === "upload" &&
                              selectedFolder?.id === folder.id;
                            const coverSrc =
                              toHighQualityIgdbCover(
                                folder.customCoverUrl ??
                                  (folder.igdbId
                                    ? customGamePosters.get(folder.igdbId)
                                    : null) ??
                                  folder.coverUrl,
                              ) || "/placeholder-game.jpg";
                            const rawOffset = ((index -
                              frontFolderIndex +
                              carouselFolders.length) %
                              carouselFolders.length) as number;
                            const offset =
                              rawOffset > carouselFolders.length / 2
                                ? rawOffset - carouselFolders.length
                                : rawOffset;
                            const absOffset = Math.abs(offset);
                            const isVisible =
                              carouselFolders.length <= 7 || absOffset <= 3;
                            const xDistance = xDistanceForOffset(offset);
                            const scale = scaleForOffset(absOffset);
                            const opacity = Math.max(
                              0,
                              isSelected ? 1 : 1 - absOffset * 0.22,
                            );
                            const y = absOffset * 14;
                            const rotate = offset * -12;

                            return (
                              <motion.div
                                key={folder.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  if (renaming || deletingFolder) return;
                                  if (isSelected) {
                                    sessionStorage.setItem(
                                      CAROUSEL_ACTIVE_FOLDER_KEY,
                                      folder.id,
                                    );
                                    router.push(`/screenshots/${folder.id}`);
                                    return;
                                  }
                                  rotateCarousel(offset);
                                }}
                                onKeyDown={(e) => {
                                  if (renaming || deletingFolder) return;
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (isSelected) {
                                      sessionStorage.setItem(
                                        CAROUSEL_ACTIVE_FOLDER_KEY,
                                        folder.id,
                                      );
                                      router.push(`/screenshots/${folder.id}`);
                                      return;
                                    }
                                    rotateCarousel(offset);
                                  }
                                }}
                                className={`group absolute h-88 w-60 transform-gpu cursor-pointer select-none will-change-transform [backface-visibility:hidden] md:h-112 md:w-76 ${
                                  isVisible ? "" : "pointer-events-none"
                                } ${deletingFolder ? "pointer-events-none" : ""} ${
                                  isDeletingThisFolder ? "opacity-90" : ""
                                }`}
                                initial={false}
                                animate={{
                                  x: xDistance,
                                  y,
                                  scale,
                                  rotateY: rotate,
                                  opacity: isVisible ? opacity : 0,
                                }}
                                transition={{
                                  type: "spring",
                                  stiffness: 260,
                                  damping: 30,
                                  mass: 0.8,
                                }}
                                style={{
                                  zIndex: 120 - absOffset,
                                  willChange: "transform, opacity",
                                }}
                              >
                                <div
                                  className={`absolute inset-0 overflow-hidden rounded-xl border bg-[var(--theme-surface-strong)] transition-[border-color,box-shadow] duration-200 ${
                                    isCarouselMoving
                                      ? "shadow-none"
                                      : "shadow-[var(--theme-shadow)]"
                                  } ${
                                    isSelected
                                      ? "border-cyan-500/80"
                                      : "border-white/15"
                                  }`}
                                >
                                  <DecodedCoverImage
                                    key={coverSrc}
                                    src={coverSrc}
                                  />
                                  {isDeletingThisFolder && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                                      <div className="rounded-xl border border-red-300/35 bg-[var(--theme-surface-strong)] px-5 py-4 text-center shadow-[var(--theme-shadow)]">
                                        <span className="loading loading-spinner loading-md text-red-200" />
                                        <p className="mt-2 text-sm font-semibold text-red-100">
                                          Deleting collection...
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {isRemovingCustomThisFolder && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                                      <div className="rounded-xl border border-red-300/35 bg-[var(--theme-surface-strong)] px-5 py-4 text-center shadow-[var(--theme-shadow)]">
                                        <span className="loading loading-bars loading-sm text-red-200" />
                                        <p className="mt-2 text-sm font-semibold text-red-100">
                                          Removing custom image
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {isUploadingCustomThisFolder && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
                                      <div className="rounded-xl border border-cyan-300/35 bg-[var(--theme-surface-strong)] px-5 py-4 text-center shadow-[var(--theme-shadow)]">
                                        <span className="loading loading-spinner loading-md text-cyan-200" />
                                        <p className="mt-2 text-sm font-semibold text-cyan-100">
                                          Uploading custom image
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {!foldersLoading &&
                        !!carouselFolders.length &&
                        (!carouselRevealed || !activeCoverReady) && (
                          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35">
                            <div className="h-88 w-60 animate-pulse rounded-xl border border-white/15 bg-zinc-800/70 md:h-112 md:w-76" />
                          </div>
                        )}
                    </div>
                    <AnimatePresence>
                      {renaming && selectedFolder && (
                        <>
                          <motion.button
                            type="button"
                            aria-label="Close edit collection modal"
                            onClick={() => {
                              setRenaming(false);
                              setRenameValue(selectedFolder.name);
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="fixed inset-0 z-2100 bg-black/55"
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -26 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -26 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="fixed inset-x-4 top-28 z-2200 mx-auto w-full max-w-[360px] rounded-xl border border-cyan-500/35 bg-[var(--theme-surface-strong)] p-3 shadow-[var(--theme-shadow)] md:absolute md:right-4 md:top-4 md:inset-x-auto md:mx-0 md:z-2200 md:w-[320px]"
                          >
                            <div
                              className="space-y-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-500/85">
                                  Edit Collection
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenaming(false);
                                    setRenameValue(selectedFolder.name);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-zinc-200 transition hover:bg-zinc-800"
                                >
                                  <FiX size={10} />
                                  Close
                                </button>
                              </div>

                              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                                  Cover Actions
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    disabled={coverUploading}
                                    onClick={() =>
                                      setCoverSourceModalOpen(true)
                                    }
                                    className="col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-cyan-500/35 bg-cyan-500/12 px-2.5 text-[11px] font-semibold text-cyan-500 transition hover:bg-cyan-500/22 disabled:opacity-60"
                                  >
                                    <FiPlus size={13} />
                                    {coverUploading && coverAction === "upload"
                                      ? "Uploading..."
                                      : "Add a Custom Image"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      coverUploading ||
                                      !selectedHasRemovableCustomCover
                                    }
                                    onClick={removeCustomCover}
                                    className={`col-span-2 inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-red-300/35 bg-red-500/10 px-2.5 text-[11px] font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-45 ${
                                      !selectedHasRemovableCustomCover
                                        ? "opacity-45"
                                        : ""
                                    }`}
                                  >
                                    <FiTrash2 size={13} />
                                    Remove Custom Image
                                  </button>
                                </div>
                              </div>

                              <input
                                ref={editCoverInputRef}
                                type="file"
                                accept="image/*"
                                disabled={coverUploading}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setCoverSourceModalOpen(false);
                                    void openCustomCoverCrop(file);
                                  }
                                  e.currentTarget.value = "";
                                }}
                              />

                              <AnimatePresence>
                                {coverSourceModalOpen && (
                                  <motion.div
                                    className="fixed inset-0 z-2300 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() =>
                                      setCoverSourceModalOpen(false)
                                    }
                                  >
                                    <motion.div
                                      initial={{
                                        opacity: 0,
                                        scale: 0.96,
                                        y: 12,
                                      }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.96, y: 12 }}
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      className="theme-panel-strong w-full max-w-lg rounded-2xl border p-5 shadow-[var(--theme-shadow)]"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <p className="theme-accent-text text-[10px] font-bold uppercase tracking-[0.18em]">
                                            Cover source
                                          </p>
                                          <h3 className="theme-text mt-1 text-lg font-bold">
                                            Add a Custom Image
                                          </h3>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setCoverSourceModalOpen(false)
                                          }
                                          className="theme-surface flex h-9 w-9 items-center justify-center rounded-lg border"
                                        >
                                          <FiX />
                                        </button>
                                      </div>

                                      <div className="mt-5 grid gap-3">
                                        <button
                                          type="button"
                                          disabled={
                                            coverUploading ||
                                            !selectedGamePoster
                                          }
                                          onClick={useSavedGamePoster}
                                          className="theme-surface theme-hover-accent flex items-center gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                          {selectedGamePoster ? (
                                            <img
                                              src={selectedGamePoster}
                                              alt="Saved game poster"
                                              className="h-14 w-10 rounded-md object-cover"
                                            />
                                          ) : (
                                            <span className="theme-accent-soft-bg flex h-14 w-10 items-center justify-center rounded-md border">
                                              <FaImages />
                                            </span>
                                          )}
                                          <span>
                                            <span className="theme-text block text-sm font-bold">
                                              Take image from your library
                                            </span>
                                            <span className="theme-text-muted mt-1 block text-xs">
                                              {selectedGamePoster
                                                ? "Use the poster path already saved in Firestore."
                                                : "This game has no custom library poster."}
                                            </span>
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={coverUploading}
                                          onClick={() =>
                                            editCoverInputRef.current?.click()
                                          }
                                          className="theme-surface theme-hover-accent flex items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-45"
                                        >
                                          <span className="theme-accent-soft-bg flex h-11 w-11 items-center justify-center rounded-lg border">
                                            <FaUpload />
                                          </span>
                                          <span>
                                            <span className="theme-text block text-sm font-bold">
                                              Browse a file on your PC
                                            </span>
                                            <span className="theme-text-muted mt-1 block text-xs">
                                              Select an image and adjust its
                                              crop.
                                            </span>
                                          </span>
                                        </button>

                                        <div className="theme-surface rounded-xl border p-3">
                                          <label className="theme-text block text-sm font-bold">
                                            Enter an image link
                                          </label>
                                          <div className="mt-2 flex gap-2">
                                            <input
                                              type="url"
                                              value={coverLink}
                                              onChange={(event) =>
                                                setCoverLink(event.target.value)
                                              }
                                              onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                  event.preventDefault();
                                                  void useCoverFromLink();
                                                }
                                              }}
                                              placeholder="https://example.com/poster.jpg"
                                              className="theme-surface-alt theme-text min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs outline-none focus:border-[var(--theme-accent)]"
                                            />
                                            <button
                                              type="button"
                                              disabled={
                                                coverUploading ||
                                                !coverLink.trim()
                                              }
                                              onClick={() =>
                                                void useCoverFromLink()
                                              }
                                              className="theme-accent-bg rounded-lg px-4 text-xs font-bold disabled:opacity-45"
                                            >
                                              Use Link
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div className="rounded-lg border border-white/10 bg-black/35 p-2">
                                <label className="mb-1 block text-left text-[9px] uppercase tracking-[0.14em] text-cyan-500/80">
                                  Collection Name
                                </label>
                                <textarea
                                  value={renameValue}
                                  onChange={(e) =>
                                    setRenameValue(e.target.value)
                                  }
                                  rows={2}
                                  className="w-full resize-none rounded-lg border border-white/20 bg-zinc-900/90 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500/60"
                                />
                              </div>

                              <AnimatePresence>
                                {hasRenameChanges && (
                                  <motion.button
                                    type="button"
                                    onClick={renameFolder}
                                    disabled={coverUploading}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{
                                      duration: 0.18,
                                      ease: "easeOut",
                                    }}
                                    className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-500/18 px-2.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/28 disabled:opacity-50"
                                  >
                                    <FiCheck size={13} />
                                    Save Name
                                  </motion.button>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {carouselFolders.length > 1 && !renaming && (
                      <>
                        <button
                          type="button"
                          onClick={() => rotateCarousel(-1)}
                          className="absolute left-5 top-1/2 z-500 inline-flex -translate-y-1/2 rounded-full border border-white/20 bg-black/65 px-3 py-3 text-xs font-semibold text-white transition hover:border-cyan-500/55 hover:bg-black"
                        >
                          <FaArrowLeft />
                        </button>
                        <button
                          type="button"
                          onClick={() => rotateCarousel(1)}
                          className="absolute right-5 top-1/2 z-500 inline-flex -translate-y-1/2 rounded-full border border-white/20 bg-black/65 px-3 py-3 text-xs font-semibold text-white transition hover:border-cyan-500/55 hover:bg-black"
                        >
                          <FaArrowRight />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </section>
      </main>
      {customCoverCropSrc && (
        <div
          className="fixed inset-0 z-2400 flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            if (savingCroppedCustomCover || coverUploading) return;
            closeCustomCoverCrop();
          }}
        >
          <motion.div
            className="w-full max-w-3xl rounded-2xl border border-cyan-500/25 bg-[var(--theme-surface-strong)] p-4 shadow-[var(--theme-shadow)]"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-500/80">
              Custom Cover Crop
            </p>
            <h3 className="mt-1 text-lg font-bold text-zinc-100">
              Choose Cover Area
            </h3>
            <div className="relative mt-3 h-80 overflow-hidden rounded-xl border border-white/15 bg-black/50">
              <Cropper
                image={customCoverCropSrc}
                crop={customCoverCrop}
                zoom={customCoverZoom}
                aspect={2 / 3}
                onCropChange={setCustomCoverCrop}
                onZoomChange={setCustomCoverZoom}
                onCropComplete={(_, area) => setCustomCoverCroppedPixels(area)}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={customCoverZoom}
              onChange={(e) => setCustomCoverZoom(Number(e.target.value))}
              className="mt-3 w-full accent-cyan-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={savingCroppedCustomCover || coverUploading}
                onClick={closeCustomCoverCrop}
                className="rounded-lg border border-white/20 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  savingCroppedCustomCover ||
                  coverUploading ||
                  !customCoverCroppedPixels
                }
                onClick={saveCroppedCustomCover}
                className="inline-flex min-w-28 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-500 transition hover:bg-cyan-500/25 disabled:opacity-50"
              >
                {savingCroppedCustomCover || coverUploading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Save Cover"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <ScreenshotsGamePickerModal
        open={gamePickerOpen}
        onClose={() => setGamePickerOpen(false)}
        onPick={pickGameForFolder}
        disabledGameIds={folders
          .map((f) => f.igdbId)
          .filter((id): id is number => typeof id === "number")}
      />
      <ConfirmModal
        open={confirmOpen}
        title="Are you sure?"
        message={confirmMessage}
        onConfirm={async () => {
          setConfirmOpen(false);
          await confirmAction();
        }}
        onCancel={() => setConfirmOpen(false)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

export default function ScreenshotsPage() {
  const { navbarLayout } = useUI();

  return (
    <Suspense
      fallback={
        <main
          className={`page-top-offset min-h-screen bg-[var(--theme-bg)] px-4 ${
            navbarLayout === "sidebar" ? "pt-10" : "pt-24"
          } text-white`}
        >
          <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-black/50 p-6">
            <p className="text-zinc-200">Loading screenshots</p>
            <span className="loading loading-dots loading-xl text-cyan-500" />
          </div>
        </main>
      }
    >
      <ScreenshotsPageContent />
    </Suspense>
  );
}
