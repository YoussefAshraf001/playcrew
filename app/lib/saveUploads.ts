import { SaveUpload } from "../types/trackedGame";

const toDateValue = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const normalizeSaveUploads = (uploads?: SaveUpload[] | null): SaveUpload[] =>
  (uploads ?? [])
    .filter(Boolean)
    .map((upload) => ({
      id: String(upload.id ?? ""),
      fileName: upload.fileName ?? "save.zip",
      sizeBytes: typeof upload.sizeBytes === "number" ? upload.sizeBytes : 0,
      uploadedAt: upload.uploadedAt ?? new Date().toISOString(),
      storageKey: upload.storageKey ?? "",
      savePath: upload.savePath?.trim() || undefined,
    }))
    .sort((a, b) => toDateValue(b.uploadedAt) - toDateValue(a.uploadedAt));

export const formatSaveUploadSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export async function uploadSaveFileToBackblaze(params: {
  file: File;
  userId: string;
  gameId: string | number;
  gameName: string;
  savePath?: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("userId", String(params.userId));
  formData.append("gameId", String(params.gameId));
  formData.append("gameName", params.gameName);
  if (params.savePath?.trim()) {
    formData.append("savePath", params.savePath.trim());
  }

  const response = await fetch("/api/save-uploads", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Save upload failed.");
  }

  return payload.upload as SaveUpload;
}
