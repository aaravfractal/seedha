"use client";

import { ApiError, api, postJson } from "@/lib/api";
import type { BuildPatch, BuildState, GenerateResult, SitePhoto, SitePhotos } from "@/lib/types-site-build";

/** Owner routes for Seedha Site real mode (apps/api/app/routers/site_build.py). */

function sendJson<T>(method: "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  return api<T>(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function patchBuild(body: BuildPatch): Promise<BuildState> {
  return sendJson<BuildState>("PATCH", "site/build", body);
}

export function generateSite(): Promise<GenerateResult> {
  return postJson<GenerateResult>("site/build/generate");
}

export function deletePhoto(id: number): Promise<SitePhotos> {
  return sendJson<SitePhotos>("DELETE", `site/photos/${id}`);
}

export function orderPhotos(ids: number[]): Promise<SitePhotos> {
  return sendJson<SitePhotos>("PATCH", "site/photos/order", { ids });
}

/**
 * Upload one photo (one per request: the proxy caps a body at 11 MB). XHR,
 * not fetch, so the owner sees real upload progress. Errors carry the API's
 * own message ("That photo is larger than 10 MB", ...).
 */
export function uploadPhoto(file: File, onProgress: (percent: number) => void): Promise<SitePhoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/site/photos");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const body = xhr.response as { error?: { code?: string; message?: string } } | SitePhoto | null;
      if (xhr.status >= 200 && xhr.status < 300 && body && "id" in body) {
        onProgress(100);
        resolve(body);
        return;
      }
      const err = body && "error" in body ? body.error : undefined;
      reject(
        new ApiError(
          xhr.status,
          err?.code ?? "error",
          err?.message ??
            (xhr.status === 413 ? "That photo is larger than 10 MB." : "The upload did not work."),
        ),
      );
    };
    xhr.onerror = () => reject(new ApiError(0, "offline", "No connection. Check the network and try again."));
    const form = new FormData();
    form.append("photo", file);
    xhr.send(form);
  });
}

/** A readable message for any thrown value. */
export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "That did not work. Try again.";
}
