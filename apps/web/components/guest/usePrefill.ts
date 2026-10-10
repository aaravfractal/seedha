"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { localToday, readPrefill } from "@/lib/linkPrefill";
import type { Prefill } from "@/lib/linkPrefill";

/** Seedha Link prefill from ?room=&in=&nights=&code=, each value validated on its own. */
export function usePrefill(): Prefill {
  const params = useSearchParams();
  return useMemo(() => readPrefill(params, localToday()), [params]);
}
