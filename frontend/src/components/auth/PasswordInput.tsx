import { useState, useId } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  autoComplete?: string;
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Style variant */
  variant?: 'dark' | 'darker';
}

export default function PasswordInput({
  id,
  label,
  placeholder = '••••••••',
  value,
  onChange,
  required = false,
  minLength,
  disabled = false,
  error,
  helperText,
  autoComplete = 'current-password',
  size = 'md',
  variant = 'dark',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const sizeClasses = {
    sm: 'py-2.5 text-sm',
    md: 'py-3.5 text-sm',
    lg: 'py-4 text-base',
  };

  const bgClasses = {
    dark: 'bg-white/5 border-white/10',
    darker: 'bg-black/40 border-white/10',
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-zinc-300 ml-0.5"
        >
          {label}
        </label>
      )}

      {/* Wrapper: relative container — eye button stays INSIDE, never overlaps input */}
      <div className="relative flex items-center">
        {/* Left icon — pointer-events-none so it never intercepts clicks */}
        <span
          className="absolute left-0 top-0 bottom-0 flex items-center pl-3.5 pointer-events-none z-10"
          aria-hidden="true"
        >
          <Lock size={18} className="text-zinc-500 flex-shrink-0" />
        </span>

        {/* The actual input */}
        <input
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-label={label ?? 'Contraseña'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          aria-invalid={!!error}
          className={[
            'w-full',
            'pl-11 pr-12',   // space for both icons; input area is never blocked
            sizeClasses[size],
            bgClasses[variant],
            'border rounded-xl',
            'text-white placeholder-zinc-500',
            'outline-none',
            'transition-all duration-200',
            'focus:ring-2 focus:ring-[#0D6EFD]/50 focus:border-[#0D6EFD]',
            error ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500' : '',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].filter(Boolean).join(' ')}
        />

        {/* Right eye toggle — explicit w-auto so it NEVER expands to fill parent */}
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={showPassword}
          /* 
           * CRITICAL: style width + position ensures this button can NEVER block the input.
           * We DON'T use className for width because Tailwind might be purged/overridden;
           * inline style here is intentional and correct.
           */
          style={{ width: 'auto', position: 'absolute', right: 0 }}
          className="btn-icon top-0 bottom-0 flex items-center justify-center px-3.5 text-zinc-500 hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/60 rounded-r-xl"
        >
          {showPassword ? <EyeOff size={18} className="flex-shrink-0" /> : <Eye size={18} className="flex-shrink-0" />}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-400 ml-0.5 flex items-center gap-1">
          {error}
        </p>
      )}

      {/* Helper text */}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-xs text-zinc-500 ml-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
}
