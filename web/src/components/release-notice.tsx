import { useEffect } from "react";
import { ArrowCircleUpIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useSite } from "@/hooks/useContents";

// The newest release this browser has been told of, so each is told once.
const SEEN = "kite:release-seen";

/**
 * ReleaseNotice tells, once per release and browser, that a Kite newer than
 * the server's is out, with the way to its notes. The deploy page's checklist
 * keeps saying so until the server runs it.
 */
export function ReleaseNotice() {
  const { t } = useI18n();
  const kite = useSite().data?.kite;
  const latest = kite?.latest;
  const url = kite?.latest_url;
  const running = kite?.running ?? "";

  useEffect(() => {
    if (!latest || !url) return;
    try {
      if (localStorage.getItem(SEEN) === latest) return;
      localStorage.setItem(SEEN, latest);
    } catch {
      // Without storage the notice would come back on every visit.
      return;
    }
    toast(t("release.out", { version: latest }), {
      description: t("release.running", { version: running }),
      icon: <ArrowCircleUpIcon weight="duotone" className="size-5 text-primary" />,
      duration: 15_000,
      action: { label: t("release.notes"), onClick: () => window.open(url, "_blank", "noopener") },
    });
  }, [latest, url, running, t]);

  return null;
}
