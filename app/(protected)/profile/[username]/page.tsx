"use client";

import { useState, useEffect, ChangeEvent, useRef } from "react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { updatePassword, updateProfile } from "firebase/auth";
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
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
    null
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
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) =>
    editing &&
    profile &&
    setProfile({ ...profile, [e.target.name]: e.target.value });

  const handleUpdateDoc = async (
    field: "avatarBase64" | "wallpaperBase64",
    value: string | null
  ) => {
    if (!user || !profile) return;
    await updateDoc(doc(db, "users", user.uid), { [field]: value });
    setProfile({ ...profile, [field]: value ?? undefined });
  };

  const handleFileUpload = async (file: File, type: "avatar" | "wallpaper") => {
    const isGif = file.type === "image/gif";

    if (isGif) {
      const toastId = toast.loading(`Uploading ${type}...`);
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          await handleUpdateDoc(
            type === "avatar" ? "avatarBase64" : "wallpaperBase64",
            reader.result as string
          );
          toast.success(
            `${type === "avatar" ? "Avatar" : "Wallpaper"} uploaded!`,
            { id: toastId }
          );
        } catch (err) {
          showError(err, type === "avatar" ? "Avatar" : "Wallpaper");
        } finally {
          toast.dismiss(toastId);
        }
      };

      reader.onerror = (err) => {
        showError(err, type === "avatar" ? "Avatar" : "Wallpaper");
        toast.dismiss(toastId);
      };

      reader.readAsDataURL(file);
    } else {
      // open crop modal for non-GIF images
      if (type === "avatar") {
        setSelectedAvatar(file);
        setCropType("avatar");
      } else {
        setSelectedWallpaper(file);
        setCropType("wallpaper");
      }
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    }
  };

  const saveCropped = async () => {
    if (!croppedAreaPixels || !cropType) return;
    try {
      const file = cropType === "avatar" ? selectedAvatar : selectedWallpaper;
      if (!file) return;
      const base64 = await getCroppedImg(
        URL.createObjectURL(file),
        croppedAreaPixels
      );
      if (cropType === "avatar") {
        setUploadingAvatar(true);
        await handleUpdateDoc("avatarBase64", base64);
        setSelectedAvatar(null);
        setUploadingAvatar(false);
      } else {
        setUploadingWallpaper(true);
        await handleUpdateDoc("wallpaperBase64", base64);
        setSelectedWallpaper(null);
        setUploadingWallpaper(false);
      }
      toast.success(`${cropType === "avatar" ? "Avatar" : "Wallpaper"} saved!`);
      setCropType(null);
    } catch (err) {
      showError(err, cropType === "avatar" ? "Avatar" : "Wallpaper");
      if (cropType === "avatar") {
        setUploadingAvatar(false);
      } else {
        setUploadingWallpaper(false);
      }
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
    (
      ["username", "displayName", "email", "bio"] as (keyof UserProfile)[]
    ).forEach((field) => {
      if (profile[field] !== originalProfile[field])
        updates[field] = profile[field];
    });

    if (updates.username) {
      const q = query(
        collection(db, "users"),
        where("username", "==", updates.username)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty && snapshot.docs[0].id !== user.uid)
        return toast.error("Username already taken!");
    }

    if (
      Object.keys(updates).length === 0 &&
      !selectedAvatar &&
      !selectedWallpaper
    )
      return toast("Nothing changed.");

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
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    }
  };

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
        <title>PlayCrew</title>
      </Helmet>

      <motion.main
        className="min-h-screen flex justify-center items-center p-4 relative"
        style={
          profile.wallpaperBase64
            ? {
                backgroundImage: `url(${profile.wallpaperBase64})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { backgroundColor: "#000" }
        }
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
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

          {/* Avatar */}
          <div className="grid grid-cols-2 items-center">
            {/* Preview */}
            <div className="flex justify-center">
              <div className="relative w-32 h-32 rounded-full border-4 border-cyan-500 shadow-lg overflow-hidden">
                {profile.avatarBase64 ? (
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

          {/* Wallpaper */}
          <div className="flex items-center gap-3">
            <div className="relative w-[50%] h-48 overflow-hidden">
              {profile.wallpaperBase64 ? (
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
                        : selectedWallpaper!
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
                    onClick={() => setCropType(null)}
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

// "use client";

// import { useEffect, useState, ChangeEvent, useRef } from "react";
// import AvatarEditor from "react-avatar-editor";
// import { useRouter } from "next/navigation";
// import toast from "react-hot-toast";
// import { motion, AnimatePresence } from "framer-motion";
// import { updateProfile } from "firebase/auth";
// import { doc, updateDoc } from "firebase/firestore";
// import { useUser } from "../../../context/UserContext";
// import { db } from "@/app/lib/firebase";
// import LoadingSpinner from "@/app/components/LoadingSpinner";
// import { Helmet } from "react-helmet-async";

// export default function EditProfilePage() {
//   const router = useRouter();
//   const { user, profile, setProfile, loading } = useUser();

//   const [isEditing, setIsEditing] = useState(false);
//   const [showModal, setShowModal] = useState(false);
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [scale, setScale] = useState(1);
//   const [uploading, setUploading] = useState(false);
//   const editorRef = useRef<AvatarEditor>(null);

//   useEffect(() => {
//     if (!loading && !user) router.push("/login");
//   }, [loading, user, router]);

//   if (loading || !profile)
//     return (
//       <div className="flex items-center justify-center min-h-screen bg-black">
//         <LoadingSpinner />
//       </div>
//     );

//   const handleChange = (
//     e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
//   ) => {
//     if (!profile) return;
//     setProfile({ ...profile, [e.target.name]: e.target.value });
//   };

//   const handleSave = async () => {
//     if (!user || !profile) return;
//     try {
//       await updateDoc(doc(db, "users", user.uid), profile);
//       await updateProfile(user, { displayName: profile.displayName });
//       toast.success("Profile updated!");
//       setIsEditing(false);
//     } catch (err) {
//       console.error(err);
//       toast.error("Failed to save profile.");
//     }
//   };

//   const handleRemoveAvatar = async () => {
//     if (!user || !profile) return;
//     try {
//       await updateDoc(doc(db, "users", user.uid), { avatarBase64: null });
//       setProfile({ ...profile, avatarBase64: undefined });
//       toast.success("Avatar removed!");
//     } catch (err) {
//       console.error(err);
//       toast.error("Failed to remove avatar.");
//     }
//   };

//   const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setSelectedFile(e.target.files[0]);
//       setShowModal(true);
//     }
//   };

//   const handleAvatarSave = async () => {
//     if (!editorRef.current || !user || !profile) return;
//     setUploading(true);

//     const canvas = editorRef.current.getImageScaledToCanvas();
//     const base64 = canvas.toDataURL("image/png");

//     try {
//       await updateDoc(doc(db, "users", user.uid), { avatarBase64: base64 });
//       setProfile({ ...profile, avatarBase64: base64 });
//       toast.success("Avatar updated!");
//       setShowModal(false);
//       setSelectedFile(null);
//     } catch (err) {
//       console.error(err);
//       toast.error("Failed to update avatar.");
//     } finally {
//       setUploading(false);
//     }
//   };

//   const getInitials = (name?: string) => {
//     if (!name) return "U";
//     return name
//       .split(" ")
//       .map((n) => n[0].toUpperCase())
//       .join("")
//       .slice(0, 2);
//   };

//   return (
//     <>
//       <Helmet>
//         <title>PlayCrew</title>
//       </Helmet>

//       <motion.main
//         className="min-h-screen bg-black flex justify-center items-center p-4"
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         exit={{ opacity: 0 }}
//       >
//         <div className="w-full max-w-4xl bg-gray-900 rounded-3xl p-10 shadow-2xl flex flex-col gap-8">
//           {/* Header */}
//           <div className="flex justify-between items-center">
//             <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
//             <button
//               onClick={() => setIsEditing(!isEditing)}
//               className="px-5 py-2 rounded-full font-semibold bg-linear-to-r from-cyan-500 to-blue-500 text-black hover:from-cyan-400 hover:to-blue-400 transition"
//             >
//               {isEditing ? "Cancel" : "Edit"}
//             </button>
//           </div>

//           <div className="flex flex-col md:flex-row gap-10 items-center">
//             {/* Avatar */}
//             <div className="relative">
//               {profile.avatarBase64 || profile.avatarUrl ? (
//                 <img
//                   src={profile.avatarBase64 || profile.avatarUrl!}
//                   alt="Avatar"
//                   className="w-40 h-40 rounded-full border-4 border-cyan-500 shadow-lg object-cover"
//                 />
//               ) : (
//                 <div className="w-40 h-40 rounded-full bg-cyan-500 flex items-center justify-center text-5xl font-bold text-black border-4 border-cyan-400 shadow-lg">
//                   {getInitials(profile.displayName || profile.username)}
//                 </div>
//               )}

//               {isEditing && (
//                 <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 rounded-full bg-black/50">
//                   <label className="cursor-pointer w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center hover:bg-cyan-400 transition">
//                     <input
//                       type="file"
//                       accept="image/*"
//                       className="hidden"
//                       onChange={handleFileChange}
//                     />
//                     <svg
//                       className="w-5 h-5 text-black"
//                       fill="currentColor"
//                       viewBox="0 0 20 20"
//                     >
//                       <path d="M4 5a2 2 0 012-2h2a2 2 0 012 2h4a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
//                     </svg>
//                   </label>
//                   {profile.avatarBase64 && (
//                     <button
//                       onClick={handleRemoveAvatar}
//                       className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition"
//                     >
//                       <svg
//                         className="w-5 h-5 text-black"
//                         fill="currentColor"
//                         viewBox="0 0 20 20"
//                       >
//                         <path
//                           fillRule="evenodd"
//                           d="M6 6a1 1 0 011-1h6a1 1 0 011 1v10a1 1 0 01-1 1H7a1 1 0 01-1-1V6z"
//                           clipRule="evenodd"
//                         />
//                       </svg>
//                     </button>
//                   )}
//                 </div>
//               )}
//             </div>

//             {/* Profile Fields */}
//             <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
//               {[
//                 { label: "Username", name: "username", type: "text" },
//                 { label: "Display Name", name: "displayName", type: "text" },
//                 { label: "Email", name: "email", type: "email" },
//               ].map((field) => (
//                 <div key={field.name} className="relative">
//                   <input
//                     type={field.type}
//                     name={field.name}
//                     value={profile[field.name] || ""}
//                     onChange={handleChange}
//                     disabled={!isEditing}
//                     className={`w-full px-4 pt-5 pb-4 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition peer ${
//                       !isEditing ? "opacity-60 cursor-not-allowed" : ""
//                     }`}
//                     placeholder=" "
//                   />
//                   <label className="absolute left-4 top-1 mb-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-500 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-sm peer-focus:text-cyan-400">
//                     {field.label}
//                   </label>
//                 </div>
//               ))}

//               {/* Bio */}
//               <div className="relative md:col-span-2">
//                 <textarea
//                   name="bio"
//                   value={profile.bio || ""}
//                   onChange={handleChange}
//                   disabled={!isEditing}
//                   rows={3}
//                   className={`w-full px-4 pt-5 pb-2 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none transition peer ${
//                     !isEditing ? "opacity-60 cursor-not-allowed" : ""
//                   }`}
//                   placeholder=" "
//                 />
//                 <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-500 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-sm peer-focus:text-cyan-400">
//                   Bio
//                 </label>
//               </div>
//             </div>
//           </div>

//           {/* Save Button */}
//           {isEditing && (
//             <div className="flex justify-end mt-6">
//               <button
//                 onClick={handleSave}
//                 className="px-6 py-2 rounded-full bg-linear-to-r from-cyan-500 to-blue-500 text-black font-semibold hover:from-cyan-400 hover:to-blue-400 transition"
//               >
//                 Save
//               </button>
//             </div>
//           )}
//         </div>

//         {/* Avatar Modal */}
//         <AnimatePresence>
//           {showModal && selectedFile && (
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
//             >
//               <motion.div
//                 initial={{ scale: 0.9 }}
//                 animate={{ scale: 1 }}
//                 exit={{ scale: 0.9 }}
//                 className="bg-gray-800 p-6 md:p-10 rounded-2xl flex flex-col items-center gap-4"
//               >
//                 <AvatarEditor
//                   ref={editorRef}
//                   image={selectedFile}
//                   width={250}
//                   height={250}
//                   border={60}
//                   borderRadius={125}
//                   scale={scale}
//                 />
//                 <input
//                   type="range"
//                   min="1"
//                   max="2"
//                   step="0.01"
//                   value={scale}
//                   onChange={(e) => setScale(parseFloat(e.target.value))}
//                   className="w-full mt-2"
//                 />
//                 <div className="flex gap-4 mt-2">
//                   <button
//                     onClick={handleAvatarSave}
//                     disabled={uploading}
//                     className="px-5 py-2 rounded-full bg-linear-to-r from-cyan-500 to-blue-500 text-black font-semibold hover:from-cyan-400 hover:to-blue-400 transition"
//                   >
//                     {uploading ? "Saving..." : "Save"}
//                   </button>
//                   <button
//                     onClick={() => {
//                       setShowModal(false);
//                       setSelectedFile(null);
//                     }}
//                     className="px-5 py-2 rounded-full bg-red-500 hover:bg-red-400 text-black font-semibold transition"
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </motion.div>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </motion.main>
//     </>
//   );
// }
