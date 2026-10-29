import { useEffect, useRef } from "react";
import { XCircleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ApiError, type Settings } from "@/api/client";
import { useI18n, useProblem } from "@/i18n";
import { useSaveSettings, useSettings } from "@/hooks/useSettings";
import { useSettingsDraft } from "@/hooks/useSettingsDraft";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormActions } from "@/components/form-actions";

/**
 * useSettingsForm is one settings form: a draft of what is stored, saved as
 * only what changed, against the revision of kite.yaml it was loaded at. A
 * file edited meanwhile is a conflict to reload, not something to overwrite.
 */
export function useSettingsForm(
  read: (settings: Settings) => Record<string, unknown> | undefined,
  /** path is the dotted configuration path a value of the form is saved to. */
  path: (key: string) => string,
  /** check names what is wrong with a value, by its key, before it is sent. */
  check?: (values: Record<string, unknown>) => Record<string, string | null>,
) {
  const { t } = useI18n();
  const problem = useProblem();
  const settings = useSettings();
  const save = useSaveSettings();

  const incoming = settings.data ? read(settings.data) : undefined;
  const form = useSettingsDraft(incoming, settings.data?.revision);
  const values = form.values ?? {};
  const guard = useUnsavedGuard(form.dirty);

  // Only what changed is sent, so a file is not rewritten for untouched values.
  const changed = Object.keys(values).filter(
    (key) => JSON.stringify(values[key]) !== JSON.stringify(form.baseline?.[key]),
  );
  const changes = Object.fromEntries(changed.map((key) => [path(key), values[key]]));
  const problems = Object.fromEntries(
    Object.entries(form.values && check ? check(values) : {}).filter(([, problem]) => problem),
  ) as Record<string, string>;
  const conflict = save.error instanceof ApiError && save.error.code === "conflict";
  const failure = settings.error ?? save.error;
  const said = failure
    ? conflict
      ? { title: t("settings.conflict"), detail: undefined }
      : problem(failure instanceof ApiError ? failure.code : undefined, failure.message)
    : null;

  return {
    settings: settings.data,
    values,
    loaded: incoming !== undefined,
    dirty: form.dirty,
    changed,
    /** touched says whether any of the keys holds an unsaved change. */
    touched: (...keys: string[]) => keys.some((key) => changed.includes(key)),
    problems,
    /** troubled says whether any of the keys holds a value that cannot be saved. */
    troubled: (...keys: string[]) => keys.some((key) => key in problems),
    conflict,
    // Nothing was read to show; a reload is the way on, as after a conflict.
    unread: Boolean(settings.error) && !settings.data,
    said,
    pending: save.isPending,
    guard,
    change: form.change,
    submit: () =>
      Object.keys(problems).length === 0 &&
      save.mutate(
        { changes, revision: form.revision ?? "" },
        {
          onSuccess: (result) => {
            form.saved(read(result) ?? {}, result.revision);
            toast.success(t("settings.saved"));
          },
        },
      ),
    revert: () => {
      if (form.baseline && form.revision) form.reset(form.baseline, form.revision);
    },
    reload: async () => {
      const result = await settings.refetch();
      if (result.data) {
        form.reset(read(result.data) ?? {}, result.data.revision);
        save.reset();
      }
    },
  };
}

type Form = ReturnType<typeof useSettingsForm>;

/** FormProblem says what a save or a load ran into, with a reload where one helps. */
export function FormProblem({ form }: { form: Form }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const title = form.said?.title;
  // A save fails at the foot of a long form, out of sight of its head.
  useEffect(() => {
    if (title) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [title]);
  if (!form.said) return null;
  return (
    <Alert ref={ref} variant="destructive" className="mb-6 scroll-mt-4">
      <XCircleIcon />
      <AlertTitle>{form.said.title}</AlertTitle>
      <AlertDescription>
        {form.said.detail && <p>{form.said.detail}</p>}
        {(form.conflict || form.unread) && (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void form.reload()}>
            {t("settings.reload")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** SettingsActions save a settings form from beside its title. */
export function SettingsActions({ form }: { form: Form }) {
  if (!form.loaded) return null;
  return (
    <FormActions
      changes={form.changed.length}
      problems={Object.keys(form.problems).length}
      pending={form.pending}
      blocked={form.conflict}
      onRevert={form.revert}
      onSave={form.submit}
    />
  );
}

/** LeaveGuard asks before a navigation drops what has not been saved. */
export function LeaveGuard({ form }: { form: Form }) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      open={form.guard.leaving}
      onOpenChange={(open) => !open && form.guard.cancel()}
      title={t("editor.discardTitle")}
      desc={t("settings.discardNote")}
      cancelBtnText={t("conflict.keepEditing")}
      confirmText={t("editor.discard")}
      destructive
      handleConfirm={form.guard.discard}
    />
  );
}
