"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthFrame, BetaLogin, styles } from "../login/AuthFrame";

/** One-tap demo: opens the fictional sample hotel without a code. */
export default function DemoPage() {
  const [error, setError] = useState("");
  return (
    <AuthFrame
      title="Try the live demo"
      sub="Hotel Deodar View is a fictional sample hotel with six months of sample statements. Nothing you do here reaches a real guest."
    >
      <BetaLogin remember={false} onError={setError} />
      {error ? (
        <p id="demo-error" className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.foot}>
        Have your own hotel? <Link href="/signup">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
