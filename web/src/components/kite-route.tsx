import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { KiteMark } from "@/components/KiteMark";

/** A stop on the route: one part of a form. */
export interface Stop {
  key: string;
  title: string;
  /** href makes the stop a link to the part, on a page that shows them all. */
  href?: string;
  changed?: boolean;
  problem?: boolean;
}

/**
 * KiteRoute strings the parts of a form on a kite string, as the dashboard
 * strings the stages of a post: a numbered stop for each, lit for the one in
 * view and drawn solid up to it, marked where something changed or needs
 * fixing, and ending at the kite, with where the changes go beside it.
 */
export function KiteRoute({
  label,
  stops,
  current,
  onChoose,
  end,
  className,
}: {
  label: string;
  stops: Stop[];
  current: number;
  onChoose: (index: number) => void;
  end?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const list = useRef<HTMLOListElement>(null);
  const [line, setLine] = useState({ top: 0, length: 0, reach: 0 });

  // The string runs from the first stop's middle to the kite's, solid as far
  // as the stop in view.
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-stop]");
    if (nodes.length < 2) return;
    const base = root.getBoundingClientRect().top;
    const middle = (node: HTMLElement) => {
      const box = node.getBoundingClientRect();
      return box.top + box.height / 2 - base;
    };
    const top = middle(nodes[0]);
    setLine({
      top,
      length: middle(nodes[nodes.length - 1]) - top,
      reach: middle(nodes[Math.max(0, Math.min(current, nodes.length - 2))]) - top,
    });
  }, [current, stops, end]);

  return (
    <nav aria-label={label} className={className}>
      <ol ref={list} className="relative grid gap-1">
        <span
          aria-hidden
          className="absolute start-[13px] border-s-[1.5px] border-dashed border-string/60"
          style={{ top: line.top, height: line.length }}
        />
        <span
          aria-hidden
          className="absolute start-[13px] border-s-[1.5px] border-string transition-[height] duration-300"
          style={{ top: line.top, height: line.reach }}
        />
        {stops.map((stop, i) => {
          const on = i === current;
          const inner = (
            <>
              <span
                data-stop
                className={cn(
                  "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] bg-background text-[11.5px] font-semibold tabular-nums transition",
                  on
                    ? "border-string bg-string text-white shadow-[0_0_0_4px_color-mix(in_oklab,var(--string)_22%,transparent)]"
                    : i < current
                      ? "border-string text-string"
                      : "border-string/70 text-string/85 group-hover:border-string",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 truncate">{stop.title}</span>
              {stop.problem ? (
                <Mark className="bg-destructive ring-[3px] ring-destructive/15" label={t("settings.problemHere")} />
              ) : stop.changed ? (
                <Mark className="bg-warning" label={t("settings.changedHere")} />
              ) : null}
            </>
          );
          const look = cn(
            "group flex h-[38px] w-full items-center gap-3 rounded-lg pe-2 text-start text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-field-ring",
            on && "font-semibold text-foreground",
          );
          return (
            <li key={stop.key}>
              {stop.href ? (
                <a
                  href={stop.href}
                  aria-current={on ? "location" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    onChoose(i);
                  }}
                  className={look}
                >
                  {inner}
                </a>
              ) : (
                <button type="button" aria-current={on ? "page" : undefined} onClick={() => onChoose(i)} className={look}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
        <li className="mt-2 flex items-start gap-3">
          <span
            data-stop
            className="relative z-10 grid size-7 shrink-0 place-items-center rounded-[9px] bg-primary shadow-[0_4px_10px_rgb(74_119_214/0.32)]"
          >
            <KiteMark tight className="h-[15px] w-auto text-white! dark:text-white!" />
          </span>
          {end && <div className="min-w-0">{end}</div>}
        </li>
      </ol>
    </nav>
  );
}

function Mark({ className, label }: { className: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("ms-auto size-[7px] shrink-0 rounded-full", className)}
    />
  );
}
