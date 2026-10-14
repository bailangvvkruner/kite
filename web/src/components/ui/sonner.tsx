import { WarningCircleIcon, CheckCircleIcon, InfoIcon, WarningIcon } from '@phosphor-icons/react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useI18n } from '@/i18n'
import { useTheme } from '@/lib/theme'

/**
 * shadcn-admin's Toaster as explore's console dresses it: each state has an
 * icon, which index.css tints under .kite-toaster, and the close button sits
 * on the top-right corner.
 */
export function Toaster({ ...props }: ToasterProps) {
  const { t } = useI18n()
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className='kite-toaster toaster group [&_div[data-content]]:w-full'
      position='top-center'
      offset={16}
      gap={8}
      visibleToasts={3}
      closeButton
      toastOptions={{ closeButtonAriaLabel: t('common.close') }}
      icons={{
        success: <CheckCircleIcon size={16} />,
        info: <InfoIcon size={16} />,
        warning: <WarningIcon size={16} />,
        error: <WarningCircleIcon size={16} />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': '12px',
          '--width': '340px',
          '--toast-close-button-start': 'unset',
          '--toast-close-button-end': '0',
          '--toast-close-button-transform': 'translate(35%, -35%)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
