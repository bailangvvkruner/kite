import { WarningCircleIcon } from '@phosphor-icons/react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * FormActions say what a form holds and save it: how many changes wait, how
 * many values need fixing first, a way back to what is stored, and the save
 * itself, which stays disabled until there is something it can save.
 */
export function FormActions({
  changes,
  problems = 0,
  pending,
  blocked,
  onRevert,
  onSave,
  saveLabel,
}: {
  changes: number
  problems?: number
  pending?: boolean
  /** blocked holds the save back for a reason of the form's own, such as a conflict. */
  blocked?: boolean
  onRevert?: () => void
  onSave: () => void
  saveLabel?: string
}) {
  const { t } = useI18n()
  return (
    <>
      {changes > 0 && (
        <span className='me-1 flex items-center gap-1.5 text-[13px] text-muted-foreground'>
          <span className='size-[7px] rounded-full bg-warning' />
          {t('form.changes', { count: changes })}
        </span>
      )}
      {problems > 0 && (
        <span className='me-1 flex items-center gap-1 text-[13px] text-destructive'>
          <WarningCircleIcon className='size-4' />
          {t('form.problems', { count: problems })}
        </span>
      )}
      {changes > 0 && onRevert && (
        <Button type='button' variant='ghost' onClick={onRevert} disabled={pending}>
          {t('form.revert')}
        </Button>
      )}
      <Button type='button' disabled={changes === 0 || problems > 0 || pending || blocked} onClick={onSave}>
        {pending && <Spinner />}
        {saveLabel ?? t('settings.save')}
      </Button>
    </>
  )
}
