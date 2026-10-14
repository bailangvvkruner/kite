import type { ReactNode } from "react";

import { useI18n, type Key } from "@/i18n";
import { Label } from "@/components/ui/label";

/**
 * Group is a titled part of a settings form, a card on the sheet as the
 * deploy page's parts are. The card wraps the fieldset rather than being it,
 * since a bordered fieldset draws its legend over its own border.
 */
export function Group({
  id,
  title,
  note,
  children,
}: {
  id?: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-4 rounded-xl border bg-card p-5 sm:p-6">
      <fieldset className="grid gap-6">
        <legend className="mb-5 w-full">
          <span className="font-semibold">{title}</span>
          {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
        </legend>
        {children}
      </fieldset>
    </div>
  );
}

/**
 * Row is one labelled field, with a line of help under it when it needs one,
 * and a note after that about what else decides the setting.
 */
export function Row({
  id,
  label,
  help,
  note,
  children,
}: {
  id: string;
  label: Key;
  help?: Key;
  note?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t(label)}</Label>
      {children}
      {help && <p className="text-sm text-muted-foreground">{t(help)}</p>}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
