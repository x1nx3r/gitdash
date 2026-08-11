import * as React from 'react';

type MaterialElementProps<T = HTMLElement> = React.DetailedHTMLProps<
  React.HTMLAttributes<T>,
  T
> & {
  slot?: string;
  disabled?: boolean;
  href?: string;
  target?: string;
  type?: string;
  label?: string;
  value?: string | number;
  placeholder?: string;
  checked?: boolean;
  selected?: boolean;
  indeterminate?: boolean;
  inset?: boolean;
  level?: string | number;
  clickable?: boolean;
  badgeValue?: string | number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
};

type MaterialElements = {
  'md-elevated-card': MaterialElementProps;
  'md-filled-card': MaterialElementProps;
  'md-outlined-card': MaterialElementProps;
  'md-elevation': MaterialElementProps;
  'md-badge': MaterialElementProps;
  'md-ripple': MaterialElementProps;
  'md-icon': MaterialElementProps;
  'md-linear-progress': MaterialElementProps;
  'md-circular-progress': MaterialElementProps;
  'md-divider': MaterialElementProps;
  'md-switch': MaterialElementProps;
  'md-slider': MaterialElementProps;
  'md-filled-button': MaterialElementProps;
  'md-outlined-button': MaterialElementProps;
  'md-elevated-button': MaterialElementProps;
  'md-text-button': MaterialElementProps;
  'md-icon-button': MaterialElementProps;
  'md-filled-icon-button': MaterialElementProps;
  'md-outlined-icon-button': MaterialElementProps;
  'md-filled-text-field': MaterialElementProps;
  'md-outlined-text-field': MaterialElementProps;
  'md-checkbox': MaterialElementProps;
  'md-chip-set': MaterialElementProps;
  'md-assist-chip': MaterialElementProps;
  'md-filter-chip': MaterialElementProps;
  'md-list': MaterialElementProps;
  'md-list-item': MaterialElementProps;
};

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends MaterialElements {}
  }
}

declare module 'react' {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends MaterialElements {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends MaterialElements {}
  }
}
