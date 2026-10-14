import { Link } from "@tanstack/react-router";
import { PenLine } from "lucide-react";

import { useI18n, type Key } from "@/i18n";
import { useContentTypes, useSite, useWritable } from "@/hooks/useContents";
import { useKindLabel } from "@/hooks/useKindLabel";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { Main } from "@/components/layout/main";
import { ReadOnlyNote } from "@/components/read-only-note";
import { RefreshButton } from "@/components/refresh-button";
import { LatestPosts, Rhythm } from "./components/cards";
import { Journey } from "./components/journey";

export function Dashboard() {
  const { t, locale } = useI18n();
  const site = useSite();
  const writable = useWritable();
  const session = useSession();
  const types = useContentTypes();
  const kindLabel = useKindLabel();
  useDocumentTitle(t("nav.dashboard"));

  const kinds = types.data?.items.map((type) => type.kind) ?? ["post", "page"];
  const primary = kinds[0] ?? "post";
  const tagged = types.data?.items.find((type) => type.kind === primary)?.taxonomies ?? [];

  const now = new Date();
  const hour = now.getHours();
  const part = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greeting = t(`dashboard.${part}` as Key);
  const name = session.data?.required ? session.data.user : undefined;
  const today = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", weekday: "long" }).format(now);

  return (
    <>
      <AppHeader />

      <Main className="flex flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1.5 truncate text-sm text-muted-foreground">
              {[today, site.data?.title].filter(Boolean).join(" · ")}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[1.625rem]">
              {name ? t("dashboard.greeting", { greeting, name }) : greeting}
            </h2>
          </div>
          <div className="flex gap-2">
            <RefreshButton />
            {writable && (
              <Button asChild>
                <Link to="/content/$kind/$id" params={{ kind: primary, id: "new" }}>
                  <PenLine />
                  {t("dashboard.write", { kind: kindLabel.one(primary) })}
                </Link>
              </Button>
            )}
          </div>
        </div>
        <ReadOnlyNote />

        <Journey kind={primary} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <LatestPosts kind={primary} />
          <Rhythm kind={primary} taxonomy={tagged.includes("tags") ? "tags" : tagged[0]} />
        </div>
      </Main>
    </>
  );
}
