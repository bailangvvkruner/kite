import { type SVGProps } from 'react'
import { Root as Radio, Item } from '@radix-ui/react-radio-group'
import { CheckCircleIcon, ArrowCounterClockwiseIcon, GearSixIcon } from '@phosphor-icons/react'
import { IconLayoutCompact } from '@/assets/custom/icon-layout-compact'
import { IconLayoutDefault } from '@/assets/custom/icon-layout-default'
import { IconLayoutFull } from '@/assets/custom/icon-layout-full'
import { IconThemeDark } from '@/assets/custom/icon-theme-dark'
import { IconThemeLight } from '@/assets/custom/icon-theme-light'
import { IconThemeSystem } from '@/assets/custom/icon-theme-system'
import { useI18n } from '@/i18n'
import { useTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { type Collapsible, useLayout } from '@/context/layout-provider'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSidebar } from './ui/sidebar'

export function ConfigDrawer() {
  const { t } = useI18n()
  const { setOpen } = useSidebar()
  const { setTheme } = useTheme()
  const { resetLayout } = useLayout()

  const handleReset = () => {
    setOpen(true)
    setTheme('system')
    resetLayout()
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size='icon'
          variant='ghost'
          aria-label={t('config.title')}
          className='rounded-full'
        >
          <GearSixIcon aria-hidden='true' />
        </Button>
      </SheetTrigger>
      <SheetContent className='flex flex-col'>
        <SheetHeader className='pb-0 text-start'>
          <SheetTitle>{t('config.title')}</SheetTitle>
          <SheetDescription>{t('config.description')}</SheetDescription>
        </SheetHeader>
        <div className='space-y-6 overflow-y-auto px-4'>
          <ThemeConfig />
          <LayoutConfig />
        </div>
        <SheetFooter className='gap-2'>
          <Button
            variant='destructive'
            onClick={handleReset}
            aria-label={t('config.reset')}
          >
            {t('config.reset')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SectionTitle({
  title,
  showReset = false,
  onReset,
  resetAriaLabel,
  className,
}: {
  title: string
  showReset?: boolean
  onReset?: () => void
  /** Shown on the small per-section reset arrow for accessibility and tests. */
  resetAriaLabel?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground',
        className
      )}
    >
      {title}
      {showReset && onReset && (
        <Button
          type='button'
          size='icon'
          variant='secondary'
          className='size-4 rounded-full'
          onClick={onReset}
          aria-label={resetAriaLabel}
        >
          <ArrowCounterClockwiseIcon className='size-3' />
        </Button>
      )}
    </div>
  )
}

function RadioGroupItem({
  item,
  isTheme = false,
}: {
  item: {
    value: string
    label: string
    icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement
  }
  isTheme?: boolean
}) {
  return (
    <Item
      value={item.value}
      className={cn('group outline-none', 'transition duration-200 ease-in')}
      aria-label={item.label}
      aria-describedby={`${item.value}-description`}
    >
      <div
        className={cn(
          'relative rounded-[6px] ring-[1px] ring-border',
          'group-data-[state=checked]:shadow-2xl group-data-[state=checked]:ring-primary',
          'group-focus-visible:ring-2'
        )}
        role='img'
        aria-hidden='false'
        aria-label={item.label}
      >
        <CheckCircleIcon
          className={cn(
            'size-6 fill-primary stroke-white',
            'group-data-[state=unchecked]:hidden',
            'absolute top-0 right-0 translate-x-1/2 -translate-y-1/2'
          )}
          aria-hidden='true'
        />
        <item.icon
          className={cn(
            !isTheme &&
              'fill-primary stroke-primary group-data-[state=unchecked]:fill-muted-foreground group-data-[state=unchecked]:stroke-muted-foreground'
          )}
          aria-hidden='true'
        />
      </div>
      <div
        className='mt-1 text-xs'
        id={`${item.value}-description`}
        aria-live='polite'
      >
        {item.label}
      </div>
    </Item>
  )
}

function ThemeConfig() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <SectionTitle
        title={t('config.theme')}
        showReset={theme !== 'system'}
        onReset={() => setTheme('system')}
        resetAriaLabel={t('config.reset')}
      />
      <Radio
        value={theme}
        onValueChange={(value) => setTheme(value as Theme)}
        className='grid w-full max-w-md grid-cols-3 gap-4'
        aria-label={t('config.theme')}
      >
        {[
          {
            value: 'system',
            label: t('settings.system'),
            icon: IconThemeSystem,
          },
          {
            value: 'light',
            label: t('settings.light'),
            icon: IconThemeLight,
          },
          {
            value: 'dark',
            label: t('settings.dark'),
            icon: IconThemeDark,
          },
        ].map((item) => (
          <RadioGroupItem key={item.value} item={item} isTheme />
        ))}
      </Radio>
    </div>
  )
}

function LayoutConfig() {
  const { t } = useI18n()
  const { open, setOpen } = useSidebar()
  const { defaultCollapsible, collapsible, setCollapsible } = useLayout()

  const radioState = open ? 'default' : collapsible

  return (
    <div className='max-md:hidden'>
      <SectionTitle
        title={t('config.layout')}
        showReset={radioState !== 'default'}
        onReset={() => {
          setOpen(true)
          setCollapsible(defaultCollapsible)
        }}
        resetAriaLabel={t('config.reset')}
      />
      <Radio
        value={radioState}
        onValueChange={(v) => {
          if (v === 'default') {
            setOpen(true)
            return
          }
          setOpen(false)
          setCollapsible(v as Collapsible)
        }}
        className='grid w-full max-w-md grid-cols-3 gap-4'
        aria-label={t('config.layout')}
      >
        {[
          {
            value: 'default',
            label: t('config.default'),
            icon: IconLayoutDefault,
          },
          {
            value: 'icon',
            label: t('config.compact'),
            icon: IconLayoutCompact,
          },
          {
            value: 'offcanvas',
            label: t('config.full'),
            icon: IconLayoutFull,
          },
        ].map((item) => (
          <RadioGroupItem key={item.value} item={item} />
        ))}
      </Radio>
    </div>
  )
}
