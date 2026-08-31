"use client";

import { useEffect, useState, ChangeEvent, useRef } from "react";
import { Area } from "react-easy-crop";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  verifyBeforeUpdateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteField,
  deleteDoc,
  runTransaction,
  setDoc,
} from "firebase/firestore";

import { useUser } from "../../../context/UserContext";
import { db, auth } from "@/app/lib/firebase";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import getCroppedImg from "@/app/lib/getCroppedImg";

import {
  clampGamesBgBlur,
  clampGamesBgOverlay,
  DEFAULT_BG_BLUR,
  DEFAULT_BG_OVERLAY,
  PAGE_SETTINGS_STORAGE_KEY,
} from "@/app/lib/gamesPageSettings";
import { useRouter } from "next/navigation";
import { useUI } from "@/app/context/UIContext";
import { useAuthModal } from "@/app/context/AuthModalContext";
import AnimatedPasswordField from "@/app/components/AnimatedPasswordField";
import AnimatedField from "@/app/components/AnimatedField";
import Textarea from "@/app/components/Textarea";
import CropModal from "@/app/components/CropModal";
import ImageOverlay from "@/app/components/ImageOverlay";
import {
  FiCamera,
  FiCheck,
  FiLock,
  FiGlobe,
  FiRotateCcw,
  FiSave,
  FiShield,
  FiTrash2,
  FiUser,
  FiUsers,
} from "react-icons/fi";

/* ---------------- TYPES ---------------- */

type CropData = {
  x: number;
  y: number;
  zoom: number;
};

type MediaValue =
  | { type: "image"; data: string; name?: string }
  | { type: "gif"; data: string; crop: CropData; name?: string };

type UserProfile = {
  uid: string;
  admin?: boolean;
  username?: string;
  email?: string;
  bio?: string;
  avatar?: MediaValue;
  wallpaper?: MediaValue;
  privacy?: Record<string, "public" | "friends" | "private">;
};

type UploadKind = "avatar" | "wallpaper";

/* ---------------- COMPONENT ---------------- */

export default function EditProfilePage() {
  const { user, profile, setProfile, loading } = useUser();
  const router = useRouter();
  const { startRouteLoading } = useUI();
  const { open } = useAuthModal();

  const [isSaving, setIsSaving] = useState(false);

  /* Auth States */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingUsername, setChangingUsername] = useState(false);

  /* Image States */
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [original, setOriginal] = useState<UserProfile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropType, setCropType] = useState<"avatar" | "wallpaper" | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [passwordResetRequested, setPasswordResetRequested] = useState(false);
  const [wallpaperLoaded, setWallpaperLoaded] = useState(false);
  const [gamesBgBlur, setGamesBgBlur] = useState(DEFAULT_BG_BLUR);
  const [gamesBgOverlay, setGamesBgOverlay] = useState(DEFAULT_BG_OVERLAY);
  const [siteSettingsHydrated, setSiteSettingsHydrated] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const currentWallpaperData = (draft ?? profile)?.wallpaper?.data;

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    if (!profile) return;

    setDraft(profile);
    setOriginal(profile);
  }, [profile]);

  useEffect(() => {
    setWallpaperLoaded(false);
  }, [currentWallpaperData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(PAGE_SETTINGS_STORAGE_KEY);
    if (!stored) {
      setSiteSettingsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        bgBlur?: number;
        bgOverlay?: number;
      };

      if (typeof parsed.bgBlur === "number") {
        setGamesBgBlur(clampGamesBgBlur(parsed.bgBlur));
      }

      if (typeof parsed.bgOverlay === "number") {
        setGamesBgOverlay(clampGamesBgOverlay(parsed.bgOverlay));
      }
    } catch (error) {
      console.warn("Failed to parse site settings", error);
    } finally {
      setSiteSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !siteSettingsHydrated) return;

    let currentSettings: Record<string, unknown> = {};
    try {
      currentSettings = JSON.parse(
        window.localStorage.getItem(PAGE_SETTINGS_STORAGE_KEY) ?? "{}",
      ) as Record<string, unknown>;
    } catch {
      currentSettings = {};
    }

    window.localStorage.setItem(
      PAGE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...currentSettings,
        bgBlur: gamesBgBlur,
        bgOverlay: gamesBgOverlay,
      }),
    );
  }, [gamesBgBlur, gamesBgOverlay, siteSettingsHydrated]);

  if (loading || !profile)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--theme-bg)]">
        <LoadingSpinner />
      </div>
    );

  const active = draft ?? profile;

  /* ---------------- HELPERS ---------------- */

  const MAX_USERNAME_LENGTH = 32;
  const HAS_LETTER_REGEX = /[a-z]/;

  const normalizeUsername = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_") // replace spaces with underscores
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/_+/g, "_") // collapse repeated underscores
      .replace(/^[-_]+|[-_]+$/g, ""); // trim edge separators

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "username") {
      const normalized = normalizeUsername(value).slice(0, MAX_USERNAME_LENGTH);

      setDraft((prev) => ({
        ...(prev ?? profile),
        username: normalized,
      }));

      return;
    }

    setDraft((prev) => ({
      ...(prev ?? profile),
      [name]: value,
    }));
  };

  const isUsernameTaken = async (name: string) => {
    const q = query(collection(db, "users"), where("username", "==", name));
    const snap = await getDocs(q);
    return snap.docs.some((d) => d.id !== user!.uid);
  };

  const handleForgotPassword = async () => {
    if (!user || !user.email) {
      toast.error("You must be logged in first");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, user.email);

      toast.success("Password reset requested. Check your email to continue.");

      // 🔐 Lock manual password changes
      setPasswordResetRequested(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toast.error("Failed to send reset email");
    }
  };

  /* ---------------- IMAGE ---------------- */

  const onSelectImage = (file: File, type: "avatar" | "wallpaper") => {
    const isGif = file.type === "image/gif";

    // 🔥 always clear previous media first
    setDraft((p) => ({
      ...(p ?? profile),
      [type]: undefined,
    }));

    const reader = new FileReader();
    reader.onload = () => {
      if (isGif) {
        // ⛔ no real crop — store transform instead
        setDraft((p) => ({
          ...(p ?? profile),
          [type]: {
            type: "gif",
            data: reader.result as string,
            crop: { x: 0, y: 0, zoom: 1 },
          },
        }));

        toast("GIF crop is applied live", { icon: "🎞️" });
        return;
      }

      // normal image → open crop modal
      setSelectedFile(file);
      setCropType(type);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };

    reader.readAsDataURL(file);
  };

  const saveCrop = async () => {
    if (!cropType) return;

    const isGif = selectedFile?.type === "image/gif";

    if (isGif) {
      setDraft((p) => ({
        ...(p ?? profile),
        [cropType]: {
          ...(p?.[cropType] as any),
          crop: { x: crop.x, y: crop.y, zoom },
        },
      }));

      toast.success("GIF crop applied");
    } else {
      // existing image crop
      const base64 = await getCroppedImg(
        URL.createObjectURL(selectedFile!),
        croppedPixels!,
        cropType === "wallpaper" ? 3840 : 1280,
        cropType === "wallpaper" ? 0.92 : 0.7,
        cropType === "wallpaper" ? 1920 : undefined,
        cropType === "wallpaper" ? 1080 : undefined,
      );

      setDraft((p) => ({
        ...(p ?? profile),
        [cropType]: { type: "image", data: base64 },
      }));
    }

    setCropType(null);
    setSelectedFile(null);
  };

  /* ---------------- SAVE / CANCEL ---------------- */

  const uiError = (title: string, hint?: string) =>
    toast.error(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{title}</span>
        {hint && <span className="text-xs opacity-80">{hint}</span>}
      </div>,
      { duration: 4000 },
    );

  const uiSuccess = (title: string, hint?: string) =>
    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{title}</span>
        {hint && <span className="text-xs opacity-80">{hint}</span>}
      </div>,
      { duration: 4000 },
    );

  const uploadMediaToCloudinary = async (
    media: MediaValue,
    kind: UploadKind,
  ): Promise<MediaValue> => {
    try {
      if (!media.data.startsWith("data:")) return media;

      const publicId = `playcrew/users/${user!.uid}/${kind}`;
      const assetFolder = `playcrew/users/${user!.uid}/profile`;

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

      const blob = await fetch(media.data).then((r) => r.blob());
      const ext = (blob.type.split("/")[1] || "bin").split(";")[0];

      const body = new FormData();
      body.append("file", blob, `${kind}.${ext}`);
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

      return { ...media, data: uploadJson.secure_url };
    } catch (error: unknown) {
      const reason =
        error instanceof Error ? error.message : "Unknown upload failure";
      throw new Error(`Cloudinary: ${reason}`);
    }
  };

  const saveProfile = async () => {
    if (!draft || !original) return;
    setIsSaving(true);
    const abortSave = (title: string, hint?: string) => {
      uiError(title, hint);
    };

    try {
      // ---------------- USERNAME VALIDATION (ON SAVE ONLY) ----------------
      if (draft.username) {
        if (draft.username.length < 3) {
          abortSave(
            "Username is too short",
            `Use at least 3 characters (max ${MAX_USERNAME_LENGTH})`,
          );
          return;
        }

        if (draft.username.length > MAX_USERNAME_LENGTH) {
          abortSave(
            "Username is too long",
            `Keep it under ${MAX_USERNAME_LENGTH} characters`,
          );
          return;
        }

        if (!HAS_LETTER_REGEX.test(draft.username)) {
          abortSave(
            "Username needs a letter",
            "Use at least one letter so it is not just numbers",
          );
          return;
        }
      }

      /* ---------------- EMAIL CHANGE ---------------- */
      if (draft.email && draft.email !== original.email) {
        if (!currentPassword) {
          abortSave(
            "Current password required",
            "Enter your current password to change email",
          );
          return;
        }

        try {
          const cred = EmailAuthProvider.credential(
            user!.email!,
            currentPassword,
          );

          await reauthenticateWithCredential(user!, cred);

          // ✅ THIS is the correct API
          await verifyBeforeUpdateEmail(user!, draft.email);

          uiSuccess(
            "Verification email sent",
            "Check your inbox or spam folder to continue",
          );

          // Optional but recommended
          await auth.signOut();
          startRouteLoading();
          router.push("/dashboard");
          setTimeout(() => open("login"), 80);
          return;
        } catch (err: any) {
          console.error("Verify-before-update error:", err.code, err.message);

          if (err.code === "auth/email-already-in-use") {
            abortSave(
              "Email already in use",
              "Try logging in or choose a different email",
            );
          } else if (err.code === "auth/invalid-email") {
            abortSave(
              "Invalid email address",
              "Please double-check the spelling",
            );
          } else if (err.code === "auth/requires-recent-login") {
            abortSave(
              "Session expired",
              "Please log in again to change your email",
            );
            await auth.signOut();
            startRouteLoading();
            router.push("/dashboard");
            setTimeout(() => open("login"), 80);
          } else {
            abortSave(
              "Could not send verification email",
              "Please try again in a moment",
            );
          }

          return;
        }
      }

      /* ---------------- PASSWORD CHANGE ---------------- */
      const wantsPasswordChange = newPassword.trim() !== "";

      if (wantsPasswordChange) {
        if (!currentPassword) {
          abortSave(
            "Current password required",
            "Enter your current password to change password",
          );
          return;
        }

        try {
          const cred = EmailAuthProvider.credential(
            user!.email!,
            currentPassword,
          );

          await reauthenticateWithCredential(user!, cred);
          await updatePassword(user!, newPassword);
        } catch {
          abortSave(
            "Current password incorrect",
            "Make sure you entered your existing password",
          );

          return;
        }
      }

      /* ---------------- PROFILE UPDATES ---------------- */

      // const updates: Partial<UserProfile> = {};
      const updates: Record<string, any> = {};

      if (draft.username !== original.username) {
        if (!draft.username) {
          abortSave("Username required");
          return;
        }

        if (await isUsernameTaken(draft.username)) {
          abortSave(
            "Identical username already exists",
            "Another user already registered that exact username",
          );

          return;
        }

        updates.username = draft.username;
      }

      if (draft.email !== original.email) updates.email = draft.email;
      if (draft.bio !== original.bio) updates.bio = draft.bio;
      if (JSON.stringify(draft.privacy) !== JSON.stringify(original.privacy)) {
        updates.privacy = draft.privacy ?? {};
      }

      const avatarChanged =
        JSON.stringify(draft.avatar) !== JSON.stringify(original.avatar);

      const wallpaperChanged =
        JSON.stringify(draft.wallpaper) !== JSON.stringify(original.wallpaper);

      if (avatarChanged) {
        updates.avatar = draft.avatar
          ? await uploadMediaToCloudinary(draft.avatar, "avatar")
          : deleteField();
      }

      if (wallpaperChanged) {
        updates.wallpaper = draft.wallpaper
          ? await uploadMediaToCloudinary(draft.wallpaper, "wallpaper")
          : deleteField();
      }

      if (Object.keys(updates).length > 0) {
        if (updates.username) {
          await runTransaction(db, async (transaction) => {
            const nextUsername = String(updates.username);
            const nextUsernameRef = doc(db, "usernames", nextUsername);
            const nextUsernameSnap = await transaction.get(nextUsernameRef);

            if (
              nextUsernameSnap.exists() &&
              nextUsernameSnap.data().uid !== user!.uid
            ) {
              throw new Error("username-already-taken");
            }

            const previousUsername = original.username?.trim().toLowerCase();
            const previousUsernameRef = previousUsername
              ? doc(db, "usernames", previousUsername)
              : null;
            const previousUsernameSnap = previousUsernameRef
              ? await transaction.get(previousUsernameRef)
              : null;

            transaction.update(doc(db, "users", user!.uid), updates);
            transaction.set(nextUsernameRef, {
              uid: user!.uid,
              username: nextUsername,
            });

            if (
              previousUsernameRef &&
              previousUsername !== nextUsername &&
              previousUsernameSnap?.exists() &&
              previousUsernameSnap.data().uid === user!.uid
            ) {
              transaction.delete(previousUsernameRef);
            }
          });
        } else {
          await updateDoc(doc(db, "users", user!.uid), updates);
        }
        setProfile({ ...profile!, ...updates });
      }

      const visibilityChanged =
        (draft.privacy?.profile ?? "public") !==
        (original.privacy?.profile ?? "public");

      if (visibilityChanged) {
        const visibility = draft.privacy?.profile ?? "public";
        const gamesSnapshot = await getDocs(
          collection(db, "users", user!.uid, "games_igdb"),
        );

        await Promise.all(
          gamesSnapshot.docs.map(async (gameDocument) => {
            const gameData = gameDocument.data();
            const reviewText = gameData.review?.text?.trim();
            if (!reviewText) return;

            const gameId = Number(gameData.igdb?.id ?? gameDocument.id);
            const communityRef = doc(
              db,
              "communityReviews",
              `${user!.uid}_${gameId}`,
            );

            if (visibility !== "public") {
              await deleteDoc(communityRef).catch(() => undefined);
              return;
            }

            await setDoc(
              communityRef,
              {
                userId: user!.uid,
                username: draft.username ?? "PlayCrew User",
                gameId,
                gameName: gameData.name ?? gameData.igdb?.name ?? "Game",
                text: reviewText,
                sticker: gameData.review?.sticker ?? null,
                rating:
                  typeof gameData.my_rating === "number"
                    ? gameData.my_rating
                    : null,
                playtime:
                  typeof gameData.playtime === "number" ? gameData.playtime : 0,
                status: gameData.status ?? null,
                progress:
                  typeof gameData.progress === "number" ? gameData.progress : 0,
                playedOn: gameData.playedOn ?? null,
                visibility: "public",
                createdAt:
                  gameData.review?.createdAt ?? gameData.lastUpdated ?? new Date(),
                updatedAt: new Date(),
              },
              { merge: true },
            );
          }),
        );
      }

      if (updates.username) {
        setChangingUsername(true);

        // small delay purely for UX (optional but recommended)
        setTimeout(() => {
          startRouteLoading();
          router.replace(`/profile/${updates.username}`);
        }, 600);
      }

      /* ---------------- CLEANUP ---------------- */
      setDraft(null);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordResetRequested(false);
      uiSuccess("Profile updated", "Your changes were saved successfully");
    } catch (err: any) {
      console.error("Profile save failed:", err);
      const msg = String(err?.message ?? "").toLowerCase();
      const code = String(err?.code ?? "").toLowerCase();

      if (msg.includes("username-already-taken")) {
        abortSave(
          "Identical username already exists",
          "Another user already registered that exact username",
        );
        return;
      }

      if (msg.includes("cloudinary")) {
        abortSave(
          "Image upload failed",
          "Cloudinary could not store your image. Please try again.",
        );
        return;
      }

      if (
        msg.includes("exceeds the maximum size") ||
        msg.includes("invalid_argument") ||
        msg.includes("request entity too large") ||
        msg.includes("payload too large") ||
        code.includes("invalid-argument") ||
        code.includes("resource-exhausted")
      ) {
        abortSave(
          "Image too large to save",
          "Firebase rejected the image size. Try cropping or resizing.",
        );
        return;
      }

      abortSave("Could not save changes", "Please try again in a moment");
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    setDraft(original);
    setCurrentPassword("");
    setPasswordResetRequested(false);
    setNewPassword("");
    setSelectedFile(null);
    setCropType(null);
  };

  const wantsPasswordChange = Boolean(newPassword);

  const passwordInvalid = Boolean(wantsPasswordChange && !currentPassword);
  const otherModalOpen =
    Boolean(cropType && selectedFile) || changingUsername || isSaving;

  const hasChanges =
    JSON.stringify(draft) !== JSON.stringify(original) ||
    currentPassword.trim() !== "" ||
    newPassword.trim() !== "";

  /* ---------------- UI ---------------- */

  return (
    <>
      <motion.main
        className="page-top-offset relative min-h-screen overflow-hidden bg-[var(--theme-bg)] px-3 pb-28 pt-20 sm:px-6 sm:pt-24 lg:px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* {active?.wallpaper?.data && (
          <div className="absolute inset-0 bg-[var(--theme-bg)]">
            <img
              src={active.wallpaper.data}
              alt=""
              onLoad={() => setWallpaperLoaded(true)}
              className={`absolute inset-0 h-full w-full scale-110 object-cover transition-opacity duration-700 ease-out ${
                wallpaperLoaded ? "opacity-55" : "opacity-0"
              }`}
              style={{ filter: `blur(${gamesBgBlur}px)` }}
            />
            <div
              className="absolute inset-0 bg-[var(--theme-bg)]"
              style={{ opacity: gamesBgOverlay / 100 }}
            />
          </div>
        )} */}

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,var(--theme-tint-a),transparent_30%),radial-gradient(circle_at_88%_18%,var(--theme-tint-b),transparent_28%)]" />

        <motion.div
          ref={accountPanelRef}
          className="relative z-10 mx-auto w-full max-w-7xl"
          initial={{ y: 24, opacity: 0 }}
          animate={{
            y: otherModalOpen ? 6 : 0,
            opacity: otherModalOpen ? 0 : 1,
            scale: otherModalOpen ? 0.99 : 1,
            pointerEvents: otherModalOpen ? "none" : "auto",
          }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <section className="theme-panel overflow-hidden rounded-[30px] border backdrop-blur-2xl sm:rounded-[36px]">
            <div className="relative h-52 overflow-hidden sm:h-64 lg:h-72">
              {active?.wallpaper?.data ? (
                <img
                  src={active.wallpaper.data}
                  alt="Profile wallpaper"
                  className="h-full w-full object-cover"
                  style={
                    active.wallpaper.type === "gif" && active.wallpaper.crop
                      ? {
                          transform: `translate(${active.wallpaper.crop.x}px, ${active.wallpaper.crop.y}px) scale(${active.wallpaper.crop.zoom})`,
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_20%_15%,var(--theme-tint-a),transparent_34%),radial-gradient(circle_at_82%_25%,var(--theme-tint-b),transparent_30%),linear-gradient(135deg,var(--theme-panel-alt),var(--theme-bg))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--theme-bg)] via-transparent to-transparent" />

              <div className="absolute right-3 top-3 flex gap-2 sm:right-5 sm:top-5">
                <button
                  type="button"
                  onClick={() => wallpaperInputRef.current?.click()}
                  className="theme-panel-strong theme-hover-accent inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-lg backdrop-blur-xl"
                >
                  <FiCamera size={15} />
                  <span className="hidden sm:inline">
                    {active?.wallpaper ? "Change cover" : "Add cover"}
                  </span>
                </button>
                {active?.wallpaper && (
                  <button
                    type="button"
                    aria-label="Remove wallpaper"
                    onClick={() =>
                      setDraft((current) =>
                        current
                          ? { ...current, wallpaper: undefined }
                          : current,
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-300/35 bg-red-500/15 text-red-100 backdrop-blur-xl transition hover:bg-red-500/25"
                  >
                    <FiTrash2 size={15} />
                  </button>
                )}
              </div>
              <input
                ref={wallpaperInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onSelectImage(file, "wallpaper");
                  event.currentTarget.value = "";
                }}
              />
            </div>

            <div className="relative px-4 pb-5 sm:px-7 sm:pb-7 lg:px-9">
              <div className="-mt-16 flex flex-col items-center gap-4 sm:-mt-20 sm:flex-row sm:items-end">
                <div className="rounded-full border-4 border-[var(--theme-bg)] bg-[var(--theme-bg)] shadow-2xl">
                  <ImageOverlay
                    label="Avatar"
                    media={active?.avatar}
                    rounded
                    onEdit={() => avatarInputRef.current?.click()}
                    onDelete={() =>
                      setDraft((current) =>
                        current ? { ...current, avatar: undefined } : current,
                      )
                    }
                  />
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectImage(file, "avatar");
                    event.currentTarget.value = "";
                  }}
                />

                <div className="min-w-0 flex-1 pb-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <h1 className="theme-text truncate text-2xl font-black sm:text-3xl">
                      {active?.username || "Player"}
                    </h1>
                    {active?.admin && (
                      <span className="theme-accent-soft-bg inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]">
                        <FiShield size={11} /> Admin
                      </span>
                    )}
                  </div>
                  <p className="theme-text-muted mt-1 text-sm">
                    Shape how your identity appears across PlayCrew.
                  </p>
                </div>

                <span
                  className={`mb-1 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    hasChanges ? "theme-accent-soft-bg" : "theme-surface"
                  }`}
                >
                  <FiCheck size={13} />
                  {hasChanges ? "Changes pending" : "Profile up to date"}
                </span>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
            <motion.section
              layout
              className="theme-panel-strong rounded-3xl border p-4 sm:p-6"
            >
              <div className="mb-5 flex items-start gap-3">
                <span className="theme-accent-soft-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                  <FiUser />
                </span>
                <div>
                  <h2 className="theme-text text-lg font-bold">
                    Public identity
                  </h2>
                  <p className="theme-text-muted mt-0.5 text-xs sm:text-sm">
                    Your username, contact address, and player bio.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <AnimatedField
                  label="Username"
                  name="username"
                  value={active?.username || ""}
                  onChange={handleChange}
                  maxLength={MAX_USERNAME_LENGTH}
                />
                <AnimatedField
                  label="Email"
                  name="email"
                  value={active?.email || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="mt-4">
                <Textarea
                  label="Bio"
                  name="bio"
                  value={active?.bio || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="mt-5 border-t theme-border pt-5">
                <div className="mb-3">
                  <h3 className="theme-text text-sm font-bold">Profile visibility</h3>
                  <p className="theme-text-muted mt-1 text-xs">
                    Choose who can open your profile, library, reviews, achievements, and screenshots.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      value: "public" as const,
                      label: "Public",
                      description: "Visible to everyone",
                      icon: FiGlobe,
                    },
                    {
                      value: "friends" as const,
                      label: "Friends Only",
                      description: "Visible to your friends",
                      icon: FiUsers,
                    },
                    {
                      value: "private" as const,
                      label: "Private",
                      description: "Visible only to you",
                      icon: FiLock,
                    },
                  ].map((option) => {
                    const selected =
                      ((active as UserProfile | null)?.privacy?.profile ??
                        "public") === option.value;
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  privacy: {
                                    ...(current.privacy ?? {}),
                                    profile: option.value,
                                  },
                                }
                              : current,
                          )
                        }
                        className={`rounded-2xl border p-3 text-left transition ${
                          selected
                            ? "theme-accent-soft-bg border-[rgba(var(--theme-accent-rgb),0.55)]"
                            : "theme-surface theme-hover-surface"
                        }`}
                        aria-pressed={selected}
                      >
                        <Icon className={selected ? "theme-accent-text" : "theme-text-muted"} />
                        <p className="theme-text mt-2 text-xs font-bold">{option.label}</p>
                        <p className="theme-text-muted mt-0.5 text-[10px]">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.section>

            <motion.section
              layout
              className="theme-panel-strong rounded-3xl border p-4 sm:p-6"
            >
              <div className="mb-5 flex items-start gap-3">
                <span className="theme-accent-soft-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                  <FiLock />
                </span>
                <div>
                  <h2 className="theme-text text-lg font-bold">Security</h2>
                  <p className="theme-text-muted mt-0.5 text-xs sm:text-sm">
                    Update your password or request a secure reset.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <AnimatedPasswordField
                  label="Current Password"
                  value={currentPassword}
                  show={showCurrent}
                  toggle={() => setShowCurrent((current) => !current)}
                  onChange={setCurrentPassword}
                  disabled={passwordResetRequested}
                />
                <AnimatedPasswordField
                  label="New Password"
                  value={newPassword}
                  show={showNew}
                  toggle={() => setShowNew((current) => !current)}
                  onChange={setNewPassword}
                  disabled={passwordResetRequested}
                />
              </div>

              {passwordInvalid && (
                <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Enter your current password before choosing a new one.
                </p>
              )}

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={passwordResetRequested}
                className="theme-surface theme-hover-accent mt-4 inline-flex w-full items-center justify-center rounded-xl border px-3 py-2.5 text-xs font-semibold disabled:opacity-50"
              >
                {passwordResetRequested
                  ? "Reset email requested"
                  : "Send password reset email"}
              </button>
            </motion.section>
          </div>
        </motion.div>

        <AnimatePresence>
          {hasChanges && !otherModalOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 30, x: "-50%" }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="theme-panel fixed bottom-4 left-1/2 z-40 flex w-[min(94vw,560px)] items-center gap-2 rounded-2xl border p-2.5 shadow-[var(--theme-shadow)] backdrop-blur-2xl"
            >
              <div className="hidden min-w-0 flex-1 px-2 sm:block">
                <p className="theme-text text-sm font-semibold">
                  Unsaved changes
                </p>
                <p className="theme-text-muted text-[11px]">
                  Save or discard your profile edits.
                </p>
              </div>
              <button
                type="button"
                onClick={discardChanges}
                className="theme-surface theme-hover-surface inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold sm:flex-none"
              >
                <FiRotateCcw size={14} /> Discard
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={passwordInvalid || isSaving}
                className="theme-accent-bg inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                <FiSave size={14} /> Save Changes
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {cropType && selectedFile && (
            <CropModal
              file={selectedFile}
              crop={crop}
              zoom={zoom}
              setCrop={setCrop}
              setZoom={setZoom}
              aspect={cropType === "avatar" ? 1 : 16 / 9}
              onComplete={setCroppedPixels}
              onSave={saveCrop}
              onCancel={() => setCropType(null)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(changingUsername || isSaving) && (
            <motion.div
              className="theme-modal-backdrop fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="theme-panel-strong flex flex-col items-center gap-4 rounded-2xl border px-8 py-7 theme-text shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
              >
                <p className="theme-accent-text text-md tracking-wide">
                  Updating Your Account
                </p>
                <span className="theme-accent-text loading loading-dots loading-xl" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </>
  );
}
