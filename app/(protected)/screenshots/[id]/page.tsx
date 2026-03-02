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
  customCoverUrl?: string | null;
  customCoverPublicId?: string | null;
};

type Shot = {
  id: string;
  url: string;
  publicId: string;
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

export default function ScreenshotFolderPage() {
  const { user } = useUser();
  const params = useParams<{ id: string }>();
  const folderId = useMemo(() => params?.id ?? "", [params]);

  const [folder, setFolder] = useState<Folder | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [sortMode, setSortMode] = useState<"recent" | "uploadDate">("recent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
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
  const dragDepthRef = useRef(0);
  const isUploading = useMemo(
    () => uploadItems.some((item) => item.status === "uploading"),
    [uploadItems],
  );
  const toMillis = (value: unknown) => {
    if (value && typeof value === "object" && "toMillis" in value) {
      const ts = value as { toMillis?: () => number };
      return ts.toMillis?.() ?? 0;
    }
    return 0;
  };
  const sortedShots = useMemo(() => {
    const list = [...shots];
    list.sort((a, b) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);

      if (sortMode === "recent") {
        const base = bTime - aTime; // newest first
        return sortOrder === "asc" ? -base : base;
      }

      const base = aTime - bTime; // oldest first
      return sortOrder === "asc" ? base : -base;
    });
    return list;
  }, [shots, sortMode, sortOrder]);
  const viewerShot =
    viewerIndex !== null && sortedShots[viewerIndex]
      ? sortedShots[viewerIndex]
      : null;

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
      await addDoc(shotsRef, {
        url: uploadJson.secure_url,
        publicId: uploadJson.public_id,
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

  const deleteShot = async (shot: Shot) => {
    if (!user || !folderId || !folder) return;
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

      if (folder.customCoverPublicId === shot.publicId) {
        const folderRef = doc(
          db,
          "users",
          user.uid,
          "screenshotFolders",
          folderId,
        );
        await updateDoc(folderRef, {
          customCoverUrl: null,
          customCoverPublicId: null,
        });
      }

      toast.success("Screenshot deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete screenshot");
    }
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
      className="min-h-screen bg-[#070504] px-4 pb-10 pt-24 text-white sm:px-6 lg:px-8"
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
      <section className="mx-auto max-w-7xl rounded-3xl border border-cyan-500/20 bg-black/65 p-4 backdrop-blur-md sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-500/80">
              Collection
            </p>
            <h1 className="text-2xl font-bold text-zinc-100">
              {folder?.name ?? "Loading..."}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/screenshots"
              className="inline-flex h-9 items-center rounded-xl border border-white/20 bg-zinc-900/80 px-4 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
            >
              Back
            </Link>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-4 text-xs font-semibold text-cyan-500 transition hover:bg-cyan-500/20">
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
              {isUploading ? "Uploading..." : "Add Screenshots"}
            </label>
          </div>
        </header>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-zinc-900/70 px-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
              Sort
            </label>
            <select
              value={sortMode}
              onChange={(e) =>
                setSortMode(e.target.value as "recent" | "uploadDate")
              }
              className="h-8 rounded-lg border border-white/10 bg-black/45 px-2 text-xs text-white outline-none"
            >
              <option value="recent">Recent</option>
              <option value="uploadDate">Upload Date</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            className="h-9 rounded-xl border border-white/15 bg-zinc-900/70 px-3 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
          >
            {sortOrder === "asc" ? "Asc" : "Desc"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {sortedShots.map((shot, idx) => {
              const activeCoverPublicId =
                folder?.customCoverPublicId ?? folder?.coverPublicId ?? null;
              const isCover = activeCoverPublicId === shot.publicId;
              return (
                <motion.article
                  key={shot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  whileHover={{ y: -4 }}
                  className="group overflow-hidden rounded-xl border border-cyan-500/20 bg-[#14100d] shadow-[0_12px_30px_rgba(0,0,0,0.38)]"
                >
                  <button
                    type="button"
                    className="relative block w-full text-left"
                    onClick={() => setViewerIndex(idx)}
                  >
                    <img
                      src={shot.url}
                      alt="Screenshot"
                      className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                    {isCover && (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-100">
                        <FaCheckCircle size={10} /> Cover
                      </span>
                    )}
                  </button>
                  <div className="flex items-center justify-between gap-2 p-2.5">
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
                      onClick={() => deleteShot(shot)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-300/35 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 transition hover:bg-red-500/20"
                    >
                      <FaTrashAlt size={10} />
                      Delete
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>

        {!shots.length && (
          <p className="mt-3 text-sm text-zinc-400">
            This collection is empty. Add screenshots to begin.
          </p>
        )}
      </section>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewerIndex(null)}
          >
            <div
              className="relative flex max-h-[96vh] w-full max-w-[1350px] flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
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
                <motion.img
                  key={viewerShot.id}
                  src={viewerShot.url}
                  alt="Screenshot preview"
                  className="max-h-[82vh] max-w-[96vw] rounded-lg object-contain shadow-[0_18px_45px_rgba(0,0,0,0.65)]"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                />
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
                        <img
                          src={shot.url}
                          alt="Screenshot thumbnail"
                          className="h-full w-full object-cover"
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
