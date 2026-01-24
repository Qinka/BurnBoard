# BurnBoard UI Design Blueprint

This document outlines the TensorBoard-inspired UI redesign for BurnBoard.

## Design Goals

1. **Professional appearance** - Match TensorBoard's clean, modern look
2. **Better organization** - Sidebar navigation for better content organization
3. **Improved readability** - Proper spacing, typography, and color contrast
4. **Consistent theming** - Orange accent color (TensorBoard's signature)
5. **Responsive design** - Works well on different screen sizes

---

## Layout Design

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  🔥 BURNBOARD                                            [Auto-refresh] │ │
│  │  TensorBoard-compatible visualization                                   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┬───────────────────────────────────────────────────────────┐ │
│ │              │                                                           │ │
│ │  NAVIGATION  │                     MAIN CONTENT AREA                     │ │
│ │              │                                                           │ │
│ │ ┌──────────┐ │  ┌─────────────────────────────────────────────────────┐  │ │
│ │ │ Scalars  │ │  │                                                     │  │ │
│ │ └──────────┘ │  │   CHART CARD (train/loss)                          │  │ │
│ │              │  │   ┌─────────────────────────────────────────────┐  │  │ │
│ │ ┌──────────┐ │  │   │                                             │  │  │ │
│ │ │Histograms│ │  │   │         📈 Line Chart                       │  │  │ │
│ │ └──────────┘ │  │   │                                             │  │  │ │
│ │              │  │   │                                             │  │  │ │
│ │              │  │   └─────────────────────────────────────────────┘  │  │ │
│ │              │  │                                                     │  │ │
│ │              │  └─────────────────────────────────────────────────────┘  │ │
│ │              │                                                           │ │
│ │              │  ┌─────────────────────────────────────────────────────┐  │ │
│ │              │  │                                                     │  │ │
│ │              │  │   CHART CARD (train/accuracy)                      │  │ │
│ │              │  │   ┌─────────────────────────────────────────────┐  │  │ │
│ │              │  │   │                                             │  │  │ │
│ │              │  │   │         📈 Line Chart                       │  │  │ │
│ │              │  │   │                                             │  │  │ │
│ │              │  │   │                                             │  │  │ │
│ │              │  │   └─────────────────────────────────────────────┘  │  │ │
│ │              │  │                                                     │  │ │
│ │              │  └─────────────────────────────────────────────────────┘  │ │
│ │              │                                                           │ │
│ └──────────────┴───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Color Scheme (TensorBoard-Inspired)

### Primary Colors
- **Primary Orange**: `#FF6F00` (TensorBoard's signature color)
- **Primary Orange Light**: `#FF9800`
- **Primary Orange Dark**: `#E65100`

### Background Colors
- **Dark Mode Background**: `#1E1E1E` (darker, more professional)
- **Dark Mode Surface**: `#2D2D2D` (for cards)
- **Dark Mode Surface Hover**: `#383838`
- **Light Mode Background**: `#FAFAFA`
- **Light Mode Surface**: `#FFFFFF`

### Text Colors
- **Dark Mode Text Primary**: `#FFFFFF`
- **Dark Mode Text Secondary**: `#B0B0B0`
- **Light Mode Text Primary**: `#212121`
- **Light Mode Text Secondary**: `#757575`

### Chart Colors
- **Chart Line Primary**: `#FF6F00` (orange)
- **Chart Line Secondary**: `#2196F3` (blue)
- **Chart Grid**: `#404040` (dark mode) / `#E0E0E0` (light mode)

---

## Component Designs

### 1. Header Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔥 BURNBOARD                                   [🔄 Refresh] [⏱️ Auto: 5s] │
│  TensorBoard-compatible visualization dashboard                             │
└─────────────────────────────────────────────────────────────────────────────┘

Features:
- Fixed position at top
- Left-aligned logo with fire emoji
- Orange accent underline
- Right-aligned refresh controls
- Subtle shadow for depth
```

### 2. Sidebar Navigation

```
┌──────────────────┐
│                  │
│   📊 SCALARS     │  ← Active tab (orange highlight)
│                  │
│   📈 HISTOGRAMS  │  ← Inactive tab (subtle)
│                  │
│                  │
│                  │
│                  │
│                  │
└──────────────────┘

Features:
- Vertical navigation tabs
- Orange left border for active tab
- Hover effects
- Icons for visual clarity
- Collapsible on mobile
```

### 3. Chart Cards

```
┌─────────────────────────────────────────────────────────────────────┐
│  ▼ train/loss                                           [📊] [⬇️]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│         100 ┤                                                       │
│             │    ╭──────╮                                          │
│          75 ┤   ╱        ╲                                         │
│             │  ╱          ╲                                        │
│          50 ┤ ╱            ╲────────                               │
│             │╱                      ╲                              │
│          25 ┤                        ╲────────                     │
│             │                                                       │
│           0 ┼──────────────────────────────────────────            │
│             0      200      400      600      800     Step          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Last value: 23.45  |  Min: 12.3  |  Max: 98.7                     │
└─────────────────────────────────────────────────────────────────────┘

Features:
- Rounded corners with subtle border
- Collapsible header with tag name
- Orange left accent bar
- Chart area with proper padding
- Footer with statistics
- Hover effects for interactivity
```

---

## Typography

### Font Stack
```css
font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Sizes
- **Header Title**: 1.5rem (24px), font-weight: 500
- **Section Headers**: 1.125rem (18px), font-weight: 500
- **Chart Titles**: 0.875rem (14px), font-weight: 500
- **Body Text**: 0.875rem (14px), font-weight: 400
- **Small/Meta**: 0.75rem (12px), font-weight: 400

---

## Spacing System (8px Grid)

- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **xxl**: 48px

---

## Transitions

- **Default**: `all 0.2s ease-in-out`
- **Hover Effects**: `background-color 0.15s ease`
- **Collapse/Expand**: `max-height 0.3s ease-in-out`

---

## Responsive Breakpoints

- **Mobile**: < 768px (sidebar collapses)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

---

## Implementation Notes

1. **CSS Variables** - Use CSS custom properties for theming
2. **BEM Naming** - Use BEM-style class names for maintainability
3. **Dark Mode First** - Design for dark mode by default (matches TensorBoard)
4. **Accessibility** - Maintain proper contrast ratios and focus states
