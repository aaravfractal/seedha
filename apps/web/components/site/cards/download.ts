"use client";

/** The file name from a Content-Disposition header, or null. */
function dispositionName(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}

/**
 * Fetch an owner file through the /api proxy and save it. Checks the type
 * first, so an API error never downloads as a broken file. Returns null when
 * saved, else a plain message.
 */
export async function downloadFile(
  href: string,
  fallbackName: string,
  expectType: string,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(href, { cache: "no-store" });
  } catch {
    return "No connection. Check the network and try again.";
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith(expectType)) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (response.status === 404 && !body?.error?.message)
      return "This download is not ready on the server yet.";
    return body?.error?.message ?? "The download did not work. Try again.";
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = dispositionName(response.headers.get("content-disposition")) ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return null;
}
