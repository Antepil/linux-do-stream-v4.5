# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linux.do Stream Extension - A Chrome side panel extension for browsing Linux.do community topics. Built with Manifest V3, Apple HIG design style, and modular ES6 architecture.

## Development Commands

No build process required. To test changes:

1. Open Chrome at `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Make edits to any file
5. Click the extension's refresh button or reload from `chrome://extensions/`

**Icon generation**: `python create_icons.py`

## Architecture

### Directory Structure

```
assets/
  icons/        # Extension icons (16/48/128px PNG)
  css/          # Styles (Apple HIG design with CSS variables)
src/
  utils/        # Pure logic modules
    api.js      # API requests, rate limiting, user auth
    storage.js  # Chrome storage wrapper
    formatters.js # Time, number, HTML formatting
  sidepanel/    # Side panel module
    main.js     # Entry point (ES module)
    ui-render.js # DOM rendering logic
    index.html  # Side panel HTML (type="module")
manifest.json   # Extension configuration
background.js   # Service worker (root, unchanged)
content.js      # Page script for data extraction
```

### Module Dependencies

```
src/sidepanel/main.js
├── src/utils/api.js
├── src/utils/storage.js
├── src/utils/formatters.js
└── src/sidepanel/ui-render.js
```

### Key Data Flow

1. Side panel loads → reads config from `chrome.storage.local`
2. `main.js` imports `api.js` → calls `/latest.json`
3. Response includes `topics` and `users` arrays
4. `window.allUsersMap` created for trust level lookups
5. `ui-render.js` handles filtering, sorting, rendering

### Configuration System

**Storage keys**: `config`, `readTopicIds`, `userSettings`

**DEFAULT_CONFIG** (src/utils/storage.js):
- `pollingInterval` - Auto-refresh interval in seconds
- `blockCategories` - Array of category slugs to filter
- `keywordBlacklist` - Comma-separated filter strings
- `themeMode` - 'light', 'dark', or 'system'
- `clickBehavior` - 'newTab' or 'background'
- `syncReadStatus` - Sync read status with site

### Category Mapping

CATEGORIES array (src/sidepanel/ui-render.js) maps forum IDs to display names and slugs:
```javascript
{ id: 4, name: '开发调优', slug: 'develop' }
{ id: 98, name: '国产替代', slug: 'domestic' }
```

API endpoints: `/latest.json`, `/top.json`, `/c/{slug}/{id}.json`

### Trust Level Badges

User trust levels extracted from `users` array in API response:
- Admin: Gold shield icon
- Level 4 (领袖): Purple star
- Level 3 (常任成员): Blue star
- Level 2 (成员): Green checkmark
- Level 1 (基本用户): Blue info circle

### Theme System

CSS variables in `:root` and `[data-theme="dark"]` (assets/css/styles.css):
- `--bg-main`, `--bg-surface`, `--text-primary`, etc.
- System theme uses `@media (prefers-color-scheme: dark)`

### Rate Limiting & Caching

- User status cached for 5 minutes (TTL)
- 429 errors trigger 5-second cooldown
- Login state check: `/session/current.json` with Discourse headers

### Important Implementation Notes

- Use ES6 `import`/`export` for all side panel modules
- API calls via `src/utils/api.js` (background.js unchanged)
- Trust level data from `users` array, not topics
- Use `window.allUsersMap` for O(1) user data lookups
- Message passing: sidepanel → background via `chrome.runtime.sendMessage`
- Animations use `requestAnimationFrame` for 60FPS

## Git Workflow Rules

- Feature branches: `feature/description-of-change`
- Never push directly to main
- Commit frequently: every small working feature
- Messages: Descriptive and imperative ("Add login form")
- Format: "feat: description" for features, "fix: description" for fixes

## Design Guidelines

When modifying CSS or adding UI components, follow these visual design principles:

### Typography
- Use **Inter** for body text and **JetBrains Mono** for numbers/code
- Avoid generic system fonts; maintain consistent font stack
- Headings can use gradient text effects

### Color & Theme
- **Primary palette**: 2-3 dominant colors only
  - `--primary`: #6366f1 (Indigo)
  - `--accent`: #06b6d4 (Cyan)
- Use sharp accent colors sparingly for highlights
- Avoid more than 3 main colors in the palette
- Light/dark mode: invert values, don't change color hues

### Motion
- Use `var(--ease-bounce)` for hover/click interactions (cubic-bezier: 0.34, 1.56, 0.64, 1)
- Use `var(--ease-smooth)` for transitions (cubic-bezier: 0.4, 0, 0.2, 1)
- Animate progress bars, hover states, dropdowns, skeleton loading
- Avoid animating everything—reserve motion for meaningful feedback

### Spatial Composition
- Use generous padding (16-24px) for breathing room
- Cards: 16px border-radius, subtle border glow on hover
- Buttons: 12px border-radius, lift effect on hover
- Break the grid with off-center decorative gradients

### Backgrounds & Details
- Use subtle radial gradients for ambient backgrounds
- Add shimmer animations to skeleton loaders
- Progress bars with shine effect
- Border glow effects using `box-shadow` and RGBA borders
- Use backdrop-filter blur for overlays and panels

### CSS Variable Patterns
```css
:root {
  --primary: #6366f1;           /* Main brand color */
  --primary-light: #818cf8;     /* Lighter variant */
  --accent: #06b6d4;            /* Secondary accent */
  --bg-main: #0f0f13;           /* Dark mode default */
  --bg-surface: #18181f;        /* Card/surface background */
  --border-subtle: rgba(255,255,255,0.06);
  --border-glow: rgba(99,102,241,0.3);
  --shadow-glow: 0 0 30px rgba(99,102,241,0.15);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Component Examples

**Topic Card**:
- Gradient background (subtle)
- Top border glow on hover
- Bounce transition: `all 0.4s var(--ease-bounce)`
- Monospace meta text

**Status Indicator**:
- Animated pulse ring using `::after` pseudo-element
- Green glow for live, orange bounce for loading

**Toggle Switch**:
- Gradient background when checked
- Bounce thumb animation with `transform`