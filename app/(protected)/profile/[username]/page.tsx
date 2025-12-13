"use client";

import { useEffect, useState, ChangeEvent, useRef } from "react";
import AvatarEditor from "react-avatar-editor";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useUser } from "../../../context/UserContext";
import { db } from "@/app/lib/firebase";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { Helmet } from "react-helmet-async";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, profile, setProfile, loading } = useUser();

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef<AvatarEditor>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !profile)
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner />
      </div>
    );

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

  return (
    <>
      <Helmet>
        <title>PlayCrew</title>
      </Helmet>

      <motion.main
        className="min-h-screen bg-black flex justify-center items-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="w-full max-w-4xl bg-gray-900 rounded-3xl p-10 shadow-2xl flex flex-col gap-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-5 py-2 rounded-full font-semibold bg-linear-to-r from-cyan-500 to-blue-500 text-black hover:from-cyan-400 hover:to-blue-400 transition"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-10 items-center">
            {/* Avatar */}
            <div className="relative">
              {profile.avatarBase64 || profile.avatarUrl ? (
                <img
                  src={profile.avatarBase64 || profile.avatarUrl!}
                  alt="Avatar"
                  className="w-40 h-40 rounded-full border-4 border-cyan-500 shadow-lg object-cover"
                />
              ) : (
                <div className="w-40 h-40 rounded-full bg-cyan-500 flex items-center justify-center text-5xl font-bold text-black border-4 border-cyan-400 shadow-lg">
                  {getInitials(profile.displayName || profile.username)}
                </div>
              )}

              {isEditing && (
                <div className="absolute inset-0 flex flex-col justify-center items-center gap-2 rounded-full bg-black/50">
                  <label className="cursor-pointer w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center hover:bg-cyan-400 transition">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <svg
                      className="w-5 h-5 text-black"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M4 5a2 2 0 012-2h2a2 2 0 012 2h4a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                    </svg>
                  </label>
                  {profile.avatarBase64 && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition"
                    >
                      <svg
                        className="w-5 h-5 text-black"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 6a1 1 0 011-1h6a1 1 0 011 1v10a1 1 0 01-1 1H7a1 1 0 01-1-1V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Profile Fields */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Username", name: "username", type: "text" },
                { label: "Display Name", name: "displayName", type: "text" },
                { label: "Email", name: "email", type: "email" },
              ].map((field) => (
                <div key={field.name} className="relative">
                  <input
                    type={field.type}
                    name={field.name}
                    value={profile[field.name] || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-4 pt-5 pb-2 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition peer ${
                      !isEditing ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    placeholder=" "
                  />
                  <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-500 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-sm peer-focus:text-cyan-400">
                    {field.label}
                  </label>
                </div>
              ))}

              {/* Bio */}
              <div className="relative md:col-span-2">
                <textarea
                  name="bio"
                  value={profile.bio || ""}
                  onChange={handleChange}
                  disabled={!isEditing}
                  rows={3}
                  className={`w-full px-4 pt-5 pb-2 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none transition peer ${
                    !isEditing ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  placeholder=" "
                />
                <label className="absolute left-4 top-2 text-gray-400 text-sm transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-500 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-sm peer-focus:text-cyan-400">
                  Bio
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          {isEditing && (
            <div className="flex justify-end mt-6">
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-full bg-linear-to-r from-cyan-500 to-blue-500 text-black font-semibold hover:from-cyan-400 hover:to-blue-400 transition"
              >
                Save
              </button>
            </div>
          )}
        </div>

        {/* Avatar Modal */}
        <AnimatePresence>
          {showModal && selectedFile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-gray-800 p-6 md:p-10 rounded-2xl flex flex-col items-center gap-4"
              >
                <AvatarEditor
                  ref={editorRef}
                  image={selectedFile}
                  width={250}
                  height={250}
                  border={60}
                  borderRadius={125}
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
                    className="px-5 py-2 rounded-full bg-linear-to-r from-cyan-500 to-blue-500 text-black font-semibold hover:from-cyan-400 hover:to-blue-400 transition"
                  >
                    {uploading ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedFile(null);
                    }}
                    className="px-5 py-2 rounded-full bg-red-500 hover:bg-red-400 text-black font-semibold transition"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </>
  );
}
