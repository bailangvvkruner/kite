import { CaretDownIcon, FloppyDiskIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";

import { useI18n } from "@/i18n";
import { isMac } from "@/lib/tiptap-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";

/**
 * ShipButton publishes the item, saving it first. Saving alone waits under
 * its caret and on the save shortcut: whatever is saved goes out with the
 * next publish anyway.
 */
export function ShipButton({
  label,
  shipping,
  saving,
  canShip,
  canSave,
  upToDate,
  onShip,
  onSave,
}: {
  label: string;
  shipping: boolean;
  saving: boolean;
  canShip: boolean;
  canSave: boolean;
  /** upToDate says why there is nothing to publish. */
  upToDate: boolean;
  onShip: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex">
      <Button
        size="sm"
        className="rounded-e-none max-sm:px-2.5"
        disabled={!canShip}
        title={upToDate ? t("publish.upToDate") : undefined}
        onClick={onShip}
      >
        {shipping ? <Spinner /> : <PaperPlaneTiltIcon className="max-sm:hidden" />}
        {label}
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="rounded-s-none border-s border-s-primary-foreground/25 px-2"
            aria-label={t("editor.saveMenu")}
          >
            {saving ? <Spinner /> : <CaretDownIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem disabled={!canSave} onSelect={onSave} className="items-start">
            <FloppyDiskIcon className="mt-0.5" />
            <span className="grid gap-0.5">
              {t("editor.saveOnly")}
              <span className="text-xs text-muted-foreground">{t("editor.saveOnlyNote")}</span>
            </span>
            <DropdownMenuShortcut>{isMac() ? "⌘S" : "Ctrl+S"}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
