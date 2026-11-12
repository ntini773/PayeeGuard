import React, { useId } from 'react';
import styles from '../../styles/buttons.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'approve' | 'reject' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabledReason?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled = false,
    disabledReason,
    icon,
    children,
    className = '',
    onClick,
    ...props
  },
  ref
) {
  const reasonId = useId();
  const isDisabled = disabled || loading;

  const buttonEl = (
    <button
      ref={ref}
      type={props.type || 'button'}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      aria-describedby={disabledReason && isDisabled ? reasonId : undefined}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );

  if (isDisabled && disabledReason) {
    return (
      <span className={styles.tooltipWrapper}>
        {buttonEl}
        <span id={reasonId} role="tooltip" className={styles.disabledReason}>
          {disabledReason}
        </span>
      </span>
    );
  }

  return buttonEl;
});
