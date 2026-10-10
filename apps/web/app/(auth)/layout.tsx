import { Suspense } from "react";

/**
 * Sign in, sign up, code, onboarding and Direct beta login: a bare stage with
 * the back link, logo and card from AuthFrame, without the app header and
 * footer (design QA L2). The landmark stays outside Suspense (D-084).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} style={{ outline: "none" }}>
      <Suspense fallback={null}>{children}</Suspense>
    </main>
  );
}
