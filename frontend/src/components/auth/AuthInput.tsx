import type { ReactNode, InputHTMLAttributes } from 'react';

interface AuthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  label?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  onIconRightClick?: () => void;
  error?: string;
  helperText?: string;
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Style variant */
  variant?: 'dark' | 'darker';
  onChange?: (value: string) => void;
}

export default function AuthInput({
  label,
  icon,
  iconRight,
  onIconRightClick,
  error,
  helperText,
  size = 'md',
  variant = 'dark',
  id,
  onChange,
  className,
  ...rest
}: AuthInputProps) {
  const sizeClasses = {
    sm: 'py-2.5 text-sm',
    md: 'py-3.5 text-sm',
    lg: 'py-4 text-base',
  };

  const bgClasses = {
    dark: 'bg-white/5 border-white/10',
    darker: 'bg-black/40 border-white/10',
  };

  const hasLeftIcon = !!icon;
  const hasRightIcon = !!iconRight;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-zinc-300 ml-0.5"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Left icon */}
        {hasLeftIcon && (
          <span
            className="absolute left-0 top-0 bottom-0 flex items-center pl-3.5 pointer-events-none z-10"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}

        <input
          id={id}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : helperText ? `${id}-helper` : undefined
          }
          className={[
            'w-full',
            hasLeftIcon ? 'pl-11' : 'pl-4',
            hasRightIcon ? 'pr-12' : 'pr-4',
            sizeClasses[size],
            bgClasses[variant],
            'border rounded-xl',
            'text-white placeholder-zinc-500',
            'outline-none',
            'transition-all duration-200',
            'focus:ring-2 focus:ring-[#0D6EFD]/50 focus:border-[#0D6EFD]',
            error ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500' : '',
            rest.disabled ? 'opacity-50 cursor-not-allowed' : '',
            className ?? '',
          ].filter(Boolean).join(' ')}
          {...rest}
        />

        {/* Right icon / button */}
        {hasRightIcon && (
          onIconRightClick ? (
            <button
              type="button"
              onClick={onIconRightClick}
              style={{ width: 'auto', position: 'absolute', right: 0 }}
              className="btn-icon top-0 bottom-0 flex items-center justify-center px-3.5 text-zinc-500 hover:text-white transition-colors"
              aria-hidden="true"
              tabIndex={-1}
            >
              {iconRight}
            </button>
          ) : (
            <span
              style={{ position: 'absolute', right: 0 }}
              className="top-0 bottom-0 flex items-center pr-3.5 pointer-events-none text-zinc-500"
            >
              {iconRight}
            </span>
          )
        )}
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-400 ml-0.5">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-xs text-zinc-500 ml-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
}
