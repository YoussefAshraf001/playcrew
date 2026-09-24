"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaCloudUploadAlt,
  FaExclamationCircle,
  FaImage,
  FaRegStar,
  FaStar,
  FaTimes,
  FaTrashAlt,
} from "react-icons/fa";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/app/lib/firebase";
import { useUser } from "@/app/context/UserContext";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import getCroppedImg from "@/app/lib/getCroppedImg";
import { useUI } from "@/app/context/UIContext";
import { saveImageLocally, shouldSaveImageLocally, toLocalPathSegment } from "@/app/lib/desktopImageStorage";

type Folder = {
  id: string;
  name: string;
  igdbId?: number | null;
  igdbCoverUrl?: string | null;
  coverUrl?: string | null;
  coverPublicId?: string | null;
  coverSourceShotId?: string | null;
  customCoverUrl?: string | null;
  customCoverPublicId?: string | null;
  customCoverSourceShotId?: string | null;
};

type Shot = {
  id: string;
  url: string;
  publicId: string;
  favorite?: boolean;
  order?: number;
  bytes?: number;
  createdAt?: unknown;
};

type UploadItem = {
  id: string;
  name: string;
  originalBytes: number;
  preparedBytes: number;
  uploadedBytes?: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

type DeleteConfirmState =
  | { mode: "single"; shot: Shot }
  | { mode: "multiple"; shotIds: string[] }
  | null;

const CAROUSEL_ACTIVE_FOLDER_KEY = "screenshots_carousel_active_folder_v1";
const SORT_ORDER_KEY = "screenshots_sort_order_v1";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`;
};

const MAX_UPLOAD_DIMENSION = 2560;
const WEBP_QUALITY = 0.82;
const STATIC_IMAGE_MIME_PREFIX = "image/";
const GIF_MIME = "image/gif";

const replaceExt = (name: string, nextExt: string) => {
  const index = name.lastIndexOf(".");
  if (index <= 0) return `${name}.${nextExt}`;
  return `${name.slice(0, index)}.${nextExt}`;
};

const isStaticImageFile = (file: File) =>
  file.type.startsWith(STATIC_IMAGE_MIME_PREFIX) && file.type !== GIF_MIME;

const compressForUpload = async (file: File): Promise<File> => {
  if (!isStaticImageFile(file)) return file;

  const bitmap = await createImageBitmap(file);
  try {
    const largest = Math.max(bitmap.width, bitmap.height);
    const scale =
      largest > MAX_UPLOAD_DIMENSION ? MAX_UPLOAD_DIMENSION / largest : 1;
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
    });

    if (!compressedBlob) return file;
    if (compressedBlob.size >= file.size * 0.98) return file;

    return new File([compressedBlob], replaceExt(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
};

type FadeInImageProps = {
  src: string;
  alt: string;
  wrapperClassName?: string;
  imgClassName?: string;
  loading?: "eager" | "lazy";
};

function FadeInImage({
  src,
  alt,
  wrapperClassName = "",
  imgClassName = "",
  loading = "lazy",
}: FadeInImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;
  const failed = failedSrc === src;

  return (
    <div className={`relative ${wrapperClassName}`}>
      {!failed && (
        <div
          className={`pointer-events-none absolute inset-0 bg-zinc-800/60 transition-opacity duration-300 ${
            loaded ? "opacity-0" : "animate-pulse opacity-100"
          }`}
        />
      )}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-900/85 text-zinc-300">
          <FaImage size={14} />
          <span className="text-xs font-semibold">Failed</span>
        </div>
      ) : (
        <img
          key={src}
          ref={(image) => {
            if (image?.complete && image.naturalWidth > 0) setLoadedSrc(src);
          }}
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={async (event) => {
            try {
              await event.currentTarget.decode();
            } catch {
              // Reveal after load when explicit decoding is unavailable.
            }
            setLoadedSrc(src);
          }}
          onError={() => setFailedSrc(src)}
          style={{ contentVisibility: "auto" }}
          className={`${imgClassName} opacity-0 transition-[opacity,scale,transform] duration-500 ease-in-out motion-reduce:transition-none ${
            loaded ? "opacity-100" : ""
          }`}
        />
      )}
    </div>
  );
}

export default function ScreenshotFolderPage() {
  const { user, loading, isAdmin } = useUser();
  const { navbarLayout } = useUI();
  const params = useParams<{ id: string }>();
  const folderId = useMemo(() => params?.id ?? "", [params]);

  const [folder, setFolder] = useState<Folder | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const uploadSummary = useMemo(() => {
    const done = uploadItems.filter((item) => item.status === "done").length;
    const errors = uploadItems.filter((item) => item.status === "error").length;
    const totalBytes = uploadItems.reduce(
      (sum, item) => sum + item.preparedBytes,
      0,
    );
    const transferred = uploadItems.reduce(
      (sum, item) =>
        sum +
        item.preparedBytes * (item.status === "done" ? 1 : item.progress / 100),
      0,
    );
    return {
      done,
      errors,
      active: uploadItems.length - done - errors,
      progress: totalBytes
        ? Math.min(100, Math.round((transferred / totalBytes) * 100))
        : 0,
    };
  }, [uploadItems]);
  const [dragOverlayVisible, setDragOverlayVisible] = useState(false);
  const [coverCropShot, setCoverCropShot] = useState<Shot | null>(null);
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCroppedPixels, setCoverCroppedPixels] = useState<Area | null>(
    null,
  );
  const [savingCroppedCover, setSavingCroppedCover] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [favoritingSelected, setFavoritingSelected] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"all" | "favorites">("all");
  const [defaultTab, setDefaultTab] = useState<"all" | "favorites">("all");
  const [sortOrder, setSortOrder] = useState<"manual" | "newest" | "oldest">(
    "newest",
  );
  const [wallpaperSavingId, setWallpaperSavingId] = useState<string | null>(
    null,
  );
  const [wallpaperConfirm, setWallpaperConfirm] = useState<Shot | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SORT_ORDER_KEY);
      setSortOrder(
        stored === "oldest" || stored === "manual" ? stored : "newest",
      );
    } catch {
      // Keep newest first when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      const tab =
        localStorage.getItem("screenshots_default_tab_v1") === "favorites"
          ? "favorites"
          : "all";
      setDefaultTab(tab);
      setActiveTab(tab);
    } catch {
      // Use All Screenshots when browser storage is unavailable.
    }
  }, []);
  const [sizeLoading, setSizeLoading] = useState(false);
  const dragDepthRef = useRef(0);
  const bytesBackfilledRef = useRef<Set<string>>(new Set());
  const pinnedViewerShotIdRef = useRef<string | null>(null);
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  const isUploading = useMemo(
    () => uploadItems.some((item) => item.status === "uploading"),
    [uploadItems],
  );
  const sortedShots = useMemo(() => {
    const visible =
      activeTab === "favorites"
        ? shots.filter((shot) => shot.favorite === true)
        : shots;
    if (sortOrder === "manual") {
      return [...visible].sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER),
      );
    }
    return sortOrder === "oldest" ? [...visible].reverse() : visible;
  }, [shots, activeTab, sortOrder]);
  const favoriteShots = useMemo(
    () => shots.filter((shot) => shot.favorite === true),
    [shots],
  );
  const PAGE_SIZE = 6;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedShots.length / PAGE_SIZE)),
    [sortedShots.length],
  );
  const pagedShots = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedShots.slice(start, start + PAGE_SIZE);
  }, [sortedShots, currentPage]);
  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: Array<number | "dots-left" | "dots-right"> = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) items.push("dots-left");
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push("dots-right");

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);
  const shotIndexById = useMemo(() => {
    const map = new Map<string, number>();
    sortedShots.forEach((shot, idx) => map.set(shot.id, idx));
    return map;
  }, [sortedShots]);
  const viewerShot =
    viewerIndex !== null && sortedShots[viewerIndex]
      ? sortedShots[viewerIndex]
      : null;
  const selectedShotCount = selectedShotIds.length;
  const knownFolderBytes = useMemo(
    () =>
      shots.reduce((sum, shot) => {
        if (typeof shot.bytes === "number" && Number.isFinite(shot.bytes)) {
          return sum + Math.max(0, shot.bytes);
        }
        return sum;
      }, 0),
    [shots],
  );
  const knownSizeCount = useMemo(
    () =>
      shots.filter(
        (shot) =>
          typeof shot.bytes === "number" &&
          Number.isFinite(shot.bytes) &&
          shot.bytes > 0,
      ).length,
    [shots],
  );
  const unknownSizeCount = shots.length - knownSizeCount;
  const sizeDisplayText = useMemo(() => {
    if (sizeLoading)
      return (
        <div className="pl-1">
          <span className="loading loading-bars loading-xs" />
        </div>
      );
    if (knownFolderBytes > 0) return formatBytes(knownFolderBytes);
    if (unknownSizeCount > 0) return "Calculating...";
    return "0 B";
  }, [sizeLoading, knownFolderBytes, unknownSizeCount]);
  const folderSizeTooltip = useMemo(() => {
    if (sizeLoading) return "Loading size from Cloudinary...";
    if (!shots.length) return "Folder size: 0 screenshots";
    const base = `${shots.length} screenshots, ${formatBytes(knownFolderBytes)}`;
    if (unknownSizeCount > 0) {
      return `${base} known size (${unknownSizeCount} older item${unknownSizeCount > 1 ? "s" : ""} without stored size)`;
    }
    return `${base} total`;
  }, [shots.length, knownFolderBytes, unknownSizeCount, sizeLoading]);

  useEffect(() => {
    if (!user || !folderId) return;

    const folderRef = doc(db, "users", user.uid, "screenshotFolders", folderId);
    const unsubscribeFolder = onSnapshot(folderRef, (snap) => {
      if (!snap.exists()) {
        setFolder(null);
        return;
      }
      setFolder({ id: snap.id, ...snap.data() } as Folder);
    });

    const shotsRef = collection(
      db,
      "users",
      user.uid,
      "screenshotFolders",
      folderId,
      "shots",
    );
    const q = query(shotsRef, orderBy("createdAt", "desc"));
    const unsubscribeShots = onSnapshot(q, (snap) => {
      const next = snap.docs.map(
        (d, index) => ({ id: d.id, order: index, ...d.data() }) as Shot,
      );
      setShots(next);
    });

    return () => {
      unsubscribeFolder();
      unsubscribeShots();
    };
  }, [user, folderId]);

  useEffect(() => {
    if (!folderId) return;
    sessionStorage.setItem(CAROUSEL_ACTIVE_FOLDER_KEY, folderId);
  }, [folderId]);

  useEffect(() => {
    if (viewerIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewerIndex(null);
      } else if (event.key === "ArrowLeft" && sortedShots.length > 1) {
        setViewerIndex((prev) => {
          if (prev === null) return null;
          return (prev - 1 + sortedShots.length) % sortedShots.length;
        });
      } else if (event.key === "ArrowRight" && sortedShots.length > 1) {
        setViewerIndex((prev) => {
          if (prev === null) return null;
          return (prev + 1) % sortedShots.length;
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex, sortedShots.length]);

  useEffect(() => {
    if (viewerIndex === null) return;
    if (!sortedShots.length) {
      setViewerIndex(null);
      return;
    }
    if (viewerIndex >= sortedShots.length) {
      setViewerIndex(sortedShots.length - 1);
    }
  }, [sortedShots, viewerIndex]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const pinnedId = pinnedViewerShotIdRef.current;
    if (!pinnedId) return;

    const nextIdx = sortedShots.findIndex((shot) => shot.id === pinnedId);
    if (nextIdx === -1) {
      setViewerIndex(null);
      pinnedViewerShotIdRef.current = null;
      return;
    }
    if (nextIdx !== viewerIndex) {
      setViewerIndex(nextIdx);
    }
    pinnedViewerShotIdRef.current = null;
  }, [sortedShots, viewerIndex]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedShots.length, activeTab, sortOrder, folderId]);

  useEffect(() => {
    if (!galleryScrollRef.current) return;
    galleryScrollRef.current.scrollTop = 0;
  }, [currentPage]);

  useEffect(() => {
    setSelectedShotIds((prev) =>
      prev.filter((id) => shots.some((shot) => shot.id === id)),
    );
  }, [shots]);

  useEffect(() => {
    if (!user || !folderId || !shots.length) return;

    const missing = shots.filter(
      (shot) =>
        (typeof shot.bytes !== "number" || !Number.isFinite(shot.bytes)) &&
        !bytesBackfilledRef.current.has(shot.id),
    );
    if (!missing.length) {
      setSizeLoading(false);
      return;
    }

    const publicIds = missing.map((shot) => shot.publicId).filter(Boolean);
    if (!publicIds.length) {
      setSizeLoading(false);
      return;
    }

    const run = async () => {
      setSizeLoading(true);
      try {
        const res = await fetch("/api/cloudinary/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicIds: publicIds.slice(0, 50) }),
        });
        if (!res.ok) return;

        const data = (await res.json()) as {
          bytesByPublicId?: Record<string, number>;
        };
        const bytesByPublicId = data.bytesByPublicId ?? {};

        const updates = missing
          .map((shot) => ({
            shot,
            bytes: bytesByPublicId[shot.publicId],
          }))
          .filter(
            ({ bytes }) => typeof bytes === "number" && Number.isFinite(bytes),
          );

        await Promise.all(
          updates.map(async ({ shot, bytes }) => {
            const shotRef = doc(
              db,
              "users",
              user.uid,
              "screenshotFolders",
              folderId,
              "shots",
              shot.id,
            );
            await updateDoc(shotRef, { bytes });
          }),
        );

        for (const shot of missing) {
          bytesBackfilledRef.current.add(shot.id);
        }
      } catch (error) {
        console.error("Could not backfill screenshot bytes", error);
      } finally {
        setSizeLoading(false);
      }
    };

    void run();
  }, [shots, user, folderId]);

  const destroyInCloudinary = async (publicId: string) => {
    if (publicId.startsWith("playcrew-local://")) {
      await window.playcrewDesktop?.deleteLocalImage(publicId);
      return;
    }
    const res = await fetch("/api/cloudinary/destroy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    });
    if (!res.ok) throw new Error("Cloudinary delete failed");
  };

  const uploadToCloudinaryWithProgress = (
    cloudName: string,
    body: FormData,
    onProgress: (progress: number) => void,
  ) =>
    new Promise<{
      secure_url?: string;
      public_id?: string;
      bytes?: number;
      error?: { message?: string };
    }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      );

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(Math.max(0, Math.min(100, progress)));
      };

      xhr.onerror = () => reject(new Error("Cloudinary upload failed"));
      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText) as {
            secure_url?: string;
            public_id?: string;
            bytes?: number;
            error?: { message?: string };
          };
          if (xhr.status < 200 || xhr.status >= 300 || response.error) {
            reject(
              new Error(response.error?.message || "Cloudinary upload failed"),
            );
            return;
          }
          resolve(response);
        } catch {
          reject(new Error("Invalid Cloudinary response"));
        }
      };

      xhr.send(body);
    });

  const uploadScreenshot = async (
    file: File,
    uploadFile: File,
    autoSetCover: boolean,
    markCoverSet: () => void,
  ): Promise<boolean> => {
    if (!user || !folderId || !folder) return false;
    if (!isStaticImageFile(file)) {
      toast.error("Only non-GIF image files are allowed");
      return false;
    }

    const uploadId = crypto.randomUUID();
    setUploadItems((prev) => [
      {
        id: uploadId,
        name: file.name,
        originalBytes: file.size,
        preparedBytes: uploadFile.size,
        progress: 0,
        status: "uploading",
      },
      ...prev,
    ]);

    try {
      const assetId = crypto.randomUUID();
      if (isAdmin && await shouldSaveImageLocally("screenshots")) {
        const gameId = toLocalPathSegment(folder.igdbId ?? folderId, "unknown-game");
        const folderName = toLocalPathSegment(folder.name, "screenshots");
        const localUrl = await saveImageLocally("screenshots", ["games", gameId, folderName, "screenshots", assetId], uploadFile);
        const shotsRef = collection(db, "users", user.uid, "screenshotFolders", folderId, "shots");
        const addedShotRef = await addDoc(shotsRef, {
          url: localUrl, publicId: localUrl, favorite: false, order: -Date.now(), bytes: uploadFile.size, createdAt: serverTimestamp(),
        });
        if (autoSetCover) {
          markCoverSet();
          await updateDoc(doc(db, "users", user.uid, "screenshotFolders", folderId), {
            coverUrl: localUrl, coverPublicId: localUrl, coverSourceShotId: addedShotRef.id, customCoverSourceShotId: null,
          });
        }
        setUploadItems((prev) => prev.map((item) => item.id === uploadId
          ? { ...item, progress: 100, uploadedBytes: uploadFile.size, status: "done" }
          : item));
        return true;
      }
      const publicId = `playcrew/users/${user.uid}/screenshots/${folderId}/${assetId}`;
      const assetFolder = `playcrew/users/${user.uid}/screenshots/${folderId}`;

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
      body.append("file", uploadFile);
      body.append("api_key", apiKey);
      body.append("timestamp", String(timestamp));
      body.append("signature", signature);
      body.append("public_id", signedPublicId);
      if (signedAssetFolder) body.append("asset_folder", signedAssetFolder);
      body.append("overwrite", "true");
      body.append("invalidate", "true");

      const uploadJson = await uploadToCloudinaryWithProgress(
        cloudName,
        body,
        (progress) => {
          setUploadItems((prev) =>
            prev.map((item) =>
              item.id === uploadId ? { ...item, progress } : item,
            ),
          );
        },
      );

      if (!uploadJson.secure_url || !uploadJson.public_id) {
        throw new Error(
          uploadJson.error?.message || "Cloudinary upload failed",
        );
      }

      const shotsRef = collection(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        folderId,
        "shots",
      );
      const addedShotRef = await addDoc(shotsRef, {
        url: uploadJson.secure_url,
        publicId: uploadJson.public_id,
        favorite: false,
        order: -Date.now(),
        bytes: uploadJson.bytes ?? uploadFile.size,
        createdAt: serverTimestamp(),
      });

      if (autoSetCover) {
        markCoverSet();
        const folderRef = doc(
          db,
          "users",
          user.uid,
          "screenshotFolders",
          folderId,
        );
        await updateDoc(folderRef, {
          coverUrl: uploadJson.secure_url,
          coverPublicId: uploadJson.public_id,
          coverSourceShotId: addedShotRef.id,
          customCoverSourceShotId: null,
        });
      }

      setUploadItems((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                progress: 100,
                uploadedBytes: uploadJson.bytes ?? item.originalBytes,
                status: "done",
              }
            : item,
        ),
      );
      return true;
    } catch (err) {
      console.error(err);
      setUploadItems((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                status: "error",
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : item,
        ),
      );
      return false;
    }
  };

  const uploadScreenshots = async (files: FileList | File[]) => {
    const items = Array.from(files).filter((file) => isStaticImageFile(file));
    if (!items.length) {
      toast.error("Only non-GIF image files are allowed");
      return;
    }

    const autoCoverIndex = !folder?.coverUrl ? 0 : -1;

    const preparedItems = await Promise.all(
      items.map(async (file) => ({
        original: file,
        prepared: await compressForUpload(file),
      })),
    );

    const results = await Promise.all(
      preparedItems.map(({ original, prepared }, idx) =>
        uploadScreenshot(
          original,
          prepared,
          idx === autoCoverIndex,
          () => undefined,
        ),
      ),
    );

    const failed = results.filter((ok) => !ok).length;
    const successCount = items.length - failed;
    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "1 screenshot uploaded"
          : `${successCount} screenshots uploaded`,
      );
    }
    if (failed > 0) {
      toast.error(
        failed === 1 ? "1 upload failed" : `${failed} uploads failed`,
      );
    }
  };

  const hasDraggedFiles = (event: ReactDragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragOverlayVisible(true);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!dragOverlayVisible) setDragOverlayVisible(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragOverlayVisible(false);
    }
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDragOverlayVisible(false);

    const files = event.dataTransfer.files;
    if (files?.length) {
      void uploadScreenshots(files);
    }
  };

  const saveCroppedCover = async () => {
    if (!user || !folderId || !folder || !coverCropShot || !coverCroppedPixels)
      return;

    setSavingCroppedCover(true);
    try {
      const croppedBase64 = await getCroppedImg(
        coverCropShot.url,
        coverCroppedPixels,
        1280,
        0.82,
      );
      const croppedBlob = await fetch(croppedBase64).then((res) => res.blob());

      const assetId = crypto.randomUUID();
      if (isAdmin && await shouldSaveImageLocally("customGameCovers")) {
        const gameId = toLocalPathSegment(folder.igdbId ?? folderId, "unknown-game");
        const folderName = toLocalPathSegment(folder.name, "screenshots");
        const localUrl = await saveImageLocally("customGameCovers", ["games", gameId, folderName, "game-cover"], croppedBlob);
        const oldCustomCoverId = folder.customCoverPublicId ?? null;
        await updateDoc(doc(db, "users", user.uid, "screenshotFolders", folderId), {
          customCoverUrl: localUrl,
          customCoverPublicId: localUrl,
          customCoverSourceShotId: coverCropShot.id,
        });
        if (oldCustomCoverId && oldCustomCoverId !== localUrl && !shots.some((shot) => shot.publicId === oldCustomCoverId)) {
          await destroyInCloudinary(oldCustomCoverId).catch(() => undefined);
        }
        setCoverCropShot(null);
        toast.success("Custom cover saved locally");
        return;
      }
      const publicId = `playcrew/users/${user.uid}/screenshots/${folderId}/cover-crop-${assetId}`;
      const assetFolder = `playcrew/users/${user.uid}/screenshots/${folderId}`;

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
      body.append("file", croppedBlob, `cover-${Date.now()}.jpg`);
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

      const oldCustomCoverId = folder.customCoverPublicId ?? null;
      const folderRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        folderId,
      );

      await updateDoc(folderRef, {
        customCoverUrl: uploadJson.secure_url,
        customCoverPublicId: uploadJson.public_id,
        customCoverSourceShotId: coverCropShot.id,
      });

      if (
        oldCustomCoverId &&
        oldCustomCoverId !== uploadJson.public_id &&
        !shots.some((shot) => shot.publicId === oldCustomCoverId)
      ) {
        await destroyInCloudinary(oldCustomCoverId).catch(() => undefined);
      }

      setCoverCropShot(null);
      toast.success(
        <span>
          <span className="text-black">Cover for</span>
          <span className="font-bold px-1">{folder.name ?? "Folder"}</span>
          <span className="text-black">was updated successfully</span>
        </span>,
      );
    } catch (err) {
      console.error(err);
      toast.error(
        `Could not set cover: ${
          err instanceof Error && err.message.trim()
            ? err.message
            : "Unknown error"
        }`,
      );
    } finally {
      setSavingCroppedCover(false);
    }
  };

  const deleteShot = async (shot: Shot, options?: { notify?: boolean }) => {
    if (!user || !folderId || !folder) return;
    const notify = options?.notify ?? true;
    try {
      await destroyInCloudinary(shot.publicId);

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

      const shouldClearCustomCover =
        folder.customCoverPublicId === shot.publicId ||
        folder.customCoverSourceShotId === shot.id;
      const shouldClearBaseCover =
        !folder.customCoverPublicId &&
        (folder.coverPublicId === shot.publicId ||
          folder.coverSourceShotId === shot.id);
      if (shouldClearCustomCover || shouldClearBaseCover) {
        const folderRef = doc(
          db,
          "users",
          user.uid,
          "screenshotFolders",
          folderId,
        );
        await updateDoc(folderRef, {
          ...(shouldClearCustomCover
            ? {
                customCoverUrl: null,
                customCoverPublicId: null,
                customCoverSourceShotId: null,
              }
            : {}),
          ...(shouldClearBaseCover
            ? {
                coverUrl: null,
                coverPublicId: null,
                coverSourceShotId: null,
              }
            : {}),
        });
      }

      if (notify) toast.success("Screenshot deleted");
      return true;
    } catch (err) {
      console.error(err);
      if (notify) toast.error("Could not delete screenshot");
      return false;
    }
  };

  const toggleShotFavorite = async (shot: Shot) => {
    if (!user || !folderId) return;

    try {
      if (viewerIndex !== null) {
        pinnedViewerShotIdRef.current = shot.id;
      }
      const shotRef = doc(
        db,
        "users",
        user.uid,
        "screenshotFolders",
        folderId,
        "shots",
        shot.id,
      );
      await updateDoc(shotRef, {
        favorite: !(shot.favorite === true),
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not update favorite");
    }
  };

  const toggleShotSelection = (shotId: string) => {
    setSelectedShotIds((prev) =>
      prev.includes(shotId)
        ? prev.filter((id) => id !== shotId)
        : [...prev, shotId],
    );
  };

  const deleteSelectedShots = async (shotIds = selectedShotIds) => {
    if (!shotIds.length || deletingSelected) return;

    setDeletingSelected(true);
    try {
      const byId = new Map(shots.map((shot) => [shot.id, shot] as const));
      let successCount = 0;
      let failedCount = 0;

      for (const shotId of shotIds) {
        const shot = byId.get(shotId);
        if (!shot) continue;
        const ok = await deleteShot(shot, { notify: false });
        if (ok) successCount += 1;
        else failedCount += 1;
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "1 screenshot deleted"
            : `${successCount} screenshots deleted`,
        );
      }
      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? "1 delete failed"
            : `${failedCount} deletes failed`,
        );
      }
      setSelectedShotIds((prev) => prev.filter((id) => !shotIds.includes(id)));
      setSelectionMode(false);
    } finally {
      setDeletingSelected(false);
    }
  };

  const favoriteSelectedShots = async () => {
    if (!user || !folderId || !selectedShotIds.length || favoritingSelected) {
      return;
    }

    setFavoritingSelected(true);
    try {
      const byId = new Map(shots.map((shot) => [shot.id, shot] as const));
      const toFavorite = selectedShotIds
        .map((shotId) => byId.get(shotId))
        .filter(
          (shot): shot is Shot => shot !== undefined && shot.favorite !== true,
        );

      if (!toFavorite.length) {
        toast("Selected screenshots are already favorited");
        return;
      }

      await Promise.all(
        toFavorite.map((shot) => {
          const shotRef = doc(
            db,
            "users",
            user.uid,
            "screenshotFolders",
            folderId,
            "shots",
            shot.id,
          );
          return updateDoc(shotRef, { favorite: true });
        }),
      );

      toast.success(
        toFavorite.length === 1
          ? "1 screenshot favorited"
          : `${toFavorite.length} screenshots favorited`,
      );
      setSelectedShotIds([]);
      setSelectionMode(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not favorite selected screenshots");
    } finally {
      setFavoritingSelected(false);
    }
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirm || confirmingDelete) return;

    setConfirmingDelete(true);
    try {
      if (deleteConfirm.mode === "single") {
        await deleteShot(deleteConfirm.shot);
      } else {
        await deleteSelectedShots(deleteConfirm.shotIds);
      }
      setDeleteConfirm(null);
    } finally {
      setConfirmingDelete(false);
    }
  };

  const moveScreenshot = async (shotId: string, direction: -1 | 1) => {
    if (!user || !folderId) return;

    const ordered = [...shots].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER),
    );
    const currentIndex = ordered.findIndex((shot) => shot.id === shotId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    [ordered[currentIndex], ordered[targetIndex]] = [
      ordered[targetIndex],
      ordered[currentIndex],
    ];
    setSortOrder("manual");
    setCurrentPage(1);
    try {
      localStorage.setItem(SORT_ORDER_KEY, "manual");
      await Promise.all(
        ordered.map((shot, order) =>
          updateDoc(
            doc(
              db,
              "users",
              user.uid,
              "screenshotFolders",
              folderId,
              "shots",
              shot.id,
            ),
            { order },
          ),
        ),
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not reorder screenshots");
    }
  };

  const setScreenshotAsWallpaper = async (shot: Shot) => {
    if (!user || wallpaperSavingId) return;

    setWallpaperSavingId(shot.id);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        wallpaper: {
          type: "image",
          data: shot.url,
          name: `${folder?.name ?? "Game"} screenshot`,
        },
      });
      toast.success("Screenshot set as site wallpaper");
    } catch (error) {
      console.error(error);
      toast.error("Could not set site wallpaper");
    } finally {
      setWallpaperSavingId(null);
    }
  };

  const confirmWallpaperAction = async () => {
    if (!wallpaperConfirm || wallpaperSavingId) return;
    await setScreenshotAsWallpaper(wallpaperConfirm);
    setWallpaperConfirm(null);
  };

  const renderShotCard = (shot: Shot, tone: "favorite" | "regular") => {
    const idx = shotIndexById.get(shot.id) ?? -1;
    const manualOrder = [...shots].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER),
    );
    const manualIndex = manualOrder.findIndex((item) => item.id === shot.id);
    const activeCoverPublicId =
      folder?.customCoverPublicId ?? folder?.coverPublicId ?? null;
    const activeCoverSourceShotId = folder?.customCoverPublicId
      ? (folder?.customCoverSourceShotId ?? null)
      : (folder?.coverSourceShotId ?? null);
    const isCover =
      activeCoverPublicId === shot.publicId ||
      activeCoverSourceShotId === shot.id;

    return (
      <motion.article
        key={shot.id}
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.985 }}
        className={`group overflow-hidden rounded-[20px] border-2 shadow-[0_18px_45px_rgba(0,0,0,0.4)] ${
          tone === "favorite"
            ? "border-[#83670c] bg-[var(--theme-surface-strong)]"
            : "border-[var(--theme-border)] bg-[var(--theme-surface-strong)]"
        }`}
      >
        <div className="relative">
          <button
            type="button"
            className="relative block w-full text-left"
            onClick={() => {
              if (selectionMode) {
                toggleShotSelection(shot.id);
                return;
              }
              if (idx >= 0) setViewerIndex(idx);
            }}
          >
            <FadeInImage
              src={shot.url}
              alt="Screenshot"
              wrapperClassName="h-48 sm:h-64 lg:h-72 w-full overflow-hidden"
              imgClassName="h-full w-full object-cover scale-100 group-hover:scale-[1.05] motion-reduce:group-hover:scale-100"
            />
            {selectionMode && (
              <span
                className={`absolute right-3 top-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                  selectedShotIds.includes(shot.id)
                    ? "border-cyan-300/60 bg-cyan-500/35 text-cyan-100"
                    : "border-white/30 bg-black/45 text-zinc-200"
                }`}
              >
                {selectedShotIds.includes(shot.id) ? "Selected" : "Select"}
              </span>
            )}
            {isCover && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-300/45 bg-emerald-500/25 px-2 py-0.5 text-[11px] text-emerald-100">
                <FaCheckCircle size={10} /> Cover
              </span>
            )}
          </button>
          {!selectionMode && (
            <div className="absolute right-2 top-2 z-20 flex items-center gap-2 opacity-100 transition-opacity duration-200 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100 motion-reduce:transition-none">
              <div className="flex overflow-hidden rounded-lg border border-white/20 bg-black/75 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => void moveScreenshot(shot.id, -1)}
                  disabled={manualIndex <= 0}
                  aria-label="Move screenshot earlier"
                  title="Move earlier"
                  className="group/control inline-flex h-9 max-w-8 items-center overflow-hidden px-2 text-white transition-[max-width,background-color] duration-200 hover:max-w-24 hover:bg-white/15 focus-visible:max-w-24 disabled:opacity-30"
                >
                  <FaChevronUp size={12} className="shrink-0" aria-hidden="true" />
                  <span className="ml-1.5 translate-x-1 whitespace-nowrap text-[10px] font-semibold opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                    Earlier
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void moveScreenshot(shot.id, 1)}
                  disabled={
                    manualIndex < 0 || manualIndex >= manualOrder.length - 1
                  }
                  aria-label="Move screenshot later"
                  title="Move later"
                  className="group/control inline-flex h-9 max-w-8 items-center overflow-hidden border-l border-white/15 px-2 text-white transition-[max-width,background-color] duration-200 hover:max-w-20 hover:bg-white/15 focus-visible:max-w-20 disabled:opacity-30"
                >
                  <FaChevronDown size={12} className="shrink-0" aria-hidden="true" />
                  <span className="ml-1.5 translate-x-1 whitespace-nowrap text-[10px] font-semibold opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                    Later
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWallpaperConfirm(shot)}
                disabled={wallpaperSavingId !== null}
                aria-label="Set screenshot as site wallpaper"
                title="Set as site wallpaper"
                className="group/control inline-flex h-9 max-w-9 items-center overflow-hidden rounded-lg border border-cyan-300/35 bg-black/75 px-2.5 text-cyan-200 backdrop-blur-sm transition-[max-width,background-color] duration-200 hover:max-w-28 hover:bg-black/90 focus-visible:max-w-28 disabled:opacity-45"
              >
                {wallpaperSavingId === shot.id ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <FaImage size={13} className="shrink-0" aria-hidden="true" />
                )}
                <span className="ml-1.5 translate-x-1 whitespace-nowrap text-[10px] font-semibold opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                  Wallpaper
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleShotFavorite(shot)}
                aria-label={shot.favorite ? "Remove from favorites" : "Add to favorites"}
                title={shot.favorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={shot.favorite === true}
                className={`group/favorite inline-flex h-9 max-w-9 items-center overflow-hidden rounded-lg border bg-black/75 px-2.5 backdrop-blur-sm transition-[max-width,border-color,color,background-color] duration-300 ease-in-out hover:max-w-24 hover:border-[#D4AF37]/80 hover:text-[#FFD76A] focus-visible:max-w-24 focus-visible:text-[#FFD76A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] motion-reduce:transition-none ${
                  shot.favorite
                    ? "border-[#D4AF37]/60 text-[#D4AF37] hover:bg-black/90"
                    : "border-white/20 text-white hover:bg-black/90"
                }`}
              >
                <span aria-hidden="true" className="relative h-3.5 w-3.5 transition-[filter] duration-700 ease-in-out group-hover/favorite:drop-shadow-[0_0_6px_rgba(255,215,106,0.8)] group-focus-visible/favorite:drop-shadow-[0_0_6px_rgba(255,215,106,0.8)] motion-reduce:transition-none">
                  <FaRegStar size={14} className="absolute inset-0" />
                  <FaStar size={14} className={`absolute inset-0 text-[#FFD76A] transition-opacity duration-700 ease-in-out group-hover/favorite:opacity-100 group-focus-visible/favorite:opacity-100 motion-reduce:transition-none ${shot.favorite ? "opacity-100" : "opacity-0"}`} />
                </span>
                <span className="ml-1.5 translate-x-1 whitespace-nowrap text-[10px] font-semibold opacity-0 transition-[opacity,transform] duration-200 group-hover/favorite:translate-x-0 group-hover/favorite:opacity-100 group-focus-visible/favorite:translate-x-0 group-focus-visible/favorite:opacity-100">
                  {shot.favorite ? "Favorited" : "Favorite"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm({ mode: "single", shot })}
                aria-label="Delete screenshot"
                title="Delete screenshot"
                className="group/control inline-flex h-9 max-w-9 items-center overflow-hidden rounded-lg border border-red-300/35 bg-black/75 px-2.5 text-red-200 backdrop-blur-sm transition-[max-width,background-color] duration-200 hover:max-w-20 hover:bg-red-950/90 focus-visible:max-w-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <FaTrashAlt size={13} className="shrink-0" />
                <span className="ml-1.5 translate-x-1 whitespace-nowrap text-[10px] font-semibold opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                  Delete
                </span>
              </button>
            </div>
          )}
        </div>
      </motion.article>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--theme-bg)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <main
        className={`min-h-screen ${
          navbarLayout === "sidebar" ? "pt-15" : "pt-24"
        } bg-[var(--theme-bg)] px-4 text-white`}
      >
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-black/50 p-6">
          <p className="text-zinc-200">You need to be logged in.</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-svh ${
        navbarLayout === "sidebar" ? "pt-15" : "pt-20"
      } bg-[var(--theme-bg)] px-4 text-white sm:px-6 lg:px-8 xl:h-svh xl:overflow-hidden`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOverlayVisible && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="rounded-2xl border border-cyan-500/45 bg-[var(--theme-surface-strong)] px-8 py-6 text-center shadow-[var(--theme-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-500/85">
              Upload
            </p>
            <p className="mt-2 text-2xl font-bold text-cyan-500">Drop Here</p>
            <p className="mt-1 text-sm text-zinc-300">
              Release to upload screenshots
            </p>
          </div>
        </div>
      )}
      <section className="mx-auto max-w-[1800px] rounded-[30px] border border-[var(--theme-border)] bg-[radial-gradient(circle_at_82%_0%,var(--theme-tint-a),transparent_36%),radial-gradient(circle_at_0%_100%,var(--theme-tint-b),transparent_30%),var(--theme-panel)] p-4 shadow-[var(--theme-shadow)] sm:p-6 xl:h-[calc(100svh-5.5rem)]">
        <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-white/12 bg-black/35 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
              Collection
            </p>
            <h1 className="mt-1 text-2xl font-black text-zinc-100">
              {folder?.name ?? (
                <span className="loading loading-bars loading-xs" />
              )}
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Build a visual story from your best captures.
            </p>

            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/45 p-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                Content
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={activeTab === "all"}
                  onClick={() => {
                    setActiveTab("all");
                    setCurrentPage(1);
                    setSelectedShotIds([]);
                    setViewerIndex(null);
                  }}
                  className={`rounded-xl border bg-zinc-900/45 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${activeTab === "all" ? "border-cyan-300/70" : "border-white/12 hover:border-cyan-300/35"}`}
                >
                  <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-400">
                    Screenshots
                  </p>
                  <p className="mt-1 text-lg font-bold text-zinc-100">
                    {shots.length}
                  </p>
                </button>
                <button
                  type="button"
                  aria-pressed={activeTab === "favorites"}
                  onClick={() => {
                    setActiveTab("favorites");
                    setCurrentPage(1);
                    setSelectedShotIds([]);
                    setViewerIndex(null);
                  }}
                  className={`rounded-xl border bg-amber-500/10 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${activeTab === "favorites" ? "border-amber-300/70" : "border-white/12 hover:border-amber-300/35"}`}
                >
                  <p className="text-[10px] uppercase tracking-[0.13em] text-amber-100/80">
                    Favorites
                  </p>
                  <p className="mt-1 text-lg font-bold text-amber-100">
                    {favoriteShots.length}
                  </p>
                </button>
                <label className="col-span-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
                  Open by default
                  <select
                    value={defaultTab}
                    onChange={(event) => {
                      const tab = event.target.value as "all" | "favorites";
                      setDefaultTab(tab);
                      try {
                        localStorage.setItem("screenshots_default_tab_v1", tab);
                      } catch {
                        toast.error(
                          "Could not save the default tab in this browser",
                        );
                      }
                    }}
                    className="rounded-lg border border-white/12 bg-zinc-900 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                  >
                    <option value="all">Screenshots</option>
                    <option value="favorites">Favorites</option>
                  </select>
                </label>
                <div
                  className="col-span-2 rounded-xl border border-white/12 bg-zinc-900/45 p-2"
                  title={folderSizeTooltip}
                >
                  <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-400">
                    Size
                  </p>
                  <p className="mt-1 text-sm font-bold text-zinc-100">
                    {sizeDisplayText}
                  </p>
                </div>
                {selectionMode && (
                  <div className="col-span-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-2">
                    <p className="text-[10px] uppercase tracking-[0.13em] text-cyan-100/80">
                      Selected
                    </p>
                    <p className="mt-1 text-sm font-bold text-cyan-100">
                      {selectedShotCount}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/45 p-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                Actions
              </p>
              <div className="space-y-2">
                <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-4 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/22">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files?.length) uploadScreenshots(files);
                      e.currentTarget.value = "";
                    }}
                  />
                  {isUploading ? (
                    <span className="inline-flex items-center gap-1.5">
                      Uploading
                      <span className="loading loading-dots loading-xs" />
                    </span>
                  ) : (
                    "Add Screenshots"
                  )}
                </label>

                {selectionMode && (
                  <div className="space-y-2 rounded-xl border border-amber-300/20 bg-amber-500/6 p-2">
                    <button
                      type="button"
                      onClick={favoriteSelectedShots}
                      disabled={
                        !selectedShotCount ||
                        favoritingSelected ||
                        deletingSelected
                      }
                      className="h-9 w-full rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-45"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <FaStar size={10} />
                        {favoritingSelected
                          ? "Favoriting..."
                          : `Favorite Selected (${selectedShotCount})`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          mode: "multiple",
                          shotIds: [...selectedShotIds],
                        })
                      }
                      disabled={
                        !selectedShotCount ||
                        deletingSelected ||
                        favoritingSelected
                      }
                      className="h-9 w-full rounded-xl border border-red-300/35 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-45"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <FaTrashAlt size={10} />
                        {deletingSelected
                          ? "Deleting..."
                          : `Delete Selected (${selectedShotCount})`}
                      </span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode((prev) => !prev);
                    setSelectedShotIds([]);
                  }}
                  className={`h-9 w-full rounded-xl border px-3 text-xs font-semibold transition ${
                    selectionMode
                      ? "border-amber-300/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20"
                      : "border-amber-200/25 bg-zinc-900/70 text-zinc-100 hover:border-amber-200/40 hover:bg-zinc-800"
                  }`}
                >
                  {selectionMode ? "Cancel Select" : "Select Multiple"}
                </button>

                <div className="pt-2">
                  <Link
                    href={`/screenshots?folder=${encodeURIComponent(folderId)}`}
                    className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-white/20 bg-zinc-900/80 px-4 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
                  >
                    Back To Collections
                  </Link>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-black/25 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900/35 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  Sort
                  <select
                    value={sortOrder}
                    onChange={(event) => {
                      const value = event.target.value;
                      const order =
                        value === "oldest" || value === "manual"
                          ? value
                          : "newest";
                      setSortOrder(order);
                      setCurrentPage(1);
                      setViewerIndex(null);
                      try {
                        localStorage.setItem(SORT_ORDER_KEY, order);
                      } catch {
                        toast.error(
                          "Could not save the screenshot sort in this browser",
                        );
                      }
                    }}
                    className="rounded-lg bg-zinc-900 p-2"
                  >
                    <option value="manual">Manual order</option>
                    <option value="newest">Newest to oldest</option>
                    <option value="oldest">Oldest to newest</option>
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2 justify-self-center">
                <p className="text-xs text-zinc-300">
                  Favorites: {favoriteShots.length} • Others:{" "}
                  {shots.length - favoriteShots.length}
                </p>
              </div>
              <p className="justify-self-end text-xs text-zinc-400">
                Page {currentPage} of {totalPages}
              </p>
            </div>

            <div
              ref={galleryScrollRef}
              className="min-h-0 flex-1 overflow-y-auto pr-1"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`grid-${activeTab}-${sortOrder}-${currentPage}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {pagedShots.map((shot) =>
                    renderShotCard(
                      shot,
                      shot.favorite ? "favorite" : "regular",
                    ),
                  )}
                </motion.div>
              </AnimatePresence>

              {!sortedShots.length && (
                <div className="flex h-full min-h-[220px] items-center justify-center">
                  <p className="text-sm text-zinc-400">
                    {activeTab === "favorites"
                      ? "No favorites yet. Star a screenshot to add it here."
                      : "No screenshots yet."}
                  </p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {paginationItems.map((item) => {
                  if (item === "dots-left" || item === "dots-right") {
                    return (
                      <span
                        key={item}
                        className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-400"
                      >
                        ...
                      </span>
                    );
                  }

                  const isActive = item === currentPage;
                  return (
                    <button
                      key={`page-${item}`}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition ${
                        isActive
                          ? "border-cyan-300/45 bg-cyan-500/20 text-cyan-100"
                          : "border-white/15 bg-black/35 text-zinc-200 hover:bg-zinc-800"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (confirmingDelete) return;
              setDeleteConfirm(null);
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-red-300/30 bg-[var(--theme-surface-strong)] p-4 shadow-[var(--theme-shadow)]"
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200/85">
                Confirm Delete
              </p>
              <h3 className="mt-1 text-lg font-bold text-zinc-100">
                {deleteConfirm.mode === "single"
                  ? "Delete this screenshot?"
                  : `Delete ${deleteConfirm.shotIds.length} selected screenshots?`}
              </h3>
              <p className="mt-2 text-sm text-zinc-300">
                This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={confirmingDelete}
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-lg border border-white/20 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={confirmingDelete}
                  onClick={confirmDeleteAction}
                  className="inline-flex min-w-28 items-center justify-center rounded-lg border border-red-300/45 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  {confirmingDelete ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {wallpaperConfirm && (
          <motion.div
            className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!wallpaperSavingId) setWallpaperConfirm(null);
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallpaper-confirm-title"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="theme-panel-strong w-full max-w-md overflow-hidden rounded-2xl border border-[var(--theme-border)] shadow-[var(--theme-shadow)]"
            >
              <div className="relative aspect-video overflow-hidden bg-black/35">
                <FadeInImage
                  src={wallpaperConfirm.url}
                  alt="Wallpaper preview"
                  wrapperClassName="absolute inset-0 h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-transparent" />
                <span className="theme-accent-soft-bg absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur-md">
                  <FaImage size={11} aria-hidden="true" /> Site wallpaper
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <h3
                  id="wallpaper-confirm-title"
                  className="theme-text text-lg font-bold"
                >
                  Set this screenshot as your wallpaper?
                </h3>
                <p className="theme-text-muted mt-2 text-sm leading-6">
                  This will replace the wallpaper currently used across the site.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={wallpaperSavingId !== null}
                    onClick={() => setWallpaperConfirm(null)}
                    className="theme-surface theme-hover-surface rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={wallpaperSavingId !== null}
                    onClick={() => void confirmWallpaperAction()}
                    className="theme-accent-bg inline-flex min-w-32 items-center justify-center rounded-lg border px-4 py-2 text-sm font-bold transition hover:brightness-110 disabled:opacity-50"
                  >
                    {wallpaperSavingId ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Set wallpaper"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {coverCropShot && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (savingCroppedCover) return;
              setCoverCropShot(null);
            }}
          >
            <motion.div
              className="w-full max-w-3xl rounded-2xl border border-cyan-500/25 bg-[var(--theme-surface-strong)] p-4 shadow-[var(--theme-shadow)]"
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-500/80">
                Cover Crop
              </p>
              <h3 className="mt-1 text-lg font-bold text-zinc-100">
                Choose Cover Area
              </h3>
              <div className="relative mt-3 h-80 overflow-hidden rounded-xl border border-white/15 bg-black/50">
                <Cropper
                  image={coverCropShot.url}
                  crop={coverCrop}
                  zoom={coverZoom}
                  aspect={2 / 3}
                  onCropChange={setCoverCrop}
                  onZoomChange={setCoverZoom}
                  onCropComplete={(_, area) => setCoverCroppedPixels(area)}
                />
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={coverZoom}
                onChange={(e) => setCoverZoom(Number(e.target.value))}
                className="mt-3 w-full accent-cyan-500"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={savingCroppedCover}
                  onClick={() => setCoverCropShot(null)}
                  className="rounded-lg border border-white/20 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingCroppedCover || !coverCroppedPixels}
                  onClick={saveCroppedCover}
                  className="inline-flex min-w-28 items-center justify-center rounded-lg border border-cyan-500/35 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-500 transition hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  {savingCroppedCover ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Save Cover"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewerShot && (
          <motion.div
            className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/90 p-2 backdrop-blur-md sm:p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setViewerIndex(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.985, y: 8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="theme-panel-strong relative flex h-full max-h-[calc(100svh-1rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border p-2 shadow-[0_28px_100px_rgba(0,0,0,0.7)] sm:max-h-[calc(100svh-2.5rem)] sm:p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-1 pb-3 sm:px-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-100">
                    {folder?.name ?? "Screenshot"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {viewerIndex !== null ? viewerIndex + 1 : 0} of {sortedShots.length}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setWallpaperConfirm(viewerShot)}
                  disabled={wallpaperSavingId !== null}
                  aria-label="Set screenshot as site wallpaper"
                  title="Set as site wallpaper"
                  className="group/control inline-flex h-9 max-w-9 items-center overflow-hidden rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-2.5 text-xs font-semibold text-cyan-100 transition-[max-width,background-color] duration-200 hover:max-w-32 hover:bg-cyan-500/25 focus-visible:max-w-32 disabled:opacity-45"
                >
                  {wallpaperSavingId === viewerShot.id ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <FaImage size={11} className="shrink-0" aria-hidden="true" />
                  )}
                  <span className="ml-2 translate-x-1 whitespace-nowrap pr-1 opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                    Wallpaper
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleShotFavorite(viewerShot)}
                  className={`group/control inline-flex h-9 max-w-9 items-center overflow-hidden rounded-lg border px-2.5 text-xs font-semibold transition-[max-width,background-color] duration-200 hover:max-w-28 focus-visible:max-w-28 ${
                    viewerShot.favorite
                      ? "border-amber-300/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                      : "border-white/50 bg-black text-zinc-100 hover:bg-black/75"
                  }`}
                >
                  {viewerShot.favorite ? (
                    <FaStar size={11} className="shrink-0" />
                  ) : (
                    <FaRegStar size={11} className="shrink-0" />
                  )}
                  <span className="ml-2 translate-x-1 whitespace-nowrap pr-1 opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                    {viewerShot.favorite ? "Favorited" : "Favorite"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({ mode: "single", shot: viewerShot })
                  }
                  className="group/control inline-flex h-9 max-w-9 items-center overflow-hidden rounded-lg border border-red-300/35 bg-red-500/15 px-2.5 text-xs font-semibold text-red-200 transition-[max-width,background-color] duration-200 hover:max-w-24 hover:bg-red-500/25 focus-visible:max-w-24"
                >
                  <FaTrashAlt size={11} className="shrink-0" />
                  <span className="ml-2 translate-x-1 whitespace-nowrap pr-1 opacity-0 transition-[opacity,transform] duration-200 group-hover/control:translate-x-0 group-hover/control:opacity-100 group-focus-visible/control:translate-x-0 group-focus-visible/control:opacity-100">
                    Delete
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewerIndex(null)}
                  aria-label="Close screenshot viewer"
                  title="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-zinc-200 transition hover:bg-white/10"
                >
                  <FaTimes size={13} aria-hidden="true" />
                </button>
                </div>
              </header>
              <div className="relative my-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/45 sm:my-3">
                {sortedShots.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setViewerIndex((prev) => {
                        if (prev === null) return null;
                        return (
                          (prev - 1 + sortedShots.length) % sortedShots.length
                        );
                      })
                    }
                    aria-label="Previous screenshot"
                    className="absolute left-2 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg transition hover:bg-black/90 sm:left-4"
                  >
                    <FaArrowLeft />
                  </button>
                )}
                <motion.div
                  className="flex h-full w-full items-center justify-center"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <FadeInImage
                    src={viewerShot.url}
                    alt="Screenshot preview"
                    loading="eager"
                    wrapperClassName="flex h-full w-full items-center justify-center overflow-hidden rounded-lg"
                    imgClassName="max-h-full max-w-full object-contain"
                  />
                </motion.div>
                {sortedShots.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setViewerIndex((prev) => {
                        if (prev === null) return null;
                        return (prev + 1) % sortedShots.length;
                      })
                    }
                    aria-label="Next screenshot"
                    className="absolute right-2 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-lg transition hover:bg-black/90 sm:right-4"
                  >
                    <FaArrowRight />
                  </button>
                )}
              </div>
              {sortedShots.length > 1 && (
                <div className="shrink-0 overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-2">
                  <div className="flex w-max min-w-full justify-center gap-2">
                    {sortedShots.map((shot, idx) => (
                      <button
                        key={`thumb-${shot.id}`}
                        type="button"
                        onClick={() => setViewerIndex(idx)}
                        className={`h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition sm:h-16 sm:w-28 ${
                          viewerIndex === idx
                            ? "border-cyan-500/70"
                            : "border-white/15 hover:border-white/40"
                        }`}
                      >
                        <FadeInImage
                          src={shot.url}
                          alt="Screenshot thumbnail"
                          wrapperClassName="h-full w-full overflow-hidden"
                          imgClassName="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!!uploadItems.length && (
          <motion.section
            aria-label="Upload Queue"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 z-50 w-[min(calc(100vw-2rem),440px)] overflow-hidden rounded-2xl border border-cyan-300/20 bg-zinc-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-cyan-500/10 to-transparent px-4 py-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${isUploading ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-300" : uploadSummary.errors ? "border-amber-300/25 bg-amber-400/10 text-amber-300" : "border-emerald-300/25 bg-emerald-400/10 text-emerald-300"}`}
              >
                {isUploading ? (
                  <FaCloudUploadAlt size={20} />
                ) : uploadSummary.errors ? (
                  <FaExclamationCircle size={18} />
                ) : (
                  <FaCheckCircle size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-zinc-100">
                  Upload Queue
                </h2>
                <p role="status" className="mt-0.5 text-xs text-zinc-400">
                  {isUploading
                    ? `${uploadSummary.active} uploading · ${uploadSummary.done} complete`
                    : uploadSummary.errors
                      ? `${uploadSummary.done} complete · ${uploadSummary.errors} failed`
                      : "All screenshots uploaded"}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={!queueCollapsed}
                aria-controls="upload-queue-details"
                aria-label={
                  queueCollapsed
                    ? "Expand upload queue"
                    : "Minimize upload queue"
                }
                onClick={() => setQueueCollapsed((prev) => !prev)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {queueCollapsed ? (
                  <FaChevronUp size={12} />
                ) : (
                  <FaChevronDown size={12} />
                )}
              </button>
            </div>
            {isUploading && (
              <div
                role="progressbar"
                aria-label="Overall upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadSummary.progress}
                className="h-1 bg-white/5"
              >
                <div
                  className="h-full bg-cyan-400 transition-[width] duration-300"
                  style={{ width: `${uploadSummary.progress}%` }}
                />
              </div>
            )}
            <div id="upload-queue-details" hidden={queueCollapsed}>
              <div className="flex items-center justify-between px-4 py-3 text-[11px]">
                <span className="font-semibold uppercase tracking-wider text-zinc-500">
                  {uploadItems.length}{" "}
                  {uploadItems.length === 1 ? "screenshot" : "screenshots"}
                </span>
                <span className="font-medium text-cyan-300">
                  {isUploading
                    ? `${uploadSummary.progress}% transferred`
                    : "Upload results"}
                </span>
              </div>
              <div className="max-h-[min(42vh,360px)] space-y-2 overflow-y-auto overscroll-contain px-3 pb-3">
                {uploadItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 ${item.status === "error" ? "border-red-400/20 bg-red-400/5" : "border-white/8 bg-white/[0.025]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 rounded-lg bg-black/25 p-2 ${item.status === "done" ? "text-emerald-300" : item.status === "error" ? "text-red-300" : "text-cyan-300"}`}
                      >
                        {item.status === "done" ? (
                          <FaCheckCircle size={14} />
                        ) : item.status === "error" ? (
                          <FaExclamationCircle size={14} />
                        ) : (
                          <FaImage size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          title={item.name}
                          className="truncate text-xs font-medium text-zinc-100"
                        >
                          {item.name}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {formatBytes(item.originalBytes)} →{" "}
                          {formatBytes(
                            item.uploadedBytes ?? item.preparedBytes,
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-semibold ${item.status === "done" ? "text-emerald-300" : item.status === "error" ? "text-red-300" : "text-cyan-300"}`}
                      >
                        {item.status === "done"
                          ? "Complete"
                          : item.status === "error"
                            ? "Failed"
                            : item.progress >= 100
                              ? "Saving…"
                              : `${item.progress}%`}
                      </span>
                    </div>
                    {item.status === "error" && (
                      <p className="mt-2 break-words text-xs text-red-300/90">
                        {item.error ||
                          "Upload failed. Please try uploading this file again."}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-black/20 px-4 py-3">
                <p className="text-[11px] text-zinc-500">
                  {isUploading
                    ? "Keep this page open while uploading."
                    : "Your queue is up to date."}
                </p>
                <button
                  type="button"
                  disabled={!uploadSummary.done && !uploadSummary.errors}
                  onClick={() =>
                    setUploadItems((prev) =>
                      prev.filter((item) => item.status === "uploading"),
                    )
                  }
                  className="shrink-0 rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {isUploading ? "Clear finished" : "Dismiss"}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
