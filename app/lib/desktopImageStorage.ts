export type DesktopImageCategory =
  | "profileImage"
  | "wallpaper"
  | "customGameCovers"
  | "screenshots";

export type DesktopImageStorageSettings = Record<DesktopImageCategory, boolean>;

export const DEFAULT_DESKTOP_IMAGE_STORAGE: DesktopImageStorageSettings = {
  profileImage: false,
  wallpaper: false,
  customGameCovers: false,
  screenshots: false,
};

export const DEFAULT_DESKTOP_CLOUD_COPIES: DesktopImageStorageSettings = {
  profileImage: true,
  wallpaper: true,
  customGameCovers: true,
  screenshots: true,
};

declare global {
  interface Window {
    playcrewDesktop?: {
      getCloseBehavior: () => Promise<"tray" | "quit">;
      setCloseBehavior: (value: "tray" | "quit") => Promise<"tray" | "quit">;
      getImageStorageSettings: () => Promise<DesktopImageStorageSettings>;
      setImageStorageSettings: (value: DesktopImageStorageSettings) => Promise<DesktopImageStorageSettings>;
      getCloudCopySettings: () => Promise<DesktopImageStorageSettings>;
      setCloudCopySettings: (value: DesktopImageStorageSettings) => Promise<DesktopImageStorageSettings>;
      checkForUpdate: () => Promise<{
        currentVersion: string;
        latestVersion: string;
        updateAvailable: boolean;
        downloadUrl: string;
      }>;
      openUpdateDownload: (url: string) => Promise<boolean>;
      openLocalImagesFolder: () => Promise<void>;
      saveLocalImage: (category: DesktopImageCategory, key: string, dataUrl: string) => Promise<string>;
      saveLocalImageToPath?: (category: DesktopImageCategory, pathSegments: string[], dataUrl: string) => Promise<string>;
      deleteLocalImage: (url: string) => Promise<boolean>;
    };
  }
}

export const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

export async function shouldSaveImageLocally(category: DesktopImageCategory) {
  const desktop = window.playcrewDesktop;
  if (!desktop) return false;
  const settings = await desktop.getImageStorageSettings();
  return settings[category] === true;
}

export async function shouldUploadCloudCopy(category: DesktopImageCategory) {
  const desktop = window.playcrewDesktop;
  if (!desktop) return true;
  const settings = await desktop.getCloudCopySettings();
  return settings[category] !== false;
}

export const toLocalPathSegment = (value: string | number, fallback: string) => {
  const sanitized = String(value)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return sanitized || fallback;
};

export async function saveImageLocally(category: DesktopImageCategory, pathSegments: string[], source: Blob | string) {
  const desktop = window.playcrewDesktop;
  if (!desktop) throw new Error("Local image storage is available only in the desktop app");
  const dataUrl = typeof source === "string" ? source : await fileToDataUrl(source);
  if (desktop.saveLocalImageToPath) {
    return desktop.saveLocalImageToPath(category, pathSegments, dataUrl);
  }

  // Compatibility with desktop builds released before structured image paths.
  const legacyKey = pathSegments
    .join("-")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(0, 180);
  return desktop.saveLocalImage(category, legacyKey || "image", dataUrl);
}
