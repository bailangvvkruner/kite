import { GlobeSimpleIcon } from "@phosphor-icons/react";

import type { Settings } from "@/api/client";
import { useI18n, type Key } from "@/i18n";
import { useWritable } from "@/hooks/useContents";
import { Input } from "@/components/ui/input";
import { InputGroup } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CodeField } from "@/components/CodeField";
import { KeywordsInput } from "@/components/KeywordsInput";
import { LanguageSelect } from "@/components/LanguageSelect";
import { TimezoneSelect } from "@/components/TimezoneSelect";
import { ContentSection } from "../components/content-section";
import { Group, Row, SwitchRow } from "../components/form-group";
import { FormProblem, LeaveGuard, SettingsActions, useSettingsForm } from "../use-settings-form";

/** paths maps a field of the form to the config path that holds it. */
const paths: Record<string, string> = {
  title: "site.title",
  description: "site.description",
  base_url: "site.baseURL",
  language: "site.language",
  timezone: "site.timezone",
  keywords: "site.keywords",
  noindex: "site.noindex",
  page_size: "build.pageSize",
  feed_limit: "build.feedLimit",
  default_category: "content.defaultCategory",
  head_html: "site.headHTML",
  footer_html: "site.footerHTML",
};

// A setting left empty is sent as null, which takes it out of kite.yaml
// rather than leaving a key that says nothing. The default category is the
// exception: empty says a new post starts in none.
const read = ({ site, build, content }: Settings) => ({
  title: site.title,
  description: site.description || null,
  base_url: site.base_url,
  language: site.language ?? "",
  timezone: site.timezone || null,
  keywords: site.keywords?.length ? site.keywords : null,
  noindex: site.noindex ?? false,
  page_size: build.page_size || null,
  feed_limit: build.feed_limit || null,
  default_category: content.default_category,
  head_html: site.head_html || null,
  footer_html: site.footer_html || null,
});

type Values = ReturnType<typeof read>;

/** groups names the keys of the form each group holds, to mark it on the route. */
const groups = {
  basics: ["title", "description", "base_url", "language", "timezone"],
  search: ["keywords", "noindex"],
  reading: ["page_size", "feed_limit"],
  writing: ["default_category"],
  code: ["head_html", "footer_html"],
};

export function SiteSettings() {
  const { t } = useI18n();
  const form = useSettingsForm(read, (key) => paths[key], (values) => check(values, t));
  const writable = useWritable();
  const values = form.values as Partial<Values>;
  const set = (key: keyof Values, value: unknown) => form.change({ ...values, [key]: value });
  const text = (key: keyof Values) => (value: string) => set(key, value === "" ? null : value);
  const count = (key: keyof Values) => (value: string) => set(key, value === "" ? null : Number(value));
  const marks = (keys: string[]) => ({ changed: form.touched(...keys), problem: form.troubled(...keys) });

  return (
    <ContentSection
      title={t("settings.site")}
      desc={t("settings.siteNote")}
      writes
      actions={writable && <SettingsActions form={form} />}
      end={{ title: t("settings.endConfig"), note: t("settings.endConfigNote") }}
    >
      <div>
        <FormProblem form={form} />
        {!form.loaded ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <fieldset disabled={!writable}>
            <Group
              id="site-basics"
              title={t("settings.groupBasics")}
              note={t("settings.groupBasicsNote")}
              {...marks(groups.basics)}
            >
              <Row id="title" label="settings.siteTitle" half>
                <Input id="title" value={values.title ?? ""} onChange={(event) => set("title", event.target.value)} />
              </Row>
              <Row
                id="base_url"
                label="settings.siteBaseURL"
                help="settings.siteBaseURLHelp"
                half
                problem={form.problems.base_url}
              >
                <InputGroup
                  id="base_url"
                  type="url"
                  spellCheck={false}
                  start={<GlobeSimpleIcon />}
                  aria-invalid={Boolean(form.problems.base_url) || undefined}
                  value={values.base_url ?? ""}
                  onChange={(event) => set("base_url", event.target.value)}
                />
              </Row>
              <Row id="description" label="settings.siteDescription" help="settings.siteDescriptionHelp" optional>
                <Textarea
                  id="description"
                  rows={3}
                  value={values.description ?? ""}
                  onChange={(event) => text("description")(event.target.value)}
                />
              </Row>
              <Row id="language" label="settings.siteLanguage" half>
                <LanguageSelect id="language" value={values.language ?? ""} onChange={(v) => set("language", v)} />
              </Row>
              <Row id="timezone" label="settings.siteTimezone" help="settings.siteTimezoneHelp" half optional>
                <TimezoneSelect id="timezone" value={values.timezone ?? null} onChange={(v) => set("timezone", v)} />
              </Row>
            </Group>

            <Group
              id="site-search"
              title={t("settings.groupSearch")}
              note={t("settings.groupSearchNote")}
              {...marks(groups.search)}
            >
              <Row id="keywords" label="settings.siteKeywords" help="settings.siteKeywordsHelp" optional>
                <KeywordsInput
                  id="keywords"
                  value={values.keywords ?? []}
                  placeholder={t("settings.siteKeywordsPlaceholder")}
                  onChange={(words) => set("keywords", words.length ? words : null)}
                />
              </Row>
              <SwitchRow
                id="indexed"
                label="settings.siteIndexed"
                help="settings.siteIndexedHelp"
                checked={!values.noindex}
                onCheckedChange={(indexed) => set("noindex", !indexed)}
              />
            </Group>

            <Group
              id="site-reading"
              title={t("settings.groupReading")}
              note={t("settings.groupReadingNote")}
              {...marks(groups.reading)}
            >
              <Row
                id="page_size"
                label="settings.pageSize"
                help="settings.pageSizeHelp"
                note={pagedOtherwise(form.settings?.build.pagination, t)}
                half
                problem={form.problems.page_size}
              >
                <InputGroup
                  id="page_size"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="10"
                  end={t("form.unitPosts")}
                  aria-invalid={Boolean(form.problems.page_size) || undefined}
                  value={values.page_size ?? ""}
                  onChange={(event) => count("page_size")(event.target.value)}
                />
              </Row>
              <Row
                id="feed_limit"
                label="settings.feedLimit"
                help="settings.feedLimitHelp"
                half
                problem={form.problems.feed_limit}
              >
                <InputGroup
                  id="feed_limit"
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="20"
                  end={t("form.unitPosts")}
                  aria-invalid={Boolean(form.problems.feed_limit) || undefined}
                  value={values.feed_limit ?? ""}
                  onChange={(event) => count("feed_limit")(event.target.value)}
                />
              </Row>
            </Group>

            <Group
              id="site-writing"
              title={t("settings.groupWriting")}
              note={t("settings.groupWritingNote")}
              {...marks(groups.writing)}
            >
              <Row
                id="default_category"
                label="settings.defaultCategory"
                help="settings.defaultCategoryHelp"
                half
                optional
              >
                <Input
                  id="default_category"
                  placeholder={t("settings.defaultCategoryNone")}
                  value={values.default_category ?? ""}
                  onChange={(event) => set("default_category", event.target.value)}
                />
              </Row>
            </Group>

            <Group
              id="site-code"
              title={t("settings.groupCode")}
              note={t("settings.groupCodeNote")}
              {...marks(groups.code)}
            >
              <Row id="head_html" label="settings.headHTML" help="settings.headHTMLHelp" optional>
                <CodeField
                  id="head_html"
                  language="html"
                  value={values.head_html ?? ""}
                  placeholder={'<script async src="https://analytics.example.com/script.js"></script>'}
                  onChange={(value) => text("head_html")(value)}
                />
              </Row>
              <Row id="footer_html" label="settings.footerHTML" help="settings.footerHTMLHelp" optional>
                <CodeField
                  id="footer_html"
                  language="html"
                  value={values.footer_html ?? ""}
                  onChange={(value) => text("footer_html")(value)}
                />
              </Row>
            </Group>
          </fieldset>
        )}
        <LeaveGuard form={form} />
      </div>
    </ContentSection>
  );
}

/**
 * check finds what the server would refuse, so the form says so beside the
 * field and holds the save back rather than reporting it after a round trip.
 */
function check(values: Record<string, unknown>, t: ReturnType<typeof useI18n>["t"]) {
  const between = (value: unknown, min: number, max: number) =>
    value === null || value === undefined
      ? null
      : Number(value) < min
        ? t("form.tooSmall", { min })
        : Number(value) > max
          ? t("form.tooLarge", { max })
          : null;
  return {
    base_url: siteURL(values.base_url) ? null : t("form.badSiteURL"),
    page_size: between(values.page_size, 1, 100),
    feed_limit: between(values.feed_limit, 1, 1000),
  };
}

function siteURL(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const listings = ["home", "list", "term"] as const;

/**
 * pagedOtherwise names the listings that do not page by the page size, as
 * the theme or build.pagination in kite.yaml has them, so the number is not
 * taken to rule them too. It is null when every listing pages by it.
 */
function pagedOtherwise(
  pagination: Record<string, number> | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string | null {
  const own = listings.filter((kind) => pagination?.[kind] !== undefined);
  if (!pagination || own.length === 0) return null;
  const items = own.map((kind) =>
    t("settings.pagedAs", {
      listing: t(`settings.paged.${kind}` as Key),
      size: pagination[kind] === 0 ? t("settings.pagedAll") : t("settings.pagedBy", { n: pagination[kind] }),
    }),
  );
  return t("settings.pagedOtherwise", { listings: items.join(t("settings.pagedSep")) });
}
