"use client";

import { useState, useEffect, ChangeEvent, useRef } from "react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { updatePassword, updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useUser } from "../../../context/UserContext";
import { db } from "@/app/lib/firebase";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { Helmet } from "react-helmet-async";
import { FiEye, FiEyeOff, FiEdit2, FiCheck } from "react-icons/fi";
import getCroppedImg from "@/app/lib/getCroppedImg";

type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  avatarBase64?: string;
  wallpaperBase64?: string | null;
};

export default function EditProfilePage() {
  const { user, profile, setProfile, loading } = useUser();

  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(
    null,
  );
  const [editing, setEditing] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [selectedWallpaper, setSelectedWallpaper] = useState<File | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropType, setCropType] = useState<"avatar" | "wallpaper" | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  //Refrences for the wallpaper and avatar images
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) setOriginalProfile(profile as UserProfile);
  }, [profile]);

  if (loading || !profile || !originalProfile)
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner />
      </div>
    );

  const showError = (err: any, type: string) => {
    toast.error(`${type} upload failed: ${err.message || err}`);
  };

  const handleProfileChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) =>
    editing &&
    profile &&
    setProfile({ ...profile, [e.target.name]: e.target.value });

  const handleUpdateDoc = async (
    field: "avatarBase64" | "wallpaperBase64",
    value: string | null,
  ) => {
    if (!user || !profile) return;
    await updateDoc(doc(db, "users", user.uid), { [field]: value });
    setProfile({ ...profile, [field]: value ?? undefined });
  };

  const handleFileUpload = async (file: File, type: "avatar" | "wallpaper") => {
    if (type === "avatar") {
      setSelectedAvatar(file);
      if (file.type !== "image/gif") setCropType("avatar");
    } else {
      setSelectedWallpaper(file);
      if (file.type !== "image/gif") setCropType("wallpaper");
    }

    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const saveCropped = async () => {
    if (!croppedAreaPixels || !cropType) return;
    try {
      const file = cropType === "avatar" ? selectedAvatar : selectedWallpaper;
      if (!file) return;

      const base64 = await getCroppedImg(
        URL.createObjectURL(file),
        croppedAreaPixels,
      );

      if (cropType === "avatar") {
        setSelectedAvatar(new File([file], file.name, { type: file.type }));
        setAvatarPreview(base64); // show cropped preview
      } else {
        setSelectedWallpaper(new File([file], file.name, { type: file.type }));
        setWallpaperPreview(base64); // show cropped preview
      }

      toast.success(
        `${cropType === "avatar" ? "Avatar" : "Wallpaper"} ready to save!`,
      );
      setCropType(null);
    } catch (err) {
      showError(err, cropType === "avatar" ? "Avatar" : "Wallpaper");
    }
  };

  const removeAvatar = async () =>
    handleUpdateDoc("avatarBase64", null)
      .then(() => toast.success("Avatar removed!"))
      .catch((err) => showError(err, "Avatar"));
  const removeWallpaper = async () =>
    handleUpdateDoc("wallpaperBase64", null)
      .then(() => toast.success("Wallpaper removed!"))
      .catch((err) => showError(err, "Wallpaper"));

  const changePassword = async () => {
    if (!user || !password) return toast.error("Password cannot be empty.");
    try {
      await updatePassword(user, password);
      toast.success("Password updated!");
      setPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password.");
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;

    const updates: Partial<UserProfile> = {};

    // Check normal fields
    (
      ["username", "displayName", "email", "bio"] as (keyof UserProfile)[]
    ).forEach((field) => {
      if (profile[field] !== originalProfile[field])
        updates[field] = profile[field];
    });

    // Process avatar
    if (selectedAvatar) {
      const base64 =
        selectedAvatar.type === "image/gif"
          ? await fileToBase64(selectedAvatar)
          : await getCroppedImg(
              URL.createObjectURL(selectedAvatar),
              croppedAreaPixels!,
            );
      updates.avatarBase64 = base64;
      setSelectedAvatar(null);
      setCropType(null);
    }

    // Process wallpaper
    if (selectedWallpaper) {
      const base64 =
        selectedWallpaper.type === "image/gif"
          ? await fileToBase64(selectedWallpaper)
          : await getCroppedImg(
              URL.createObjectURL(selectedWallpaper),
              croppedAreaPixels!,
            );
      updates.wallpaperBase64 = base64;
      setSelectedWallpaper(null);
      setCropType(null);
    }

    if (Object.keys(updates).length === 0) {
      toast("Nothing changed");
      setEditing(false);
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), updates);

      const authUpdates: { displayName?: string; email?: string } = {};
      if (updates.displayName) authUpdates.displayName = updates.displayName;
      if (updates.email && updates.email !== user.email)
        authUpdates.email = updates.email;

      if (Object.keys(authUpdates).length) {
        await updateProfile(user, authUpdates);
        if (authUpdates.email) await user.reload();
      }

      toast.success("Profile updated!");
      setOriginalProfile({ ...originalProfile, ...updates } as UserProfile);
      setProfile({ ...profile, ...updates } as UserProfile);
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    }
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const getInitials = (name?: string) =>
    name
      ? name
          .split(" ")
          .map((n) => n[0].toUpperCase())
          .join("")
          .slice(0, 2)
      : "U";

  const InputField = ({
    label,
    name,
    type = "text",
  }: {
    label: string;
    name: keyof UserProfile;
    type?: string;
  }) => (
    <div className="flex flex-col">
      <label className="text-gray-400 text-sm mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={profile[name] || ""}
        disabled={!editing}
        onChange={handleProfileChange}
        className={`w-full px-3 py-2 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 ${
          !editing ? "opacity-60 cursor-not-allowed" : ""
        }`}
      />
    </div>
  );

  return (
    <>
      <Helmet>
        <title>PlayCrew - {profile.displayName || profile.username}</title>
      </Helmet>

      <motion.main
        className="relative min-h-screen flex justify-center items-center p-4 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* BLURRED BACKGROUND */}
        {profile.wallpaperBase64 && (
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url(${profile.wallpaperBase64})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(25px)",
            }}
          />
        )}

        {/* DARK OVERLAY */}
        <div className="absolute inset-0 bg-black/60" />

        <div className="w-full max-w-3xl bg-gray-900 bg-opacity-90 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 relative z-10">
          <div className="flex justify-between items-center px-3 py-1">
            <h1 className="text-2xl font-bold text-white flex-1">
              Account Settings
            </h1>
            <motion.button
              onClick={editing ? handleUpdateProfile : () => setEditing(true)}
              className="flex items-center gap-2 px-3 py-1 font-semibold rounded-lg text-black transition-colors bg-cyan-500 hover:bg-cyan-400"
              whileTap={{ scale: 0.95 }}
            >
              {editing ? <FiCheck size={20} /> : <FiEdit2 size={20} />}
              {editing ? "Save" : "Edit"}
            </motion.button>
          </div>
          <hr className="text-gray-700" />

          <div className="grid grid-cols-2 items-center">
            {/* Avatar */}
            <div className="relative w-32 h-32 rounded-full border-4 border-cyan-500 shadow-lg overflow-hidden">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar Preview"
                  className="w-full h-full object-cover"
                />
              ) : profile.avatarBase64 ? (
                <img
                  src={profile.avatarBase64}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-cyan-500 flex items-center justify-center text-3xl font-bold text-black">
                  {getInitials(profile.displayName || profile.username)}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-3 lg:pl-[18px]">
              <label
                className={`px-5 py-1 bg-cyan-500 rounded-full cursor-pointer text-black font-semibold hover:bg-cyan-400 transition ${
                  !editing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Change
                <input
                  type="file"
                  className="hidden"
                  disabled={!editing}
                  onChange={(e) => {
                    if (!e.target.files?.[0]) return;
                    handleFileUpload(e.target.files[0], "avatar");
                  }}
                />
              </label>

              <button
                disabled={!editing}
                onClick={removeAvatar}
                className={`px-5 py-1 bg-red-500 rounded-full text-black font-semibold hover:bg-red-400  ${
                  !editing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Remove
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Wallpaper */}
            <div className="relative w-[50%] h-48 overflow-hidden">
              {wallpaperPreview ? (
                <img
                  src={wallpaperPreview}
                  alt="Wallpaper Preview"
                  className="w-full h-full object-cover rounded-lg border-4 border-cyan-500 shadow-lg"
                />
              ) : profile.wallpaperBase64 ? (
                <img
                  src={profile.wallpaperBase64}
                  alt="Wallpaper"
                  className="w-full h-full object-cover rounded-lg border-4 border-cyan-500 shadow-lg"
                />
              ) : (
                <div className="w-full h-full bg-cyan-500 flex items-center justify-center text-xl font-bold text-black">
                  Wallpaper
                </div>
              )}
            </div>

            <div className="flex gap-2 mx-auto">
              <label
                className={`px-5 py-1 bg-cyan-500 rounded-full cursor-pointer text-black font-semibold hover:bg-cyan-400 transition ${
                  !editing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Change
                <input
                  ref={wallpaperInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!editing}
                  onChange={(e) => {
                    if (!e.target.files || !e.target.files[0]) return;
                    const file = e.target.files[0];
                    handleFileUpload(file, "wallpaper");

                    if (wallpaperInputRef.current)
                      wallpaperInputRef.current.value = "";
                  }}
                />
              </label>
              {profile.wallpaperBase64 && (
                <button
                  disabled={!editing}
                  onClick={removeWallpaper}
                  className={`px-5 py-1 bg-red-500 rounded-full hover:bg-red-400 text-black font-semibold  ${
                    !editing ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Username" name="username" />
            <InputField label="Display Name" name="displayName" />
            <InputField label="Email" name="email" type="email" />

            {/* Password */}
            <div className="flex flex-col">
              <label className="text-gray-400 text-sm mb-1">Password</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!editing}
                  placeholder="Set New Password"
                  className={`flex-1 px-3 py-2 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 pr-10 ${
                    !editing ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                />
                <div
                  className="absolute right-3 cursor-pointer text-gray-400 hover:text-cyan-400"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </div>
              </div>
              {editing && (
                <button
                  onClick={changePassword}
                  className="w-1/2 mx-auto mt-2 py-1 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                >
                  Update
                </button>
              )}
            </div>

            {/* Bio */}
            <div className="flex flex-col md:col-span-2">
              <label className="text-gray-400 text-sm mb-1">Bio</label>
              <textarea
                name="bio"
                value={profile.bio || ""}
                disabled={!editing}
                onChange={handleProfileChange}
                rows={3}
                className={`w-full px-3 py-2 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none ${
                  !editing ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>
          {/* <div className="w-full flex justify-center">
            <motion.button
              onClick={editing ? handleUpdateProfile : () => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 font-semibold rounded-2xl text-black transition-colors bg-cyan-500 hover:bg-cyan-400"
              whileTap={{ scale: 0.95 }}
            >
              {editing ? <FiCheck size={20} /> : <FiEdit2 size={20} />}
              {editing ? "Save" : "Edit"}
            </motion.button>
          </div> */}
        </div>

        {/* Crop Modal */}
        {cropType &&
          (cropType === "avatar" ? selectedAvatar : selectedWallpaper) && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-gray-900 rounded-lg p-4 flex flex-col items-center gap-3 w-full max-w-xl">
                <h2 className="text-white font-bold">
                  {cropType === "avatar" ? "Crop Avatar" : "Crop Wallpaper"}
                </h2>
                <div
                  className={`relative w-full ${
                    cropType === "avatar" ? "h-80" : "h-96"
                  }`}
                >
                  <Cropper
                    image={URL.createObjectURL(
                      cropType === "avatar"
                        ? selectedAvatar!
                        : selectedWallpaper!,
                    )}
                    crop={crop}
                    zoom={zoom}
                    aspect={cropType === "avatar" ? 1 : 16 / 9}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, croppedAreaPixels) =>
                      setCroppedAreaPixels(croppedAreaPixels)
                    }
                  />
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveCropped}
                    className="px-4 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400"
                  >
                    {uploadingWallpaper || uploadingAvatar
                      ? "Uploading..."
                      : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setCropType(null);
                      setCroppedAreaPixels(null);

                      setSelectedAvatar(null);
                      setSelectedWallpaper(null);

                      setAvatarPreview(null);
                      setWallpaperPreview(null);
                    }}
                    className="px-4 py-2 bg-red-500 text-black rounded hover:bg-red-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
      </motion.main>
    </>
  );
}
