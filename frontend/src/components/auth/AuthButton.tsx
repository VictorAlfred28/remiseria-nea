import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'white';

interface AuthButtonProps {
  children: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  id?: string;
  className?: string;
  icon?: ReactNode;
  /** If true, renders as full-width block */
  block?: boolean;
}

const variantMap: Record<ButtonVariant, string> = {
  primary:
    'bg-[#0D6EFD] hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(13,110,253,0.25)] hover:shadow-[0_0_28px_rgba(13,110,253,0.45)]',
  secondary:
    'bg-white/8 hover:bg-white/14 text-white border border-white/15 hover:border-white/25',
  ghost:
    'bg-transparent hover:bg-white/8 text-zinc-400 hover:text-white',
  danger:
    'bg-red-600/80 hover:bg-red-600 text-white',
  white:
    'bg-white hover:bg-gray-100 text-[#071B4D] shadow-[0_4px_20px_rgba(255,255,255,0.15)]',
};

export default function AuthButton({
  children,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  id,
  className = '',
  icon,
  block = true,
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{ width: block ? '100%' : 'auto' }}
      className={[
        'relative flex items-center justify-center gap-2',
        'py-3.5 px-5',
        'rounded-xl',
        'font-bold text-sm',
        'transition-all duration-200',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/70',
        'disabled:opacity-55 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantMap[variant],
        className,
      ].filter(Boolean).join(' ')}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin flex-shrink-0" aria-hidden="true" />
      ) : icon ? (
        <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
