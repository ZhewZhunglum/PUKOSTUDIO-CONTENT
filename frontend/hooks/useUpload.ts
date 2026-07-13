import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { initUpload, uploadToStorage, completeUpload } from "../lib/api/assets";
import { guessAssetType } from "../lib/types/asset";

export type UploadStatus = "idle" | "uploading" | "done" | "error" | "duplicate";
export type UploadPhase = "init" | "uploading" | "completing" | "done" | "";

export interface UploadFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  phase: UploadPhase;
  error?: string;
  assetId?: number;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError!: Error;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  throw lastError;
}

export function useUpload() {
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const queryClient = useQueryClient();

  const updateFile = useCallback((id: string, patch: Partial<UploadFile>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const uploadFile = useCallback(
    async (file: File, tags: string[] = []) => {
      const id = crypto.randomUUID();
      const entry: UploadFile = { id, file, status: "idle", progress: 0, phase: "" };
      setUploads((prev) => [...prev, entry]);

      try {
        const mimeType = file.type || "application/octet-stream";
        const assetType = guessAssetType(mimeType);
        updateFile(id, { status: "uploading", progress: 5, phase: "init" });

        const init = await withRetry(() =>
          initUpload({
            filename: file.name,
            file_size: file.size,
            mime_type: mimeType,
            asset_type: assetType,
          })
        );

        if (init.is_duplicate && init.asset_id) {
          if (tags.length > 0) {
            // Dedup hit skips upload/complete — attach the chosen tags to the
            // existing asset. A tag failure shouldn't fail the whole item:
            // the asset is already in the library.
            try {
              await api.patch(`/api/assets/${init.asset_id}`, { user_tags_add: tags });
            } catch (err) {
              console.warn("attaching tags to duplicate asset failed", err);
            }
          }
          updateFile(id, { status: "duplicate", progress: 100, phase: "done", assetId: init.asset_id });
          queryClient.invalidateQueries({ queryKey: ["assets"] });
          return;
        }

        updateFile(id, { progress: 20, phase: "uploading" });

        // S3 upload — retry by re-initializing if 403 (expired presigned URL)
        let uploadUrl = init.upload_url!;
        let storageKey = init.storage_key;
        let attempt = 0;
        while (true) {
          try {
            await uploadToStorage(uploadUrl, file, mimeType, (storageProgress) => {
              updateFile(id, { progress: 20 + Math.round(storageProgress * 0.6) });
            });
            break;
          } catch (err) {
            const msg = (err as Error).message ?? "";
            // Refresh presigned URL on 403 and retry once
            if (attempt === 0 && msg.includes("403")) {
              attempt++;
              const reinit = await initUpload({
                filename: file.name,
                file_size: file.size,
                mime_type: mimeType,
                asset_type: assetType,
              });
              uploadUrl = reinit.upload_url!;
              storageKey = reinit.storage_key;
              continue;
            }
            if (attempt < 2) {
              attempt++;
              await sleep(Math.pow(2, attempt - 1) * 1000);
              continue;
            }
            throw err;
          }
        }

        updateFile(id, { progress: 85, phase: "completing" });

        const asset = await withRetry(() =>
          completeUpload({
            storage_key: storageKey,
            filename: file.name,
            mime_type: mimeType,
            file_size: file.size,
            asset_type: assetType,
            name: file.name.replace(/\.[^.]+$/, ""),
            tags,
          })
        );

        updateFile(id, { status: "done", progress: 100, phase: "done", assetId: asset.id });
        queryClient.invalidateQueries({ queryKey: ["assets"] });
      } catch (err) {
        const msg = (err as Error).message ?? "上传失败";
        updateFile(id, { status: "error", phase: "", error: msg });
      }
    },
    [updateFile, queryClient]
  );

  const enqueueFiles = useCallback(
    (files: FileList | File[], tags: string[] = []) => {
      Array.from(files).forEach((file) => uploadFile(file, tags));
    },
    [uploadFile]
  );

  const removeUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const clearDone = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== "done" && u.status !== "duplicate"));
  }, []);

  return { uploads, enqueueFiles, removeUpload, clearDone };
}
