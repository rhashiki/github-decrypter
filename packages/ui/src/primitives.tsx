import * as React from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from 'react';

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export type CardTone = 'default' | 'warning' | 'success';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone?: CardTone;
}

export function Card({ className, tone = 'default', ...props }: CardProps) {
  return <div className={classes('gd-card', `gd-card--${tone}`, className)} {...props} />;
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: 'neutral' | 'accent' | 'success' | 'warning';
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return <span className={classes('gd-badge', `gd-badge--${tone}`, className)} {...props} />;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ className, type = 'button', variant = 'secondary', ...props }: ButtonProps) {
  return (
    <button
      className={classes('gd-button', `gd-button--${variant}`, className)}
      type={type}
      {...props}
    />
  );
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  readonly gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly direction?: 'row' | 'column';
  readonly align?: 'start' | 'center' | 'end' | 'stretch';
}

export function Stack({
  className,
  gap = 'md',
  direction = 'column',
  align = 'stretch',
  ...props
}: StackProps) {
  return (
    <div
      className={classes(
        'gd-stack',
        `gd-stack--${direction}`,
        `gd-stack--gap-${gap}`,
        `gd-stack--align-${align}`,
        className,
      )}
      {...props}
    />
  );
}

export interface StatusProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: 'success' | 'warning' | 'danger' | 'neutral';
  readonly label: ReactNode;
}

export function Status({ className, tone = 'neutral', label, ...props }: StatusProps) {
  return (
    <span className={classes('gd-status', `gd-status--${tone}`, className)} {...props}>
      <span className="gd-status__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export interface SectionHeadingProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  readonly eyebrow?: ReactNode;
}

export function SectionHeading({ className, eyebrow, children, ...props }: SectionHeadingProps) {
  return (
    <div className={classes('gd-section-heading', className)} {...props}>
      {eyebrow ? <span className="gd-eyebrow">{eyebrow}</span> : null}
      {children}
    </div>
  );
}
