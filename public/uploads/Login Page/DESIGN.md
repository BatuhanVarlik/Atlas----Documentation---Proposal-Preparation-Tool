---
name: Industrial Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#44474e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4e5e7f'
  primary: '#031633'
  on-primary: '#ffffff'
  primary-container: '#1a2b49'
  on-primary-container: '#8293b6'
  inverse-primary: '#b6c7ec'
  secondary: '#bb0014'
  on-secondary: '#ffffff'
  secondary-container: '#e41f25'
  on-secondary-container: '#fffbff'
  tertiary: '#06172a'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c2c40'
  on-tertiary-container: '#8393ac'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#b6c7ec'
  on-primary-fixed: '#081b38'
  on-primary-fixed-variant: '#364766'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000d'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  caption:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

The brand personality of this design system is rooted in the concepts of structural integrity, precision, and executive authority. It is designed for a professional environment where documentation is not just text, but a "cast" of institutional knowledge. The UI evokes a sense of "industrial high-tech"—merging the reliability of traditional engineering with the streamlined efficiency of modern SaaS.

The visual direction follows a **Corporate / Modern** aesthetic with a lean toward technical minimalism. It prioritizes clarity and high-density information architecture, ensuring that complex proposals and long-form documents remain legible and navigable. The emotional response should be one of absolute trust and systematic order.

## Colors

The color palette is derived directly from a heritage of professional excellence. The **Deep Navy Blue (#1A2B49)** serves as the primary foundation, used for navigation, primary headers, and core brand elements to establish stability. The **Vibrant Red (#E31E24)** is utilized sparingly as a high-visibility accent for critical calls-to-action, status alerts, and precise highlights, echoing the "ink on blueprint" or "seal of approval" motif.

The neutral scale leans toward cool, technical grays to maintain the industrial theme. White is used as the primary canvas to ensure maximum readability for documentation, while off-white surfaces define different functional zones of the workspace without introducing visual clutter.

## Typography

This design system utilizes **Hanken Grotesk** for its entire type scale. This font family was chosen for its sharp, contemporary geometry and exceptional legibility in data-heavy environments. It bridges the gap between a classic grotesk (industrial) and a modern geometric (high-tech) sans-serif.

Headlines are set with tight letter-spacing and heavy weights to command attention, while body text uses a generous line height to support long-form reading in documentation. Label styles utilize uppercase transformations and increased letter-spacing to mimic technical annotations found in architectural or engineering drawings.

## Layout & Spacing

The layout is built on a **12-column fluid grid** designed for heavy content density. To reflect the "casting" theme, sections are clearly defined by structured margins and systematic gutters. 

On desktop, the layout utilizes a fixed-width central container for the primary document (mimicking a physical page) with fluid sidebars for navigation and metadata. Mobile transitions follow a single-column reflow, where sidebars collapse into a drawer system to prioritize the reading experience. The 8pt spacing rhythm ensures a crisp, mathematical alignment across all components.

## Elevation & Depth

This design system avoids heavy, organic shadows in favor of **Low-contrast outlines** and **Tonal layers**. Depth is achieved through a "layered sheet" metaphor, where surfaces are stacked using subtle 1px borders in cool grays (#E2E8F0) rather than diffused shadows.

Where elevation is required for interactivity (such as floating action buttons or dropdown menus), a sharp, technical shadow with low blur and 10% opacity is used to maintain the industrial aesthetic. This approach ensures the UI feels "constructed" rather than "floating," emphasizing the grounded, reliable nature of the tool.

## Shapes

The shape language is primarily **Soft (Level 1)**, utilizing a 0.25rem (4px) base radius. This minimal rounding provides a modern touch to buttons and cards without sacrificing the "crisp" and "industrial" feel of the system. 

Form fields and inputs should maintain a sharp, rectangular character to emphasize data integrity and precision. Larger containers, such as document previews or modular cards, may use the `rounded-lg` (8px) variant to provide a subtle visual distinction from functional inputs.

## Components

### Buttons
Buttons use the primary Navy Blue (#1A2B49) for standard actions and the Vibrant Red (#E31E24) exclusively for primary "Submit," "Create," or high-stakes actions. They feature a 4px corner radius and a solid, non-gradient fill to maintain the industrial aesthetic.

### Form Fields
Form fields are the core of the documentation experience. They feature a 1px border (#CBD5E1) that darkens to Navy Blue on focus. Labels are positioned above the field using the `label-md` typography style for a technical, structured appearance.

### Chips & Tags
Used for version control and status (e.g., "Draft," "Approved," "v2.1"). These are rectangular with 2px rounding and use a subtle tonal background with a high-contrast text color.

### Documentation Components
- **Version Stepper:** A vertical or horizontal linear indicator showing the proposal's progress.
- **Diff-Viewer:** High-contrast text highlights (Red for deletions, Deep Navy/Green for additions) used during document review.
- **Tree Navigation:** A strict, hierarchical sidebar for navigating document sections, using thin lines to denote nesting levels.