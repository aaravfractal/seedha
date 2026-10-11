"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@/components/owner/motion";
import o from "@/app/(owner)/(screens)/pro/pro.module.css";
import { PRO_VIEWS, type ProCardId } from "./registry";

/** The one app curve (docs/FRONTEND_MASTER.md motion). */
const CURVE = [0.22, 1, 0.36, 1] as const;

/**
 * A Pro card that expands in place into its live mini view (POLISH_BUILD C).
 * The whole summary is one disclosure button (aria-expanded, aria-controls).
 * Escape or the Close button collapse it and focus returns to the button.
 * The open card spans its grid row with a shared-layout animation; under
 * reduced motion everything is instant.
 */
export function ExpandCard({
  id,
  name,
  variant,
  open,
  onOpen,
  onClose,
  summary,
}: {
  id: ProCardId;
  name: string;
  variant: "big" | "small";
  open: boolean;
  onOpen: (id: ProCardId) => void;
  onClose: () => void;
  summary: ReactNode;
}) {
  const reduced = useReducedMotion();
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const regionId = `pro-${id}-view`;
  const View = PRO_VIEWS[id];

  const close = useCallback(() => {
    onClose();
    trigger.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close();
    }
    document.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() =>
      card.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }),
    );
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  }, [open, close, reduced]);

  const transition = reduced ? { duration: 0 } : { duration: 0.45, ease: CURVE };
  const cls = [o.card, variant === "big" ? o.big : o.smallCard, open ? o.open : ""].filter(Boolean).join(" ");

  return (
    <motion.article
      ref={card}
      layout={!reduced}
      transition={transition}
      className={cls}
      style={{ borderRadius: 22 }}
      data-testid={`pro-card-${id}`}
      data-open={open ? "true" : "false"}
    >
      <motion.div layout={reduced ? false : "position"} transition={transition} className={o.head}>
        <button
          ref={trigger}
          type="button"
          id={`pro-${id}-trigger`}
          className={o.trigger}
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => (open ? close() : onOpen(id))}
        >
          {summary}
          <span className={o.more}>
            {open ? "Hide view" : "Show view"}
            <svg className={o.chev} aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
              <path
                d="M3 5l4 4 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </button>
      </motion.div>
      {open ? (
        <motion.div
          id={regionId}
          role="region"
          aria-label={`${name}, view`}
          className={o.panel}
          data-testid={`pro-view-${id}`}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.35, ease: CURVE, delay: 0.1 }}
        >
          <View />
          <div className={o.panelFoot}>
            <button type="button" className={`btn small ghost ${o.close}`} onClick={close}>
              Close <span className="sr-only-text">{name}</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <div id={regionId} hidden />
      )}
    </motion.article>
  );
}
