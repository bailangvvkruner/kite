import * as React from 'react'
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
}

export function PasswordInput({
  className,
  disabled,
  ref,
  ...props
}: PasswordInputProps) {
  const { t } = useI18n()
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className={cn('relative rounded-md', className)}>
      <Input
        type={showPassword ? 'text' : 'password'}
        className='pe-10'
        ref={ref}
        disabled={disabled}
        {...props}
      />
      <Button
        type='button'
        size='icon'
        variant='ghost'
        disabled={disabled}
        className='absolute inset-e-1.5 top-1/2 size-7 -translate-y-1/2 rounded-md text-muted-foreground'
        onClick={() => setShowPassword((prev) => !prev)}
      >
        {showPassword ? <EyeIcon size={18} /> : <EyeSlashIcon size={18} />}
        <span className='sr-only'>
          {t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
        </span>
      </Button>
    </div>
  )
}
