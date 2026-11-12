import React, { useId } from 'react';
import styles from '../../styles/buttons.module.css';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // Accessible name required
  icon: React.ReactNode;
  disabledReason?: string;
  className?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, disabled = false, disabledReason, className = '', ...props },
  ref
) {
  const reasonId = useId();

  const buttonEl = (
    <button
      ref={ref}
      type="button"
      className={`${styles.iconButton} ${className}`}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-describedby={disabledReason && disabled ? reasonId : undefined}
      {...props}
    >
      {icon}
    </button>
  );

  if (disabled && disabledReason) {
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
