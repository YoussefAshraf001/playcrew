"use client";

import { useEffect, useState, ChangeEvent, useRef } from "react";
import AvatarEditor from "react-avatar-editor";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useUser } from "../../../context/UserContext";
import { db } from "@/app/lib/firebase";
import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile, setProfile, loading } = useUser();

  const [isEditing, setIsEditing] = useState(false);

  // Avatar modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef<AvatarEditor>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !profile) {
    return (
      <motion.div
        className="flex flex-col items-center gap-4 min-h-screen justify-center bg-black text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
      </motion.div>
    );
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!profile) return;
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, "users", user.uid), profile);
      await updateProfile(user, { displayName: profile.displayName });
      toast.success("Profile updated!");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save profile.");
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { avatarBase64: null });
      setProfile({ ...profile, avatarBase64: undefined });
      toast.success("Avatar removed!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove avatar.");
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setShowModal(true);
    }
  };

  const handleAvatarSave = async () => {
    if (!editorRef.current || !user || !profile) return;
    setUploading(true);

    const canvas = editorRef.current.getImageScaledToCanvas();
    const base64 = canvas.toDataURL("image/png");

    try {
      await updateDoc(doc(db, "users", user.uid), { avatarBase64: base64 });
      setProfile({ ...profile, avatarBase64: base64 });
      toast.success("Avatar updated!");
      setShowModal(false);
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update avatar.");
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0].toUpperCase())
      .join("")
      .slice(0, 2);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.main
      className="min-h-screen bg-black flex justify-center items-start px-6 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="w-full max-w-5xl bg-zinc-900 rounded-2xl p-8 flex flex-col gap-6 shadow-neon">
        {/* Edit / Cancel Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-cyan-500 text-black px-4 py-2 rounded-lg font-bold hover:bg-cyan-400 transition"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        </div>

        <div className="flex gap-8">
          {/* Left: Avatar */}
          <div className="flex flex-col items-center w-1/3 relative">
            <label
              className={`cursor-pointer group ${
                !isEditing ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {profile.avatarBase64 ? (
                <img
                  src={profile.avatarBase64}
                  alt="Avatar"
                  className="w-40 h-40 rounded-full border-4 border-cyan-500 shadow-glow object-cover"
                />
              ) : profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-40 h-40 rounded-full border-4 border-cyan-500 shadow-glow object-cover"
                />
              ) : (
                <div className="w-40 h-40 rounded-full bg-cyan-500 flex items-center justify-center text-5xl font-bold text-black border-4 border-cyan-400 shadow-glow">
                  {getInitials(profile.displayName || profile.username)}
                </div>
              )}

              {isEditing && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="absolute bottom-2 right-2 bg-cyan-600 text-black font-bold text-xs px-2 py-1 rounded opacity-100 transition">
                    Change
                  </span>
                </>
              )}
            </label>

            {isEditing && profile.avatarBase64 && (
              <button
                onClick={handleRemoveAvatar}
                className="mt-2 px-4 py-1 bg-red-500 text-black rounded-lg font-bold text-xs hover:bg-red-400 transition"
              >
                Remove Avatar
              </button>
            )}

            <p className="text-zinc-400 text-center text-sm mt-2">
              Recommended: 98x98px, 2MB max, PNG or JPG.
            </p>
          </div>

          {/* Right: Profile Fields */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Username */}
            <div>
              <label className="text-zinc-400 text-sm">Username</label>
              <input
                type="text"
                name="username"
                value={profile.username || ""}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full bg-zinc-800 border-2 border-cyan-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  !isEditing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="text-zinc-400 text-sm">Display Name</label>
              <input
                type="text"
                name="displayName"
                value={profile.displayName || ""}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full bg-zinc-800 border-2 border-cyan-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  !isEditing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-zinc-400 text-sm">Email</label>
              <input
                type="email"
                name="email"
                value={profile.email || ""}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full bg-zinc-800 border-2 border-cyan-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                  !isEditing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </div>

            {/* Bio */}
            <div>
              <label className="text-zinc-400 text-sm">Bio</label>
              <textarea
                name="bio"
                value={profile.bio || ""}
                onChange={handleChange}
                disabled={!isEditing}
                className={`w-full bg-zinc-800 border-2 border-cyan-500 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none ${
                  !isEditing ? "opacity-50 cursor-not-allowed" : ""
                }`}
                rows={3}
              />
            </div>

            {/* Save Button */}
            {isEditing && (
              <button
                onClick={handleSave}
                className="self-start bg-cyan-500 text-black px-6 py-2 rounded-lg font-bold hover:bg-cyan-400 transition"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Avatar Modal */}
      {showModal && selectedFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-zinc-900 p-6 rounded-xl flex flex-col items-center gap-4 animate-scaleIn">
            <AvatarEditor
              ref={editorRef}
              image={selectedFile}
              width={200}
              height={200}
              border={50}
              borderRadius={100}
              scale={scale}
            />
            <input
              type="range"
              min="1"
              max="2"
              step="0.01"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full mt-2"
            />
            <div className="flex gap-4 mt-2">
              <button
                onClick={handleAvatarSave}
                disabled={uploading}
                className="px-4 py-2 bg-cyan-500 text-black rounded-lg font-bold"
              >
                {uploading ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 bg-red-500 text-black rounded-lg font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.main>
  );
}
