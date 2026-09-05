import * as React from 'react';
import type { HTMLAttributes, PropsWithChildren } from 'react';

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export const IDE_LAYOUT_BUILD = 30 as const;
export const IDE_LAYOUT_SCHEMA = 'gd-ide-layout/1' as const;

export interface WorkbenchProps extends HTMLAttributes<HTMLDivElement> {
  readonly sidebarCollapsed?: boolean;
  readonly panelCollapsed?: boolean;
}

export function Workbench({
  className,
  sidebarCollapsed = false,
  panelCollapsed = false,
  ...props
}: WorkbenchProps) {
  return (
    <div
      className={classes('gd-workbench', className)}
      data-gd-layout={IDE_LAYOUT_SCHEMA}
      data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
      data-panel-collapsed={panelCollapsed ? 'true' : 'false'}
      {...props}
    />
  );
}

export function WorkbenchTopBar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={classes('gd-workbench__topbar', className)} {...props} />;
}

export interface WorkbenchActivityBarProps extends HTMLAttributes<HTMLElement> {
  readonly 'aria-label': string;
}

export function WorkbenchActivityBar({ className, ...props }: WorkbenchActivityBarProps) {
  return <nav className={classes('gd-workbench__activity', className)} {...props} />;
}

export interface WorkbenchSidebarProps extends HTMLAttributes<HTMLElement> {
  readonly 'aria-label': string;
}

export function WorkbenchSidebar({ className, ...props }: WorkbenchSidebarProps) {
  return <aside className={classes('gd-workbench__sidebar', className)} {...props} />;
}

export interface WorkbenchEditorProps extends HTMLAttributes<HTMLElement> {
  readonly 'aria-label': string;
}

export function WorkbenchEditor({ className, ...props }: WorkbenchEditorProps) {
  return <main className={classes('gd-workbench__editor', className)} {...props} />;
}

export interface WorkbenchPanelProps extends HTMLAttributes<HTMLElement> {
  readonly 'aria-label': string;
}

export function WorkbenchPanel({ className, ...props }: WorkbenchPanelProps) {
  return <section className={classes('gd-workbench__panel', className)} {...props} />;
}

export function WorkbenchStatusBar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer className={classes('gd-workbench__status', className)} {...props} />;
}

export interface WorkbenchTabBarProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  readonly label: string;
}

export function WorkbenchTabBar({ className, label, ...props }: WorkbenchTabBarProps) {
  return (
    <div
      className={classes('gd-workbench__tabs', className)}
      role="tablist"
      aria-label={label}
      {...props}
    />
  );
}
