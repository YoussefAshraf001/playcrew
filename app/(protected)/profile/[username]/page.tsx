"use client";

import { useEffect, useState, ChangeEvent, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  updateEmail,
  sendEmailVerification,
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
} from "firebase/firestore";
import {
  FiEdit2,
  FiCheck,
  FiX,
  FiEye,
  FiEyeOff,
  FiCamera,
} from "react-icons/fi";
import { Helmet } from "react-helmet-async";

import { useUser } from "../../../context/UserContext";
import { db, auth } from "@/app/lib/firebase";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import getCroppedImg from "@/app/lib/getCroppedImg";
import { useRouter } from "next/navigation";

/* ---------------- TYPES ---------------- */

type UserProfile = {
  uid: string;
  username?: string;
  email?: string;
  bio?: string;
  avatarBase64?: string;
  wallpaperBase64?: string | null;
};

/* ---------------- COMPONENT ---------------- */

export default function EditProfilePage() {
  const { user, profile, setProfile, loading } = useUser();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [original, setOriginal] = useState<UserProfile | null>(null);

  /* Password */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingUsername, setChangingUsername] = useState(false);

  /* Image crop */
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
    setSelectedFile(file);
    setCropType(type);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const saveCrop = async () => {
    if (!selectedFile || !croppedPixels || !cropType) return;

    const base64 = await getCroppedImg(
      URL.createObjectURL(selectedFile),
      croppedPixels,
    );

    setDraft((p) => ({
      ...(p ?? profile),
      [cropType === "avatar" ? "avatarBase64" : "wallpaperBase64"]: base64,
    }));

    toast.success(
      `${cropType === "avatar" ? "Avatar" : "Wallpaper"} ready to save`,
    );

    setCropType(null);
    setSelectedFile(null);
  };

  /* ---------------- SAVE / CANCEL ---------------- */

  const saveProfile = async () => {
    if (!draft || !original) return;

    try {
      // ---------------- USERNAME VALIDATION (ON SAVE ONLY) ----------------
      if (draft.username) {
        if (draft.username.length < 3) {
          toast.error("Username must be at least 3 characters");
          return;
        }

        if (!USERNAME_REGEX.test(draft.username)) {
          toast.error("Username must use only letters, numbers, - or _");
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

          toast.success(
            "Verification email sent to your new address. Please check your spam folder if needed.",
            {
              duration: 6000, // 6 seconds
            },
          );

          // Optional but recommended
          await auth.signOut();
          router.push("/login");
          return;
        } catch (err: any) {
          console.error("Verify-before-update error:", err.code, err.message);

          if (err.code === "auth/email-already-in-use") {
            toast.error("This email is already in use.");
          } else if (err.code === "auth/invalid-email") {
            toast.error("Invalid email address.");
          } else if (err.code === "auth/requires-recent-login") {
            toast.error("Please log in again to change your email.");
            await auth.signOut();
            router.push("/login");
          } else {
            toast.error("Failed to send verification email.");
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
          toast.error("Current password is incorrect");
          return;
        }
      }

      /* ---------------- PROFILE UPDATES ---------------- */

      const updates: Partial<UserProfile> = {};

      if (draft.username !== original.username) {
        if (!draft.username) {
          toast.error("Username required");
          return;
        }

        if (await isUsernameTaken(draft.username)) {
          toast.error("Username already taken");
          return;
        }

        updates.username = draft.username;
      }

      if (draft.email !== original.email) updates.email = draft.email;
      if (draft.bio !== original.bio) updates.bio = draft.bio;

      if (draft.avatarBase64 !== original.avatarBase64)
        updates.avatarBase64 = draft.avatarBase64;

      if (draft.wallpaperBase64 !== original.wallpaperBase64)
        updates.wallpaperBase64 = draft.wallpaperBase64;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, "users", user!.uid), updates);
        setProfile({ ...profile!, ...updates });
      }

      if (updates.username) {
        setChangingUsername(true);

        // small delay purely for UX (optional but recommended)
        setTimeout(() => {
          router.replace(`/profile/${updates.username}`);
        }, 600);
      }

      /* ---------------- CLEANUP ---------------- */

      setEditing(false);
      setDraft(null);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordResetRequested(false);
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Failed to save changes");
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

  const emailChanged = draft?.email !== original?.email;
  const wantsPasswordChange = Boolean(newPassword);

  const passwordInvalid = Boolean(wantsPasswordChange && !currentPassword);

  /* ---------------- UI ---------------- */

  return (
    <>
      <Helmet>
        <title>PlayCrew - {profile.username}'s Profile</title>
      </Helmet>

      <motion.main
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {active?.wallpaperBase64 && (
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${active.wallpaperBase64})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(30px)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/60" />

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
                  className={`px-4 py-1 rounded flex items-center gap-2 ${
                    passwordInvalid
                      ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                      : "bg-cyan-500 text-black"
                  }`}
                >
                  <FiCheck /> Save
                </button>

                <button
                  onClick={cancelEditing}
                  className="bg-gray-700 px-4 py-1 rounded text-white flex items-center gap-2"
                >
                  <FiX /> Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="bg-cyan-500 px-4 py-1 rounded text-black flex items-center gap-2"
              >
                <FiEdit2 /> Edit
              </button>
            )}
          </div>

          {/* Avatar + Wallpaper */}
          <div className="flex justify-center gap-30">
            <ImageOverlay
              src={active?.avatarBase64}
              editing={editing}
              rounded
              onClick={() => avatarInputRef.current?.click()}
            />
            <ImageOverlay
              src={active?.wallpaperBase64}
              editing={editing}
              onClick={() => wallpaperInputRef.current?.click()}
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

        <AnimatePresence>
          {changingUsername && (
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
                <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm tracking-wide text-cyan-300">
                  Changing username…
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

function ImageOverlay({
  src,
  editing,
  rounded,
  onClick,
}: {
  src?: string | null;
  editing: boolean;
  rounded?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`relative ${
        rounded ? "w-28 h-28 rounded-full" : "w-80 h-36 rounded-lg"
      } overflow-hidden border-2 border-cyan-500 bg-slate-800`}
    >
      {/* Image or placeholder */}
      {src ? (
        <img
          src={src}
          className="w-full h-full object-cover"
          alt="Profile image"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1">
          <FiCamera className="text-3xl opacity-40" />
          <span className="text-xs opacity-50">Add image</span>
        </div>
      )}

      {/* Edit overlay */}
      {editing && (
        <motion.div
          onClick={onClick}
          className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <FiCamera className="text-white text-2xl" />
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
