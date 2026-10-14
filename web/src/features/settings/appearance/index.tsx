import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { locales, useI18n, type Locale } from "@/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentSection } from "../components/content-section";
import { Group } from "../components/form-group";

/**
 * Preview draws the studio in small: the rail's canvas, a sheet on it and a
 * few rows, in one scheme's colors.
 */
function Preview({ canvas, sheet, line, ink }: { canvas: string; sheet: string; line: string; ink: string }) {
  return (
    <div className="flex h-24 gap-1.5 rounded-sm p-1.5" style={{ background: canvas }}>
      <div className="flex w-1/4 flex-col gap-1.5 pt-1">
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: ink }} />
        <div className="h-3 rounded-[3px]" style={{ background: sheet }} />
        <div className="h-1.5 w-2/3 rounded-full" style={{ background: line }} />
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: line }} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 rounded-[5px] p-2" style={{ background: sheet }}>
        <div className="h-2 w-1/3 rounded-full" style={{ background: ink }} />
        <div className="h-6 rounded-[3px] border" style={{ borderColor: line }} />
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: line }} />
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: line }} />
      </div>
    </div>
  );
}

const lightPreview = <Preview canvas="#edf2f9" sheet="#ffffff" line="#dfe5ee" ink="#172036" />;
const darkPreview = <Preview canvas="#0c0f15" sheet="#141821" line="#2a303c" ink="#c3cad8" />;

const themes = [
  { value: "light", label: "settings.light", preview: lightPreview },
  { value: "dark", label: "settings.dark", preview: darkPreview },
  {
    value: "system",
    label: "settings.system",
    preview: (
      <div className="grid grid-cols-2 overflow-hidden rounded-sm">
        <div className="overflow-hidden">{lightPreview}</div>
        <div className="overflow-hidden">{darkPreview}</div>
      </div>
    ),
  },
] as const;

/**
 * Appearance is the operator's, not the site's: the studio's language and
 * colors, kept in this browser. The form is shadcn-admin's, with a language
 * where it has a font, and the automatic theme explore adds.
 */
export function AppearanceSettings() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [chosenLocale, setChosenLocale] = useState<Locale>(locale);
  const [chosenTheme, setChosenTheme] = useState<Theme>(theme);
  // The header's toggle can change the theme under an open form.
  useEffect(() => setChosenTheme(theme), [theme]);
  useEffect(() => setChosenLocale(locale), [locale]);
  const dirty = chosenLocale !== locale || chosenTheme !== theme;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (chosenTheme !== theme) setTheme(chosenTheme);
    if (chosenLocale !== locale) setLocale(chosenLocale);
    toast.success(t("settings.appearanceSaved"));
  };

  return (
    <ContentSection title={t("settings.interface")} desc={t("settings.interfaceNote")}>
      <form onSubmit={submit} className="grid gap-5">
        <Group title={t("nav.language")} note={t("settings.languageNote")}>
          <Select value={chosenLocale} onValueChange={(value) => setChosenLocale(value as Locale)}>
            <SelectTrigger id="locale" aria-label={t("nav.language")} className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(locales) as Locale[]).map((code) => (
                <SelectItem key={code} value={code}>
                  {locales[code].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Group>

        <Group title={t("settings.appearance")} note={t("settings.appearanceNote")}>
          <RadioGroup
            value={chosenTheme}
            onValueChange={(value) => setChosenTheme(value as Theme)}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {themes.map((option) => (
              <Label
                key={option.value}
                className="flex-col items-stretch gap-0 [&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>span]:font-medium"
              >
                <RadioGroupItem value={option.value} className="sr-only" />
                <div className="rounded-lg border-2 border-transparent p-0.5 ring-1 ring-border hover:ring-foreground/20">
                  {option.preview}
                </div>
                <span className="block w-full p-2 text-center font-normal">{t(option.label)}</span>
              </Label>
            ))}
          </RadioGroup>
        </Group>

        <div>
          <Button type="submit" disabled={!dirty}>
            {t("settings.saveAppearance")}
          </Button>
        </div>
      </form>
    </ContentSection>
  );
}
