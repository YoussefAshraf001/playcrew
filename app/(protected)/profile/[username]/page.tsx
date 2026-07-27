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
} from "firebase/firestore";
import { Helmet } from "react-helmet-async";

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
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const currentWallpaperData = (draft ?? profile)?.wallpaper?.data;

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    document.title = "Identity Hub • PlayCrew";
  }, []);

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

    window.localStorage.setItem(
      PAGE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
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
      .replace(/_+/g, "_") // collapse repeated underscores
      .replace(/^-+|-+$/g, ""); // trim edge dashes

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
            "Username is already taken",
            "Try a different name, or add numbers or underscores",
          );

          return;
        }

        updates.username = draft.username;
      }

      if (draft.email !== original.email) updates.email = draft.email;
      if (draft.bio !== original.bio) updates.bio = draft.bio;

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
        await updateDoc(doc(db, "users", user!.uid), updates);
        setProfile({ ...profile!, ...updates });
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
      <Helmet>
        <title>Identity Hub • PlayCrew</title>
        <meta
          name="description"
          content="Manage your PlayCrew profile, preferences, and account settings."
        />
      </Helmet>

      <motion.main
        className="relative min-h-screen overflow-hidden bg-[var(--theme-bg)] px-4 py-24 sm:px-6 lg:flex lg:items-center lg:justify-center lg:py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {active?.wallpaper?.data && (
          <div className="absolute inset-0 bg-black">
            <img
              src={active.wallpaper.data}
              alt=""
              onLoad={() => setWallpaperLoaded(true)}
              className={`absolute inset-0 h-full w-full scale-110 object-cover transition-opacity duration-700 ease-out ${
                wallpaperLoaded ? "opacity-45" : "opacity-0"
              }`}
              style={{ filter: "blur(14px)" }}
            />
          </div>
        )}

        <motion.div
          ref={accountPanelRef}
          className="theme-panel relative z-10 mx-auto w-full max-w-6xl rounded-4xl border p-4 backdrop-blur-2xl sm:p-6 lg:p-8"
          initial={{ y: 40, opacity: 0 }}
          animate={{
            y: otherModalOpen ? 8 : 0,
            opacity: otherModalOpen ? 0 : 1,
            scale: otherModalOpen ? 0.98 : 1,
            pointerEvents: otherModalOpen ? "none" : "auto",
          }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: -100 }}
                animate={{ opacity: 1, y: 80 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ duration: 0.4 }}
                className="fixed bottom-0 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl theme-panel shadow-2xl"
              >
                <span className="theme-text-muted text-sm">
                  You have unsaved changes
                </span>

                <button
                  onClick={discardChanges}
                  className="theme-surface rounded-xl px-4 py-2 text-sm"
                >
                  Discard
                </button>

                <button
                  onClick={saveProfile}
                  disabled={passwordInvalid}
                  className="theme-accent-bg rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Save Changes
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* PROFILE CARD */}
            <motion.div
              layout
              className="theme-panel-strong rounded-3xl border p-5 sm:p-6"
            >
              <p className="theme-accent-soft-text mb-5 text-xs font-semibold uppercase tracking-[0.18em]">
                Profile
              </p>

              <div className="flex flex-col gap-6 lg:flex-row">
                {/* AVATAR */}
                <div
                  className="flex justify-center lg:justify-start cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImageOverlay
                    label="Avatar"
                    media={active?.avatar}
                    rounded
                    onEdit={() => avatarInputRef.current?.click()}
                    onDelete={() =>
                      setDraft((p) => (p ? { ...p, avatar: undefined } : p))
                    }
                  />

                  <input
                    ref={avatarInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files &&
                      onSelectImage(e.target.files[0], "avatar")
                    }
                  />
                </div>

                {/* DETAILS */}
                <div className="flex-1">
                  <div className="grid gap-4 md:grid-cols-2">
                    <AnimatedField
                      label="Username"
                      name="username"
                      value={active?.username || ""}
                      onChange={handleChange}
                      maxLength={15}
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
                </div>
              </div>
            </motion.div>

            {/* SECURITY CARD */}
            <motion.div
              layout
              className="theme-panel-strong rounded-3xl border p-5 sm:p-6"
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold theme-text">
                  Privacy & Security
                </h2>

                <p className="theme-text-muted text-sm">
                  Change your password and account credentials.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <AnimatedPasswordField
                  label="Current Password"
                  value={currentPassword}
                  show={showCurrent}
                  toggle={() => setShowCurrent((p) => !p)}
                  onChange={setCurrentPassword}
                  disabled={passwordResetRequested}
                />

                <AnimatedPasswordField
                  label="New Password"
                  value={newPassword}
                  show={showNew}
                  toggle={() => setShowNew((p) => !p)}
                  onChange={setNewPassword}
                  disabled={passwordResetRequested}
                />
              </div>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="theme-accent-text mt-4 text-sm transition hover:brightness-110"
              >
                Forgot your password?
              </button>
            </motion.div>
          </motion.div>
        </motion.div>

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
          {changingUsername ||
            (isSaving && (
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
            ))}
        </AnimatePresence>
      </motion.main>
    </>
  );
}
