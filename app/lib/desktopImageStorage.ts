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

declare global {
  interface Window {
    playcrewDesktop?: {
      getCloseBehavior: () => Promise<"tray" | "quit">;
      setCloseBehavior: (value: "tray" | "quit") => Promise<"tray" | "quit">;
      getImageStorageSettings: () => Promise<DesktopImageStorageSettings>;
      setImageStorageSettings: (value: DesktopImageStorageSettings) => Promise<DesktopImageStorageSettings>;
      saveLocalImage: (category: DesktopImageCategory, key: string, dataUrl: string) => Promise<string>;
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

export async function saveImageLocally(category: DesktopImageCategory, key: string, source: Blob | string) {
  const desktop = window.playcrewDesktop;
  if (!desktop) throw new Error("Local image storage is available only in the desktop app");
  const dataUrl = typeof source === "string" ? source : await fileToDataUrl(source);
  return desktop.saveLocalImage(category, key.replace(/[^A-Za-z0-9_-]/g, "-"), dataUrl);
}
