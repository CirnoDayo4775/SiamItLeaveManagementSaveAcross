// UI-related constants used throughout the application

// Animation delays in milliseconds
export const ANIMATION_DELAYS = {
  SHORT: 100,
  MEDIUM: 300,
  LONG: 500,
  EXTRA_LONG: 1000
} as const;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
  LARGE_DESKTOP: 1536
} as const;

// Z-index values for layering
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
  TOAST: 1080,
  NOTIFICATION: 1090
} as const;

// Spacing values (in pixels)
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
  XXXL: 64
} as const;

// Border radius values (in pixels)
export const BORDER_RADIUS = {
  NONE: 0,
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  FULL: 9999
} as const;

// Shadow values
export const SHADOWS = {
  NONE: 'none',
  SM: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  MD: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  LG: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  XL: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  INNER: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'
} as const;

// Transition durations (in milliseconds)
export const TRANSITIONS = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
} as const;

// Transition timing functions
export const TRANSITION_EASING = {
  LINEAR: 'linear',
  EASE_IN: 'ease-in',
  EASE_OUT: 'ease-out',
  EASE_IN_OUT: 'ease-in-out',
  BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
} as const;

// Loading states
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
} as const;

// Form validation states
export const VALIDATION_STATES = {
  NONE: 'none',
  VALID: 'valid',
  INVALID: 'invalid',
  PENDING: 'pending'
} as const;

// Button sizes
export const BUTTON_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg'
} as const;

// Input sizes
export const INPUT_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg'
} as const;

// Avatar sizes
export const AVATAR_SIZES = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl'
} as const;

// Icon sizes
export const ICON_SIZES = {
  XS: 12,
  SM: 16,
  MD: 20,
  LG: 24,
  XL: 32,
  XXL: 48
} as const;

// Color opacity values
export const OPACITY = {
  NONE: 0,
  LOW: 0.1,
  MEDIUM: 0.5,
  HIGH: 0.8,
  FULL: 1
} as const;

// Grid breakpoints for responsive layouts
export const GRID_BREAKPOINTS = {
  COLUMNS: {
    MOBILE: 1,
    TABLET: 2,
    DESKTOP: 3,
    LARGE_DESKTOP: 4
  },
  GAP: {
    MOBILE: SPACING.MD,
    TABLET: SPACING.LG,
    DESKTOP: SPACING.XL
  }
} as const;
