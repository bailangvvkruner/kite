import { useMemo, useState } from "react";
import { CheckIcon, CaretUpDownIcon } from "@phosphor-icons/react";

import { useI18n } from "@/i18n";
import { fieldTrigger } from "@/lib/field";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  id?: string;
  /** value is an IANA zone, or null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
}

/** offset is a zone's distance from UTC now, such as "GMT+8". */
function offset(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts();
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * TimezoneSelect picks the IANA zone a site's dates are shown in. The zone
 * this browser is in comes first, since it is the likeliest answer.
 */
export function TimezoneSelect({ id, value, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const here = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    // A zone the project already names is always offered, so opening this
    // form can never be what changes it.
    const listed = value && !all.includes(value) ? [value, ...all] : all;
    return listed.map((zone) => ({ zone, offset: offset(zone) }));
  }, [value]);

  const label = value ? `${value} · ${offset(value)}` : t("settings.timezoneNone");
  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(fieldTrigger, "justify-between")}
        >
          <span className={cn("truncate", !value && "text-muted-foreground/70")}>{label}</span>
          <CaretUpDownIcon className="text-muted-foreground opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("settings.timezoneSearch")} />
          <CommandList>
            <CommandEmpty>{t("palette.empty")}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={`none ${t("settings.timezoneNone")}`} onSelect={() => pick(null)}>
                <CheckIcon className={cn(value ? "opacity-0" : "opacity-100")} />
                {t("settings.timezoneNone")}
              </CommandItem>
              {here && (
                <CommandItem value={`here ${here}`} onSelect={() => pick(here)}>
                  <CheckIcon className={cn(value === here ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{t("settings.timezoneHere", { zone: here })}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{offset(here)}</span>
                </CommandItem>
              )}
            </CommandGroup>
            <CommandGroup>
              {zones.map(({ zone, offset: gap }) => (
                <CommandItem key={zone} value={`${zone} ${gap}`} onSelect={() => pick(zone)}>
                  <CheckIcon className={cn(value === zone ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{zone}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{gap}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
