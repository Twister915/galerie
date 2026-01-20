// Unified Button component
// Consolidates all button variants into a single reusable component

import type { JSX } from 'preact';
import { forwardRef } from 'preact/compat';

export type ButtonVariant = 'default' | 'icon' | 'filled' | 'menu-item' | 'viewer' | 'viewer-nav';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  open?: boolean;
  disabled?: boolean;
}

function buildClassName(props: Pick<ButtonProps, 'variant' | 'size' | 'active' | 'open'>, extraClass?: string): string {
  const { variant = 'default', size = 'md', active, open } = props;

  const classes = ['btn'];

  // Size modifier (only if not default md)
  if (size !== 'md') {
    classes.push(`btn--${size}`);
  }

  // Variant modifier
  if (variant !== 'default') {
    classes.push(`btn--${variant}`);
  }

  // State modifiers
  if (active) {
    classes.push('btn--active');
  }
  if (open) {
    classes.push('btn--open');
  }

  // Extra class from props
  if (extraClass) {
    classes.push(extraClass);
  }

  return classes.join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    variant,
    size,
    active,
    open,
    class: className,
    children,
    ...rest
  } = props;

  const finalClass = buildClassName({ variant, size, active, open }, className as string | undefined);

  return (
    <button ref={ref} class={finalClass} {...rest}>
      {children}
    </button>
  );
});
