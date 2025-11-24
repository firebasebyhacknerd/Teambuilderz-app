# TeamBuilderz Brand Guidelines

## Overview

This document outlines the comprehensive brand system implemented across the TeamBuilderz application, ensuring consistent visual identity and user experience across both light and dark modes.

## Color System

### Primary Brand Colors

- **TBZ Blue**: `hsl(187, 65%, 28%)` (Light) → `hsl(187, 70%, 48%)` (Dark)
- **TBZ Orange**: `hsl(25, 86%, 56%)` (Light) → `hsl(25, 90%, 62%)` (Dark)
- **TBZ Dark**: `hsl(215, 26%, 14%)` (Light) → `hsl(210, 40%, 96%)` (Dark)

### Semantic Colors

- **Success**: `hsl(142, 76%, 36%)` → `hsl(142, 76%, 46%)`
- **Warning**: `hsl(45, 93%, 58%)` → `hsl(45, 93%, 68%)`
- **Destructive**: `hsl(0, 68%, 48%)` → `hsl(0, 70%, 50%)`
- **Info**: `hsl(187, 65%, 48%)` → `hsl(187, 70%, 58%)`

### Surface Colors

- **Background**: `hsl(32, 42%, 96%)` → `hsl(215, 28%, 12%)`
- **Surface**: `hsl(32, 36%, 92%)` → `hsl(215, 26%, 16%)`
- **Card**: `hsl(0, 0%, 100%)` → `hsl(215, 28%, 14%)`

## Typography

### Font Stack

- **Display**: "Manrope", "Inter", system-ui, sans-serif
- **Body**: "Inter", system-ui, sans-serif

### Type Scale

- **3XL**: 1.875rem (30px) - Page titles
- **2XL**: 1.5rem (24px) - Section headers
- **XL**: 1.25rem (20px) - Subsection headers
- **LG**: 1.125rem (18px) - Large body text
- **Base**: 1rem (16px) - Default body text
- **SM**: 0.875rem (14px) - Small text
- **XS**: 0.75rem (12px) - Caption text

## Spacing System

- **2XS**: 0.25rem (4px)
- **XS**: 0.5rem (8px)
- **SM**: 0.75rem (12px)
- **MD**: 1rem (16px)
- **LG**: 1.5rem (24px)
- **XL**: 2rem (32px)
- **2XL**: 3rem (48px)

## Component System

### BrandButton

Variants: `primary`, `secondary`, `accent`, `outline`, `ghost`, `destructive`, `success`, `warning`, `info`, `gradient`

```jsx
<BrandButton variant="primary" size="lg">
  Primary Action
</BrandButton>
```

### BrandCard

Variants: `default`, `elevated`, `brand`, `surface`, `glass`

```jsx
<BrandCard variant="brand" hover>
  Card content
</BrandCard>
```

### BrandHeader

Sizes: `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`

```jsx
<BrandHeader size="2xl" gradient>
  Page Title
</BrandHeader>
```

### BrandBadge

Variants: `default`, `secondary`, `accent`, `success`, `warning`, `destructive`, `info`, `outline`, `brand`

```jsx
<BrandBadge variant="success">Active</BrandBadge>
```

## Utility Classes

### Animations

- `.brand-loading` - Pulse animation
- `.brand-slide-up` - Slide up animation
- `.brand-slide-in` - Slide in animation
- `.brand-fade-in` - Fade in animation

### Interactive States

- `.brand-interactive` - Hover and active states
- `.brand-focus` - Custom focus styles

### Visual Effects

- `.brand-gradient` - Primary brand gradient
- `.brand-text-gradient` - Gradient text
- `.brand-glass` - Glass morphism effect
- `.brand-shadow` - Brand shadow

### Backgrounds

- `.brand-bg-subtle` - Subtle gradient background
- `.brand-bg-pattern` - Pattern background
- `.surface-hover` - Hover surface color
- `.surface-active` - Active surface color

## Usage Guidelines

### 1. Color Usage

- Use primary colors for main actions and important elements
- Reserve accent colors for secondary actions and highlights
- Apply semantic colors consistently for status indicators
- Ensure sufficient contrast ratios in both themes

### 2. Typography

- Use display font for headers and important titles
- Maintain consistent hierarchy across the application
- Ensure readability with proper line heights and spacing

### 3. Components

- Prefer brand components over base UI components
- Use consistent sizing and spacing
- Apply hover states and transitions for better UX

### 4. Layout

- Use the spacing system consistently
- Maintain visual hierarchy with proper sizing
- Ensure responsive design across all viewports

## Implementation Files

### Core Files

- `styles/globals.css` - Main CSS with design system
- `styles/brand-utilities.css` - Brand utility classes
- `tailwind.config.js` - Tailwind configuration

### Component Files

- `components/ui/brand-button.jsx`
- `components/ui/brand-card.jsx`
- `components/ui/brand-header.jsx`
- `components/ui/brand-badge.jsx`
- `components/ui/brand-input.jsx`
- `components/ui/brand-select.jsx`
- `components/ui/brand-table.jsx`
- `components/ui/brand-logo.jsx`

### Updated Pages

- `pages/login.js` - Login page with brand styling
- `pages/recruiter/index.js` - Dashboard with brand colors
- `components/Layout/DashboardLayout.js` - Sidebar navigation

## Dark Mode Considerations

### Color Adjustments

- Primary colors are slightly lighter in dark mode for better contrast
- Surface colors use darker tones to maintain hierarchy
- Text colors are adjusted for optimal readability

### Special Handling

- Glass effects have reduced opacity in dark mode
- Background patterns use more subtle colors
- Shadows are adjusted for dark backgrounds

## Best Practices

1. **Consistency**: Always use brand components and utilities
2. **Accessibility**: Ensure proper contrast ratios
3. **Performance**: Use CSS transitions efficiently
4. **Responsive**: Test across all screen sizes
5. **Testing**: Verify both light and dark modes

## Migration Guide

When updating existing components:

1. Replace standard components with brand variants
2. Update color classes to use semantic colors
3. Add appropriate hover and focus states
4. Test in both light and dark modes
5. Ensure responsive behavior

## Future Enhancements

- Additional component variants
- More animation utilities
- Enhanced accessibility features
- Performance optimizations
- Component composition patterns
