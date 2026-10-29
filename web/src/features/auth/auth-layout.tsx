import { useI18n } from '@/i18n'
import { KiteMark } from '@/components/KiteMark'
import { LanguagePicker } from '@/components/language-picker'

type AuthLayoutProps = {
  title: React.ReactNode
  description: React.ReactNode
  children: React.ReactNode
  // Kite: a site being created has no pages to go back to yet.
  noSite?: boolean
}

/**
 * The door, and what it says: no site title and nothing about what is
 * behind it. Everything a studio knows comes from an API that will not answer
 * until somebody has signed in.
 *
 * It is the studio's own sky: a white sheet on the canvas the rail sits on,
 * under the mark and its serif name.
 */
export function AuthLayout({
  title,
  description,
  children,
  noSite,
}: AuthLayoutProps) {
  return (
    // Kite: min-h-svh rather than h-svh, so a form taller than a landscape
    // phone scrolls instead of losing its top.
    <div className='flex min-h-svh flex-col items-center justify-center bg-canvas px-4 py-10'>
      <div className='w-full max-w-[26rem] rounded-2xl bg-card p-7 pb-5 text-card-foreground shadow-[0_1px_2px_rgb(23_32_54/0.04),0_0_0_1px_rgb(23_32_54/0.04),0_12px_32px_rgb(23_32_54/0.06)] sm:p-8 sm:pb-6 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.06)]'>
        <div className='flex items-center gap-2'>
          <KiteMark tight className='h-[18px] w-auto' />
          <span className='font-serif text-xl leading-none font-bold'>Kite</span>
        </div>
        <div className='mt-6 mb-5 grid gap-1'>
          <h1 className='text-lg font-semibold tracking-tight'>{title}</h1>
          <p className='text-sm text-muted-foreground'>{description}</p>
        </div>
        {children}
        <AuthFooter noSite={noSite} />
      </div>
    </div>
  )
}

/** AuthFooter is the way back out, and the language to read the form in. */
function AuthFooter({ noSite }: { noSite?: boolean }) {
  const { t } = useI18n()
  return (
    <div className='mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground'>
      {!noSite && (
        <>
          {/* The server sends the bare host to the site's home page. */}
          <a href='/' className='transition-colors hover:text-foreground'>
            {t('login.backToSite')}
          </a>
          <span aria-hidden>·</span>
        </>
      )}
      <LanguagePicker />
    </div>
  )
}
