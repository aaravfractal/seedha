"use client";

import { useMemo } from "react";
import { useApi } from "@/lib/api";
import type { PipelineStatus, PropertyInfo } from "@/lib/types";
import { StepTracker } from "@/components/StepTracker";
import { ErrorState, Loading } from "@/components/States";

export default function PipelineHome() {
  const property = useApi<PropertyInfo>("property");
  const pipeline = useApi<PipelineStatus>("pipeline");
  const done = useMemo(
    () => new Set((pipeline.data?.steps ?? []).filter((s) => s.done).map((s) => s.key)),
    [pipeline.data],
  );
  const p = property.data;

  return (
    <section className="view">
      <p className="tag">
        {p ? `${p.name} · ${p.city} · ${p.rooms_count} rooms${p.is_sample ? " · sample data" : ""}` : " "}
      </p>
      <h1 className="display">Know what you really keep.</h1>
      <p className="lede">
        Seedha reads your OTA statements, shows what each channel actually leaves you, and stops you paying
        commission twice for guests you already won.
      </p>
      {pipeline.error ? (
        <ErrorState message={pipeline.error.message} code={pipeline.error.code} onRetry={pipeline.reload} />
      ) : pipeline.loading && !pipeline.data ? (
        <Loading rows={2} label="Loading the 8 steps" />
      ) : (
        <StepTracker done={done} />
      )}
    </section>
  );
}
