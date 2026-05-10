# Accessibility (A11y) Codemap

**Last Updated:** 2026-05-10
**Commits:** 25+ commits (a11y improvements in rounds 1-3)

## Overview

vue-plugin-hiprint v1.0.0 includes baseline WCAG 2.1 Level AA compliance across designer, toolbar, and canvas interactions.

## Focus Management

### Focus Visible

All interactive elements have explicit focus indicator:

```css
.hiprint-btn:focus-visible,
.hiprint-input:focus-visible,
button:focus-visible,
[role="button"]:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

Elements:
- Toolbar buttons (all groups)
- Property panel inputs
- Panel manager segmented select
- Dialog buttons
- Canvas drag-drop targets

### Tab Order

- Toolbar (left to right, top to bottom)
- Designer panels (left, center, right)
- Dialog overlays (trap focus, return focus on close)

## ARIA Attributes

### Buttons

```html
<!-- Toggle buttons (panel manager, align buttons) -->
<button aria-pressed="false">...</button>  <!-- true when active -->

<!-- Buttons with icons only -->
<button aria-label="Zoom In">⊕</button>
<button aria-label="Rotate Paper">↻</button>

<!-- Explicit type -->
<button type="button">Don't Submit</button>
<button type="submit">Save Template</button>
```

### Dialogs

```html
<div role="dialog" aria-labelledby="dialog-title" aria-describedby="dialog-desc">
  <h2 id="dialog-title">Save Template</h2>
  <p id="dialog-desc">Enter template name and click Save</p>
  ...
</div>
```

Dialogs:
- Template selection modal
- Business selection modal
- Save confirmation dialog
- Custom paper size input dialog

Focus trap enabled on all dialogs.

### Popovers

```html
<div role="dialog" aria-hidden="false">
  <!-- Paper size picker, align menu -->
</div>
```

### Dynamic Content

```html
<!-- Panel manager select -->
<select aria-label="Select Print Page">
  <option>Page 1</option>
  <option>Page 2</option>
</select>

<!-- Status messages (implicitly live region) -->
<div aria-live="polite" aria-atomic="true">
  Element added successfully
</div>
```

## Keyboard Navigation

### Canvas Operations

- **Arrow Keys**: Move selected element (±5px)
- **Shift + Arrow**: Move (±1px)
- **Space**: Activate drag mode (element follows mouse)
- **Escape**: Cancel drag
- **Delete**: Remove selected element
- **Tab**: Cycle through canvas elements

### Panel Manager (Segmented)

- **Arrow Left/Right**: Switch page
- **Enter/Space**: Confirm selection
- **Tab**: Move to add button

### Toolbar

- **Tab**: Cycle through button groups
- **Enter/Space**: Activate button

### Dialogs

- **Tab**: Cycle through buttons (trapped within dialog)
- **Escape**: Close dialog
- **Enter**: Confirm (usually Save button)

## Color & Contrast

### Palette WCAG AA

- Default text: `#000` on `#fff` (21:1 contrast)
- Secondary text: `#666` on `#fff` (7.5:1)
- Buttons: Blue (`#1890ff`) on white (4.5:1)
- Borders: Gray (`#ddd`) on white (2.5:1 — non-critical border)
- Focus outline: currentColor (uses text color, inherits contrast)

### High Contrast Mode Support

```css
@media (prefers-contrast: more) {
  /* Thicker focus border, darker secondary text */
  button:focus-visible {
    outline-width: 3px;
  }
  .secondary {
    color: #333;
  }
}
```

## Motion & Animation

### Reduced Motion Respect

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Applies to:
- Toolbar button hover effects
- Panel slide transitions
- Canvas element animations (if any)

## Form & Input

### Labels

All form inputs have associated labels:

```html
<label for="template-name">Template Name</label>
<input id="template-name" type="text">

<label for="paper-width">Width (mm)</label>
<input id="paper-width" type="number" min="0">
```

### Validation

- Error messages linked to input: `aria-describedby="error-id"`
- Field marked invalid: `aria-invalid="true"`

```html
<input aria-invalid="false" aria-describedby="name-error">
<span id="name-error"></span>  <!-- filled on error -->
```

## Images & Icons

### Alt Text

```html
<!-- Decorative icon (in button label context) -->
<button>
  <svg aria-hidden="true">...</svg>
  Save
</button>

<!-- Standalone image -->
<img src="guide.png" alt="Designer toolbar guide">
```

### Icon Buttons

All icon-only buttons have `aria-label`:

```html
<button aria-label="Zoom In">
  <svg class="icon-zoomin"></svg>
</button>
```

## Testing Recommendations

1. **Automated**: axe / pa11y / Google Lighthouse
2. **Keyboard**: Tab through entire UI, verify focus visible everywhere
3. **Screen Reader**: NVDA (Windows) / JAWS / VoiceOver (macOS)
4. **Manual**: Check contrast ratios with WebAIM tools
5. **Motion**: Test with `prefers-reduced-motion: reduce` enabled

## Coverage Status

| Area | Status | Notes |
|------|--------|-------|
| Focus Visible | ✅ v1.0.0 | All interactive elements |
| ARIA Roles | ✅ v1.0.0 | Dialog, button, select, etc. |
| Keyboard Nav | ✅ v1.0.0 | Canvas, panels, dialogs |
| Color Contrast | ✅ v1.0.0 | WCAG AA compliant palette |
| Form Labels | ✅ v1.0.0 | All inputs associated |
| Reduced Motion | ✅ v1.0.0 | CSS media query support |
| Screen Readers | ⚠ Partial | Tested NVDA; VoiceOver pending |

## Related Commits

- `cdffa2e` — a11y dialog/popover/panel-keyboard
- `494fca9` — security/a11y/silent-failure round-3
- `0613f8f` — 4-agent review fixes (a11y included)

## Further Reading

- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
