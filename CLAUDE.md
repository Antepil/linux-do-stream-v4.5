# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Linux.do Stream Extension - A Chrome side panel extension for browsing Linux.do community topics. Built with Manifest V3, Apple HIG design style, and full theme support (light/dark/system).

## Development Commands

No build process required. To test changes:

1. Open Chrome at `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Make edits to any file (sidepanel.js, styles.css, etc.)
5. Click the extension's refresh button or reload from `chrome://extensions/`

## Architecture

### Extension Components

- **manifest.json** - Extension configuration, permissions, and entry points
- **sidepanel.js** - Main UI controller and state management (618 lines)
- **sidepanel.html** - Side panel DOM structure with settings panel
- **styles.css** - Apple HIG design system using CSS variables
- **background.js** - Service worker for API fetching and notifications
- **content.js** - Page script for extracting data from linux.do

### Key Data Flow

1. Side panel loads → reads config from `chrome.storage.local`
2. `loadTopics()` → sends message to background service worker
3. Background `fetchWithRetry()` → calls `linux.do/latest.json` API
4. Response includes `topics` and `users` arrays
5. `window.allUsersMap` created for trust level lookups
6. `renderTopics()` filters, sorts, and renders cards

### Configuration System

**Storage keys**: `config` (settings), `readTopicIds`, `userSettings` (UI state)

**DEFAULT_CONFIG** (sidepanel.js:35-50):
- `pollingInterval` - Auto-refresh interval in seconds
- `blockCategories` - Array of category slugs to filter
- `keywordBlacklist` - Comma-separated filter strings
- `themeMode` - 'light', 'dark', or 'system'
- `clickBehavior` - 'newTab' or 'background'
- `syncReadStatus` - Sync read status with site

### Category Mapping

CATEGORIES array (sidepanel.js:61-73) maps forum IDs to display names and slugs:
```javascript
{ id: 4, name: '开发调优', slug: 'develop' }
{ id: 98, name: '国产替代', slug: 'domestic' }
// etc.
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

CSS variables in `:root` and `[data-theme="dark"]` (styles.css:3-44):
- `--bg-main`, `--bg-surface`, `--text-primary`, etc.
- System theme uses `@media (prefers-color-scheme: dark)`

### Important Implementation Notes

- All API calls must go through `background.js` service worker (CORS restriction)
- Trust level data comes from the `users` array in the API response, not directly on topics
- Use `window.allUsersMap` for O(1) user data lookups
- Message passing pattern: sidepanel → background via `chrome.runtime.sendMessage`
- Animations use `requestAnimationFrame` for 60FPS performance
- Progress bar updates every second based on `pollingInterval` setting

## Git Authentication Status
- **Authentication:** The local environment is already authenticated with GitHub via system credentials. 
- **Action:** You can run `git push` directly without asking for credentials or tokens.
- **Security:** NEVER ask for or attempt to store GitHub tokens in any file.