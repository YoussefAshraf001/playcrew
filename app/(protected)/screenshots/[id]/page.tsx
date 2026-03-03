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
  FaImage,
  FaRegStar,
  FaStar,
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
import getCroppedImg from "@/app/lib/getCroppedImg";

type Folder = {
  id: string;
  name: string;
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

const replaceExt = (name: string, nextExt: string) => {
  const index = name.lastIndexOf(".");
  if (index <= 0) return `${name}.${nextExt}`;
  return `${name.slice(0, index)}.${nextExt}`;
};

const compressForUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;

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
  keepVisibleOnSrcChange?: boolean;
};

function FadeInImage({
  src,
  alt,
  wrapperClassName = "",
  imgClassName = "",
  loading = "lazy",
  keepVisibleOnSrcChange = false,
}: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!keepVisibleOnSrcChange) {
      setLoaded(false);
    }
    setFailed(false);
  }, [src, keepVisibleOnSrcChange]);

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
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`${imgClassName} transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ visibility: loaded ? "visible" : "hidden" }}
        />
      )}
    </div>
  );
}

export default function ScreenshotFolderPage() {
  const { user } = useUser();
  const params = useParams<{ id: string }>();
  const folderId = useMemo(() => params?.id ?? "", [params]);

  const [folder, setFolder] = useState<Folder | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
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
  const [activeShotTab, setActiveShotTab] = useState<"favorites" | "others">(
    "favorites",
  );
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
    const favorites = shots.filter((shot) => shot.favorite === true);
    const regular = shots.filter((shot) => shot.favorite !== true);
    return [...favorites, ...regular];
  }, [shots]);
  const favoriteShots = useMemo(
    () => sortedShots.filter((shot) => shot.favorite === true),
    [sortedShots],
  );
  const regularShots = useMemo(
    () => sortedShots.filter((shot) => shot.favorite !== true),
    [sortedShots],
  );
  const PAGE_SIZE = 6;
  const totalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(
          (activeShotTab === "favorites"
            ? favoriteShots.length
            : regularShots.length) / PAGE_SIZE,
        ),
      ),
    [activeShotTab, favoriteShots.length, regularShots.length],
  );
  const tabShots = useMemo(
    () => (activeShotTab === "favorites" ? favoriteShots : regularShots),
    [activeShotTab, favoriteShots, regularShots],
  );
  const pagedShots = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return tabShots.slice(start, start + PAGE_SIZE);
  }, [tabShots, currentPage]);
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
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Shot);
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
  }, [activeShotTab]);

  useEffect(() => {
    if (favoriteShots.length === 0 && activeShotTab === "favorites") {
      setActiveShotTab("others");
    }
  }, [favoriteShots.length, activeShotTab]);

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
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
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
    const items = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!items.length) {
      toast.error("Only image files are allowed");
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

  const setAsCover = async (shot: Shot) => {
    setCoverCropShot(shot);
    setCoverCrop({ x: 0, y: 0 });
    setCoverZoom(1);
    setCoverCroppedPixels(null);
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
      toast.success("Cover updated");
    } catch (err) {
      console.error(err);
      toast.error("Could not set cover");
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

  const renderShotCard = (shot: Shot, tone: "favorite" | "regular") => {
    const idx = shotIndexById.get(shot.id) ?? -1;
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
        whileHover={{ y: -3 }}
        className={`group overflow-hidden rounded-[20px] border shadow-[0_18px_45px_rgba(0,0,0,0.4)] ${
          tone === "favorite"
            ? "border-amber-300/35 bg-[#1a130f]"
            : "border-white/12 bg-[#101012]"
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
              wrapperClassName="h-72 w-full overflow-hidden"
              imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
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
          <motion.div
            initial={false}
            animate={{
              y: selectionMode ? 72 : 0,
              opacity: selectionMode ? 0 : 1,
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute inset-x-2 bottom-2 z-20 ${selectionMode ? "pointer-events-none" : ""}`}
          >
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/60 p-1 backdrop-blur-sm">
              {isCover ? (
                <span className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-100">
                  Current Cover
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAsCover(shot)}
                  disabled={savingCroppedCover}
                  className="rounded-lg border border-white/15 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-200 transition hover:bg-zinc-800"
                >
                  Set Cover
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleShotFavorite(shot)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${
                  shot.favorite
                    ? "border-amber-300/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                    : "border-white/15 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {shot.favorite ? <FaStar size={10} /> : <FaRegStar size={10} />}
                {shot.favorite ? "Favorited" : "Favorite"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm({ mode: "single", shot })}
                className="inline-flex items-center gap-1 rounded-lg border border-red-300/35 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-500/20"
              >
                <FaTrashAlt size={10} />
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      </motion.article>
    );
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-[#070504] px-4 pt-24 text-white">
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-black/50 p-6">
          <p className="text-zinc-200">You need to be logged in.</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="h-svh overflow-hidden bg-[#070504] px-4 pt-20 text-white sm:px-6 lg:px-8"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOverlayVisible && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="rounded-2xl border border-cyan-500/45 bg-[#120d08]/95 px-8 py-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.62)]">
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
      <section className="mx-auto h-[calc(100svh-5.5rem)] max-w-[1700px] rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_82%_0%,rgba(251,191,36,0.12),transparent_36%),radial-gradient(circle_at_0%_100%,rgba(6,182,212,0.14),transparent_30%),#08090d] p-4 shadow-[0_26px_90px_rgba(0,0,0,0.6)] sm:p-6">
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
                <div className="rounded-xl border border-white/12 bg-zinc-900/45 p-2">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-400">
                    Screenshots
                  </p>
                  <p className="mt-1 text-lg font-bold text-zinc-100">
                    {shots.length}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-2">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-amber-100/80">
                    Favorites
                  </p>
                  <p className="mt-1 text-lg font-bold text-amber-100">
                    {favoriteShots.length}
                  </p>
                </div>
                <div
                  className="col-span-2 rounded-xl border border-white/12 bg-zinc-900/45 p-2"
                  title={folderSizeTooltip}
                >
                  <p className="text-[10px] uppercase tracking-[0.13em] text-zinc-400">
                    Known Size
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
                    accept="image/*"
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
            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-white/10 bg-zinc-900/35 px-3 py-2">
              <div />
              <div className="flex items-center gap-2 justify-self-center">
                {favoriteShots.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveShotTab("favorites")}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                        activeShotTab === "favorites"
                          ? "border-amber-300/45 bg-amber-500/20 text-amber-100"
                          : "border-white/15 bg-black/30 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      Favorites ({favoriteShots.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveShotTab("others")}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                        activeShotTab === "others"
                          ? "border-cyan-300/45 bg-cyan-500/20 text-cyan-100"
                          : "border-white/15 bg-black/30 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      Others ({regularShots.length})
                    </button>
                  </>
                )}
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
                  key={`grid-page-${currentPage}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {pagedShots.map((shot) =>
                    renderShotCard(
                      shot,
                      activeShotTab === "favorites" ? "favorite" : "regular",
                    ),
                  )}
                </motion.div>
              </AnimatePresence>

              {!tabShots.length && (
                <div className="flex h-full min-h-[220px] items-center justify-center">
                  <p className="text-sm text-zinc-400">
                    {activeShotTab === "favorites"
                      ? "No favorited screenshots yet."
                      : "No non-favorite screenshots yet."}
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
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (confirmingDelete) return;
              setDeleteConfirm(null);
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border border-red-300/30 bg-[#0d0b0a]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.62)]"
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
              className="w-full max-w-3xl rounded-2xl border border-cyan-500/25 bg-[#0b0908]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.62)]"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 mt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewerIndex(null)}
          >
            <div
              className="relative flex max-h-[96vh] w-full max-w-[1320px] flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute right-2 top-2 z-20 flex items-center gap-2 px-4 py-2 bg-zinc-900/85 rounded-2xl">
                <button
                  type="button"
                  onClick={() => toggleShotFavorite(viewerShot)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                    viewerShot.favorite
                      ? "border-amber-300/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                      : "border-white/50 bg-black text-zinc-100 hover:bg-black/75"
                  }`}
                >
                  {viewerShot.favorite ? (
                    <FaStar size={11} />
                  ) : (
                    <FaRegStar size={11} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({ mode: "single", shot: viewerShot })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300/35 bg-red-500/15 px-2.5 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/25"
                >
                  <FaTrashAlt size={11} />
                </button>
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center">
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
                    className="absolute left-2 z-10 rounded-full border border-white/20 bg-black/60 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black/80"
                  >
                    <FaArrowLeft />
                  </button>
                )}
                <motion.div
                  className="max-h-[82vh] max-w-[96vw] rounded-lg object-contain shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <FadeInImage
                    src={viewerShot.url}
                    alt="Screenshot preview"
                    loading="eager"
                    keepVisibleOnSrcChange
                    wrapperClassName="max-h-[82vh] max-w-[96vw] overflow-hidden rounded-lg"
                    imgClassName="max-h-[82vh] max-w-[96vw] object-contain"
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
                    className="absolute right-2 z-10 rounded-full border border-white/20 bg-black/60 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black/80"
                  >
                    <FaArrowRight />
                  </button>
                )}
              </div>
              {sortedShots.length > 1 && (
                <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/45 p-2">
                  <div className="flex justify-center gap-2">
                    {sortedShots.map((shot, idx) => (
                      <button
                        key={`thumb-${shot.id}`}
                        type="button"
                        onClick={() => setViewerIndex(idx)}
                        className={`h-16 w-28 shrink-0 overflow-hidden rounded-md border transition ${
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!!uploadItems.length && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,440px)] overflow-hidden rounded-xl border border-white/15 bg-zinc-950/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-300">
              Upload Queue
            </p>
            <button
              type="button"
              className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] text-zinc-300 transition hover:bg-white/10"
              onClick={() =>
                setUploadItems((prev) =>
                  prev.filter((item) => item.status === "uploading"),
                )
              }
            >
              Clear Finished
            </button>
          </div>
          <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
            {uploadItems.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-white/10 bg-black/35 p-2"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-zinc-100">
                    {item.name}
                  </p>
                  <p className="shrink-0 whitespace-nowrap text-[11px] text-zinc-300">
                    {formatBytes(item.originalBytes)}
                    {" -> "}
                    {item.uploadedBytes
                      ? formatBytes(item.uploadedBytes)
                      : formatBytes(item.preparedBytes)}
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/70">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.status === "error"
                        ? "bg-red-400"
                        : item.status === "done"
                          ? "bg-emerald-400"
                          : "bg-cyan-500"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
