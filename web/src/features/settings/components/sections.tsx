import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { KiteRoute } from "@/components/kite-route";

/** What a section of a settings page tells the route beside it. */
interface Entry {
  id: string;
  title: string;
  changed?: boolean;
  problem?: boolean;
}

interface Registry {
  entries: Entry[];
  register: (entry: Entry) => () => void;
}

const Sections = createContext<Registry | null>(null);

/** SectionsProvider collects a page's sections, in the order the page draws them. */
export function SectionsProvider({ children }: { children: ReactNode }) {
  const [byId, setById] = useState<Record<string, Entry>>({});

  const register = useCallback((entry: Entry) => {
    setById((current) => (same(current[entry.id], entry) ? current : { ...current, [entry.id]: entry }));
    return () =>
      setById((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
  }, []);

  // Sections register from effects, after they are drawn, so the document
  // already holds them to order by.
  const entries = useMemo(() => Object.values(byId).sort(byDocumentOrder), [byId]);
  const value = useMemo(() => ({ entries, register }), [entries, register]);
  return <Sections.Provider value={value}>{children}</Sections.Provider>;
}

export function useSections(): Entry[] {
  return useContext(Sections)?.entries ?? [];
}

/**
 * useSection puts a section on the route and returns its number there, as
 * "01", or undefined outside a page that keeps a route.
 */
export function useSection(entry: Entry): string | undefined {
  const registry = useContext(Sections);
  const { id, title, changed, problem } = entry;
  const register = registry?.register;
  useLayoutEffect(() => register?.({ id, title, changed, problem }), [register, id, title, changed, problem]);
  const index = registry?.entries.findIndex((each) => each.id === id) ?? -1;
  return index < 0 ? undefined : String(index + 1).padStart(2, "0");
}

function same(a: Entry | undefined, b: Entry) {
  return a !== undefined && a.title === b.title && a.changed === b.changed && a.problem === b.problem;
}

function byDocumentOrder(a: Entry, b: Entry) {
  const first = document.getElementById(a.id);
  const second = document.getElementById(b.id);
  if (!first || !second) return 0;
  return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** Where a page's changes end up, written at the end of the route. */
export interface Destination {
  title: string;
  note?: string;
}

/**
 * SectionRoute is the page's sections on a kite string, following the scroll:
 * the section whose head has passed the top of the scroll area is the one in
 * view, and choosing a stop scrolls to its section.
 */
export function SectionRoute({
  scroller,
  end,
  className,
}: {
  scroller: RefObject<HTMLElement | null>;
  end?: Destination;
  className?: string;
}) {
  const { t } = useI18n();
  const entries = useSections();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const area = scroller.current;
    if (!area) return;
    const follow = () => {
      const top = area.getBoundingClientRect().top;
      let index = 0;
      entries.forEach((entry, i) => {
        const section = document.getElementById(entry.id);
        if (section && section.getBoundingClientRect().top - top < 120) index = i;
      });
      // At the foot of the page the last section is the one being read,
      // however short it is.
      if (area.scrollTop > 0 && area.scrollTop + area.clientHeight >= area.scrollHeight - 4) {
        index = entries.length - 1;
      }
      setCurrent(index);
    };
    follow();
    area.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      area.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [entries, scroller]);

  return (
    <KiteRoute
      label={t("settings.sections")}
      stops={entries.map((entry) => ({ ...entry, key: entry.id, href: `#${entry.id}` }))}
      current={current}
      onChoose={(i) => document.getElementById(entries[i].id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      end={
        end && (
          <>
            <p className="text-[13px] leading-7 font-semibold text-foreground/90">{end.title}</p>
            {end.note && <p className="text-xs leading-relaxed text-muted-foreground">{end.note}</p>}
          </>
        )
      }
      className={cn("sticky top-0 self-start", className)}
    />
  );
}
