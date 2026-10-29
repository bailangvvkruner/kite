import { useMemo } from "react";

import { useI18n } from "@/i18n";

/**
 * useDates writes instants the one way the studio does: a day of this year
 * without its year, an older one with it, and in full, to the minute, for a
 * hint over either.
 */
export function useDates() {
  const { locale } = useI18n();
  return useMemo(() => {
    const thisYear = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    const anyYear = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" });
    const minute = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parse = (value: string | Date | undefined) => {
      if (!value) return null;
      const at = value instanceof Date ? value : new Date(value);
      return Number.isNaN(at.getTime()) ? null : at;
    };
    return {
      day: (value: string | Date | undefined) => {
        const at = parse(value);
        if (!at) return "—";
        return (at.getFullYear() === new Date().getFullYear() ? thisYear : anyYear).format(at);
      },
      full: (value: string | Date | undefined) => {
        const at = parse(value);
        return at ? minute.format(at) : "";
      },
    };
  }, [locale]);
}
