/** Sign out: clear the session cookie, then go to the sign-in page. */
export async function signOut(push: (href: string) => void): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE" });
  } finally {
    push("/login");
  }
}
