"use client";

import { useEffect, useState, ChangeEvent, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
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
import {
  FiEdit2,
  FiCheck,
  FiX,
  FiEye,
  FiEyeOff,
  FiCamera,
  FiTrash2,
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";

import { useUser } from "../../../context/UserContext";
import { db, auth } from "@/app/lib/firebase";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import getCroppedImg from "@/app/lib/getCroppedImg";
import { useRouter } from "next/navigation";
import PresetModal from "@/app/components/PresetModal";
import CloudUploadAnimation from "@/app/components/CloudUploadAnimation";
import { IoMdCloudUpload } from "react-icons/io";

/* ---------------- TYPES ---------------- */

type CropData = {
  x: number;
  y: number;
  zoom: number;
};

type MediaValue =
  | { type: "image"; data: string }
  | { type: "gif"; data: string; crop: CropData };

type UserProfile = {
  uid: string;
  username?: string;
  email?: string;
  bio?: string;
  avatar?: MediaValue;
  wallpaper?: MediaValue;
};

/* ---------------- COMPONENT ---------------- */

export default function EditProfilePage() {
  const { user, profile, setProfile, loading } = useUser();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /* Auth States */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingUsername, setChangingUsername] = useState(false);

  /* Image States */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [original, setOriginal] = useState<UserProfile | null>(null);
  const [presetType, setPresetType] = useState<"avatar" | "wallpaper" | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropType, setCropType] = useState<"avatar" | "wallpaper" | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null);
  const [passwordResetRequested, setPasswordResetRequested] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    if (editing && profile) {
      setDraft(profile);
      setOriginal(profile);
    }
  }, [editing, profile]);

  if (loading || !profile)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );

  const active = editing ? draft : profile;

  /* ---------------- HELPERS ---------------- */

  const USERNAME_REGEX = /^[a-z0-9_-]{3,15}$/;

  const normalizeUsername = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, "_") // replace spaces
      .replace(/[^a-z0-9_-]/g, ""); // strip invalid chars

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!editing) return;

    const { name, value } = e.target;

    if (name === "username") {
      const normalized = normalizeUsername(value).slice(0, 15);

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

  const MAX_BASE64_SIZE = 900_000; // ~900 KB safe buffer

  const isTooLarge = (media?: MediaValue) => {
    if (!media) return false;
    return media.data.length > MAX_BASE64_SIZE;
  };

  const fail = (title: string, hint?: string) => {
    setIsSaving(false);
    setUploadProgress(0);
    uiError(title, hint);
  };

  const saveProfile = async () => {
    if (!draft || !original) return;

    const startFakeProgress = () => {
      return setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 5 : p));
      }, 200);
    };

    const progressTimer = startFakeProgress();
    setIsSaving(true);
    setUploadProgress(5);

    try {
      // ---------------- USERNAME VALIDATION (ON SAVE ONLY) ----------------
      if (draft.username) {
        if (draft.username.length < 3) {
          uiError(
            "Username is too short",
            "Use at least 3 characters (max 15)",
          );
          return;
        }

        if (!USERNAME_REGEX.test(draft.username)) {
          uiError(
            "Username format not allowed",
            "Only letters, numbers, underscores (_) and dashes (-)",
          );
          return;
        }
      }

      /* ---------------- EMAIL CHANGE ---------------- */
      if (draft.email && draft.email !== original.email) {
        if (!currentPassword) {
          toast.error("Enter your current password to change email");
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
          router.push("/login");
          return;
        } catch (err: any) {
          console.error("Verify-before-update error:", err.code, err.message);

          if (err.code === "auth/email-already-in-use") {
            uiError(
              "Email already in use",
              "Try logging in or choose a different email",
            );
          } else if (err.code === "auth/invalid-email") {
            uiError(
              "Invalid email address",
              "Please double-check the spelling",
            );
          } else if (err.code === "auth/requires-recent-login") {
            uiError(
              "Session expired",
              "Please log in again to change your email",
            );
            await auth.signOut();
            router.push("/login");
          } else {
            uiError(
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
          toast.error("Enter your current password to change password");
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
          uiError(
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
          toast.error("Username required");
          return;
        }

        if (await isUsernameTaken(draft.username)) {
          uiError("Username unavailable", "Try adding numbers or underscores");

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

      if (avatarChanged && isTooLarge(draft.avatar)) {
        uiError("Avatar image is too large", "Please use a smaller image");
        return;
      }

      if (wallpaperChanged && isTooLarge(draft.wallpaper)) {
        uiError("Wallpaper image is too large", "Try reducing resolution");
        return;
      }

      if (avatarChanged) {
        updates.avatar = draft.avatar ?? deleteField();
      }

      if (wallpaperChanged) {
        updates.wallpaper = draft.wallpaper ?? deleteField();
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "users", user!.uid), updates);
        setProfile({ ...profile!, ...updates });
      }

      // Finish progress
      clearInterval(progressTimer);
      setUploadProgress(100);

      if (updates.username) {
        setChangingUsername(true);

        // small delay purely for UX (optional but recommended)
        setTimeout(() => {
          router.replace(`/profile/${updates.username}`);
        }, 600);
      }

      /* ---------------- CLEANUP ---------------- */
      clearInterval(progressTimer);
      setUploadProgress(0);
      setIsSaving(false);
      setEditing(false);
      setDraft(null);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordResetRequested(false);
      uiSuccess("Profile updated", "Your changes were saved successfully");
    } catch (err: any) {
      fail("Avatar image is too large", "Please use a smaller image");

      const msg = err?.message ?? "";

      if (
        msg.includes("exceeds the maximum size") ||
        msg.includes("INVALID_ARGUMENT")
      ) {
        uiError(
          "Image too large to save",
          "Avatars and wallpapers must be under 1MB. Try cropping or resizing.",
        );
        return;
      }

      uiError("Could not save changes", "Please try again in a moment");
    }
  };

  const cancelEditing = () => {
    setDraft(original);
    setEditing(false);
    setCurrentPassword("");
    setPasswordResetRequested(false);
    setNewPassword("");
    setSelectedFile(null);
    setCropType(null);
  };

  const wantsPasswordChange = Boolean(newPassword);

  const passwordInvalid = Boolean(wantsPasswordChange && !currentPassword);

  /* ---------------- UI ---------------- */

  return (
    <>
      <Helmet>
        <title>PlayCrew - Account Settings</title>
      </Helmet>

      <motion.main
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {active?.wallpaper?.data && (
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${active.wallpaper.data})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              filter: "blur(10px)",
            }}
          />
        )}

        <motion.div
          className="relative z-10 w-full max-w-4xl bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl space-y-8"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-white text-xl font-bold">Account Settings</h1>

            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={passwordInvalid}
                  className={`px-4 py-1 rounded-full flex items-center gap-2 ${
                    passwordInvalid
                      ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                      : "bg-cyan-500 text-black"
                  } cursor-pointer transition-all hover:bg-cyan-400 hover:-translate-y-1 duration-300`}
                >
                  <FiCheck size={21} />
                  Save
                </button>

                <button
                  onClick={cancelEditing}
                  className="bg-gray-700 px-4 py-1 rounded-full text-white flex items-center gap-2 cursor-pointer transition-all hover:bg-red-500 hover:-translate-y-1 duration-300"
                >
                  <FiX /> Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="bg-cyan-500 px-4 py-1 rounded-full text-black flex items-center gap-2 cursor-pointer transition-all hover:bg-cyan-400 hover:-translate-y-1 duration-300"
              >
                <FiEdit2 /> Edit
              </button>
            )}
          </div>

          {/* Avatar + Wallpaper */}
          <div className="flex justify-evenly items-center">
            <ImageOverlay
              media={active?.avatar}
              editing={editing}
              rounded
              onEdit={() => setPresetType("avatar")}
              onDelete={() =>
                setDraft((p) => (p ? { ...p, avatar: undefined } : p))
              }
            />

            <ImageOverlay
              media={active?.wallpaper}
              editing={editing}
              onEdit={() => setPresetType("wallpaper")}
              onDelete={() =>
                setDraft((p) => (p ? { ...p, wallpaper: undefined } : p))
              }
            />
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) =>
              e.target.files && onSelectImage(e.target.files[0], "avatar")
            }
          />
          <input
            ref={wallpaperInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) =>
              e.target.files && onSelectImage(e.target.files[0], "wallpaper")
            }
          />

          {/* Fields */}
          <motion.div
            className="grid grid-cols-2 gap-4"
            variants={fieldsContainerVariants}
            initial="locked"
            animate={editing ? "editable" : "locked"}
          >
            <AnimatedField
              label="Username"
              name="username"
              value={active?.username || ""}
              onChange={handleChange}
              disabled={!editing}
              maxLength={15}
            />

            <AnimatedField
              label="Email"
              name="email"
              value={user?.email}
              onChange={handleChange}
              disabled={!editing}
            />
          </motion.div>

          <Textarea
            label="Bio"
            name="bio"
            value={active?.bio || ""}
            onChange={handleChange}
            disabled={!editing}
          />

          {/* Security */}
          <div className="border-t border-slate-700 pt-6 space-y-4">
            <h2 className="text-white font-semibold mb-6">
              Privact & Security
            </h2>

            <motion.div
              className="grid grid-cols-2 gap-4"
              variants={fieldsContainerVariants}
              initial="locked"
              animate={editing ? "editable" : "locked"}
            >
              <AnimatedPasswordField
                label="Current Password"
                value={currentPassword}
                show={showCurrent}
                toggle={() => setShowCurrent((p) => !p)}
                onChange={setCurrentPassword}
                disabled={!editing || passwordResetRequested}
              />

              <AnimatedPasswordField
                label="New Password"
                value={newPassword}
                show={showNew}
                toggle={() => setShowNew((p) => !p)}
                onChange={setNewPassword}
                disabled={!editing || passwordResetRequested}
              />
            </motion.div>

            {editing && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition"
              >
                Forgot your password?
              </button>
            )}
          </div>
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

        {/* <AnimatePresence>
          {!isSaving && (
            <motion.div
              className="fixed bottom-6 right-6 z-50 w-96 rounded-xl bg-slate-900 border border-slate-700 shadow-xl p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
            
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded bg-slate-800">
                  <CloudUploadAnimation progress={uploadProgress} />
                </div>

                <div className="flex-1">
                  <p className="text-sm text-white truncate">Profile Images</p>
                  <p className="text-xs text-slate-400">Uploading…</p>
                </div>

                <span className="text-xs text-slate-400">
                  {uploadProgress}%
                </span>
              </div>

    
              <div className="mt-3 h-1.5 rounded bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full bg-cyan-400"
                  initial={{ width: "0%" }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence> */}

        <AnimatePresence>
          {changingUsername ||
            (isSaving && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex flex-col items-center gap-4 text-white"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                >
                  <p className="text-md tracking-wide text-cyan-300">
                    Updating Your Account
                  </p>
                  <span className="loading loading-dots loading-xl text-cyan-300" />
                </motion.div>
              </motion.div>
            ))}
        </AnimatePresence>

        <AnimatePresence>
          {presetType && (
            <PresetModal
              type={presetType}
              onClose={() => setPresetType(null)}
              onSelectFile={(file) => {
                setPresetType(null);
                onSelectImage(file, presetType);
              }}
              onSelectPreset={async (url) => {
                const res = await fetch(url);
                const blob = await res.blob();
                const file = new File([blob], "preset.jpg", {
                  type: blob.type,
                });
                setPresetType(null);
                onSelectImage(file, presetType);
              }}
            />
          )}
        </AnimatePresence>
      </motion.main>
    </>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

function ImageOverlay({
  media,
  editing,
  rounded,
  onEdit,
  onDelete,
}: {
  media?: MediaValue;
  editing: boolean;
  rounded?: boolean;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const hasImage = Boolean(media);

  return (
    <div
      className={`relative group ${
        rounded ? "w-37 h-37 rounded-2xl" : "w-80 h-36 rounded-lg"
      } overflow-hidden border-3 border-cyan-500 bg-slate-800`}
    >
      {/* IMAGE OR PLACEHOLDER */}
      {media ? (
        media.type === "gif" ? (
          <img
            src={media.data}
            style={{
              transform: `
          translate(${media.crop.x}px, ${media.crop.y}px)
          scale(${media.crop.zoom})
        `,
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <img src={media.data} className="w-full h-full object-cover" />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-500">
          <FiCamera size={32} />
        </div>
      )}

      {/* HOVER ACTIONS */}
      {editing && (
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-black/60 flex items-center justify-center"
        >
          {/* ACTION BUTTONS */}
          <div className="flex gap-3">
            {/* EDIT / CHANGE */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="
                w-9 h-9
                rounded-full
                bg-cyan-500 hover:bg-cyan-400
                text-black
                flex items-center justify-center
                cursor-pointer transition-all hover:-translate-y-1 duration-300
              "
              title={hasImage ? "Change image" : "Add image"}
            >
              <FiCamera />
            </button>

            {/* DELETE (ONLY IF IMAGE EXISTS) */}
            {hasImage && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="
                  w-9 h-9
                  rounded-full
                  bg-red-500 hover:bg-red-400
                  text-black
                  flex items-center justify-center
                  cursor-pointer transition-all hover:-translate-y-1 duration-300
                "
                title="Delete image"
              >
                <FiTrash2 />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

const fieldVariants = {
  locked: {
    opacity: 0.6,
    y: 0,
  },
  editable: {
    opacity: 1,
    y: -2,
    transition: {
      duration: 0.25,
    },
  },
};

const fieldsContainerVariants = {
  locked: {},
  editable: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

function AnimatedField(props: any) {
  const { disabled } = props;

  return (
    <motion.div
      variants={fieldVariants}
      initial={false}
      animate={disabled ? "locked" : "editable"}
    >
      <label className="text-gray-400 text-sm mb-1 block">{props.label}</label>

      <input
        {...props}
        disabled={disabled}
        className={`w-full rounded px-3 py-2 transition-colors duration-300 ${
          disabled
            ? "bg-slate-900 border border-slate-800 text-gray-400"
            : "bg-slate-800 border border-cyan-400 text-white focus:ring-1 focus:ring-cyan-400"
        }`}
      />
    </motion.div>
  );
}

function Textarea({ label, disabled, ...props }: any) {
  return (
    <div>
      <label className="text-gray-400 text-sm mb-1 block">{label}</label>
      <textarea
        {...props}
        disabled={disabled}
        rows={3}
        className={`w-full rounded px-3 py-2 resize-none ${
          disabled
            ? "bg-slate-900 border border-slate-800 text-gray-400"
            : "bg-slate-800 border border-slate-600 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
        }`}
      />
    </div>
  );
}

function AnimatedPasswordField({
  label,
  value,
  show,
  toggle,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  show: boolean;
  toggle: () => void;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      variants={fieldVariants}
      initial={false}
      animate={disabled ? "locked" : "editable"}
    >
      <label className="text-gray-400 text-sm mb-1 block">{label}</label>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded px-3 py-2 pr-10 transition-colors duration-300 ${
            disabled
              ? "bg-slate-900 border border-slate-800 text-gray-400 cursor-not-allowed"
              : "bg-slate-800 border border-cyan-400 text-white focus:ring-1 focus:ring-cyan-400"
          }`}
        />

        {/* Eye icon */}
        {!disabled && (
          <button
            type="button"
            onClick={toggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 cursor-pointer ease-in-out duration-300 transition-all"
          >
            {show ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function CropModal({
  file,
  crop,
  zoom,
  setCrop,
  setZoom,
  aspect,
  onComplete,
  onSave,
  onCancel,
}: {
  file: File;
  crop: { x: number; y: number };
  zoom: number;
  setCrop: (v: { x: number; y: number }) => void;
  setZoom: (v: number) => void;
  aspect: number;
  onComplete: (area: Area) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-slate-900 p-4 rounded-lg w-full max-w-xl space-y-4"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
      >
        <div className="relative h-80">
          <Cropper
            image={URL.createObjectURL(file)}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, area) => onComplete(area)}
          />
        </div>
        <input
          className="w-full"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onSave}
            className="bg-cyan-500 px-4 py-1 rounded text-black"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="bg-red-500 px-4 py-1 rounded text-black"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
