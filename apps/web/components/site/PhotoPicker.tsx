"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { MAX_PHOTOS, MIN_PHOTOS, PHOTO_ACCEPT, moveItem, photoFileError } from "@/lib/siteBuild";
import type { SitePhoto } from "@/lib/types-site-build";
import { deletePhoto, errorText, orderPhotos, uploadPhoto } from "./buildApi";
import b from "./build.module.css";

type Upload = {
  key: number;
  name: string;
  state: "waiting" | "uploading" | "done" | "error";
  percent: number;
  error: string;
};

/**
 * The owner's photos in order: move earlier or later with buttons (keyboard
 * and screen readers), remove, and an optional slot under each photo (Review
 * puts the captions there). Order changes are saved at once.
 */
export function PhotoGrid({
  photos,
  onPhotos,
  onError,
  allowRemove = true,
  wide = false,
  extra,
}: {
  photos: SitePhoto[];
  onPhotos: (photos: SitePhoto[]) => void;
  onError: (message: string) => void;
  allowRemove?: boolean;
  wide?: boolean;
  extra?: (photo: SitePhoto, index: number) => ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const refocus = useRef<{ id: number; dir: "up" | "down" } | null>(null);

  useEffect(() => {
    // Moving a photo moves its DOM node, which drops focus: put it back on the same button.
    const want = refocus.current;
    if (!want || !list.current) return;
    refocus.current = null;
    const item = list.current.querySelector<HTMLElement>(`[data-photo="${want.id}"]`);
    const same = item?.querySelector<HTMLButtonElement>(`button[data-dir="${want.dir}"]:not(:disabled)`);
    const other = item?.querySelector<HTMLButtonElement>("button[data-dir]:not(:disabled)");
    (same ?? other)?.focus();
  }, [photos]);

  async function move(from: number, to: number) {
    const before = photos;
    const moved = before[from];
    if (!moved || to < 0 || to >= before.length) return;
    const next = moveItem(before, from, to);
    refocus.current = { id: moved.id, dir: to < from ? "up" : "down" };
    onPhotos(next);
    setSaid(`Photo moved to place ${to + 1} of ${next.length}.`);
    setBusy(true);
    try {
      onPhotos((await orderPhotos(next.map((p) => p.id))).photos);
    } catch (err) {
      onPhotos(before);
      setSaid("The new order was not saved.");
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: SitePhoto, index: number) {
    setBusy(true);
    try {
      const left = (await deletePhoto(photo.id)).photos;
      onPhotos(left);
      setSaid(`Photo ${index + 1} removed. ${left.length} left.`);
      // Focus would fall to the page: move it to the next photo, or the list.
      const next = left[Math.min(index, left.length - 1)];
      if (next) refocus.current = { id: next.id, dir: "down" };
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (photos.length === 0) return null;
  return (
    <>
      <ol ref={list} className={`${b.photos} ${wide ? b.photosWide : ""}`} aria-label="Your photos, in order">
        {photos.map((photo, i) => (
          <li key={photo.id} className={b.photo} data-photo={photo.id}>
            <div className={b.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo through the /api proxy (ETag cached); next/image would re-encode it on a public route */}
              <img
                src={photo.url}
                alt={photo.caption_en ? `Photo ${i + 1}: ${photo.caption_en}` : `Photo ${i + 1}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
              />
              <span className={b.pos} aria-hidden="true">
                {i + 1}
              </span>
            </div>
            <div className={b.tools}>
              <button
                type="button"
                className={b.tool}
                data-dir="up"
                disabled={busy || i === 0}
                aria-label={`Move photo ${i + 1} earlier`}
                onClick={() => void move(i, i - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={b.tool}
                data-dir="down"
                disabled={busy || i === photos.length - 1}
                aria-label={`Move photo ${i + 1} later`}
                onClick={() => void move(i, i + 1)}
              >
                ↓
              </button>
              {allowRemove ? (
                <button
                  type="button"
                  className={`${b.tool} ${b.toolEnd}`}
                  disabled={busy}
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => void remove(photo, i)}
                >
                  Remove
                </button>
              ) : null}
            </div>
            {extra ? extra(photo, i) : null}
          </li>
        ))}
      </ol>
      <p className="sr-only-text" aria-live="polite">
        {said}
      </p>
    </>
  );
}

/**
 * Step 1: pick 4 to 8 photos. Each file goes up on its own request with its
 * own progress and the API's own error message. The API checks the real
 * format, resizes and strips every EXIF field including location.
 */
export function PhotoPicker({
  photos,
  onPhotos,
  onError,
}: {
  photos: SitePhoto[];
  onPhotos: (update: (photos: SitePhoto[]) => SitePhoto[]) => void;
  onError: (message: string) => void;
}) {
  const inputId = useId();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const nextKey = useRef(0);
  const running = useRef(false);
  const queue = useRef<{ key: number; file: File }[]>([]);
  const active = uploads.filter((u) => u.state === "waiting" || u.state === "uploading").length;
  const room = MAX_PHOTOS - photos.length - active;

  function patchUpload(key: number, change: Partial<Upload>) {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...change } : u)));
  }

  async function drain() {
    if (running.current) return;
    running.current = true;
    for (let job = queue.current.shift(); job; job = queue.current.shift()) {
      const { key, file } = job;
      patchUpload(key, { state: "uploading" });
      try {
        const photo = await uploadPhoto(file, (percent) => patchUpload(key, { percent }));
        onPhotos((list) => [...list, photo]);
        patchUpload(key, { state: "done", percent: 100 });
      } catch (err) {
        patchUpload(key, { state: "error", error: errorText(err) });
      }
    }
    running.current = false;
    // Clear finished rows; keep errors so the owner can read them.
    setUploads((list) => list.filter((u) => u.state === "error"));
  }

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    let free = room;
    const added: Upload[] = [];
    for (const file of Array.from(files)) {
      const key = nextKey.current++;
      const local = photoFileError(file);
      if (local) {
        added.push({ key, name: file.name, state: "error", percent: 0, error: local });
      } else if (free <= 0) {
        added.push({
          key,
          name: file.name,
          state: "error",
          percent: 0,
          error: `${file.name}: only 8 photos fit. Remove one to add this.`,
        });
      } else {
        free -= 1;
        added.push({ key, name: file.name, state: "waiting", percent: 0, error: "" });
        queue.current.push({ key, file });
      }
    }
    setUploads((list) => [...list.filter((u) => u.state !== "error"), ...added]);
    void drain();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  }

  const need = Math.max(0, MIN_PHOTOS - photos.length);
  return (
    <div className={b.flow}>
      <div
        className={b.drop}
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          id={inputId}
          className={b.fileInput}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          disabled={room <= 0}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <label htmlFor={inputId} className="btn" aria-disabled={room <= 0}>
          {photos.length ? "Add more photos" : "Choose photos"}
        </label>
        <p className={b.hint}>
          JPEG, PNG, WebP or iPhone HEIC, up to 10 MB each. Or drop them here. We shrink each photo and remove
          its hidden details, including location.
        </p>
      </div>

      <p className={b.label} aria-live="polite">
        {photos.length} of {MAX_PHOTOS} photos
        {need > 0 ? ` · add ${need} more to continue` : ""}
      </p>

      {uploads.length > 0 ? (
        <ul className={b.queue} aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.key}>
              <span className={b.queueName}>{u.name}</span>
              <span
                className={u.state === "error" ? b.error : b.hint}
                role={u.state === "error" ? "alert" : undefined}
              >
                {u.state === "waiting"
                  ? "Waiting"
                  : u.state === "uploading"
                    ? `Uploading ${u.percent}%`
                    : u.state === "done"
                      ? "Added"
                      : u.error}
              </span>
              {u.state === "uploading" || u.state === "waiting" ? (
                <span
                  className={b.bar}
                  role="progressbar"
                  aria-label={`Uploading ${u.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={u.percent}
                >
                  <i style={{ width: `${u.percent}%` }} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <PhotoGrid photos={photos} onPhotos={(list) => onPhotos(() => list)} onError={onError} />
    </div>
  );
}
