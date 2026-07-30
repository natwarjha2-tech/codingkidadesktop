# Frontend Module Structure

This folder contains the CodingKida Desktop app's frontend code, split into feature-based modules.

## Load Order (defined in `../index.html`)

Scripts must load in this exact order (dependencies first):

1. `utils.js` — Shared utilities (sanitize, getCurrentUserId, auth helpers)
2. `cache.js` — Persistent 7-day cache system (userId-specific)
3. `attendance.js` — Session time tracking (localStorage)
4. `navigation.js` — Page routing + universal back navigation
5. `auth.js` — Login, signup, loadStudentData, dashboard data
6. `profile.js` — Profile editing, logout, password change
7. `courses.js` — Course listing, filtering, detail, enrollment
8. `video-player.js` — Video playback, HLS quality, lesson context
9. `lesson-tabs.js` — Quiz, Exercise, Notes, Streak tab renderers
10. `ai-chat.js` — AI Mentor (lesson + dashboard)
11. `downloads.js` — Watchlist + offline downloads (Electron IPC)
12. `pdf-viewer.js` — In-app PDF canvas viewer
13. `pages.js` — All profile sub-pages (orders, mall, report, etc.)
14. `coins.js` — Coins system, leaderboard, topbar dropdown
15. `init.js` — App bootstrap, keyboard shortcuts, event listeners

## Important Notes

- All functions are **global scope** (vanilla JS, no bundler)
- Load order matters — earlier files cannot call functions from later files at parse time
- `init.js` must always be **LAST** (bootstraps the app)
- External dependencies (`config.js`, `services/api.js`, `mockData.js`) load before this folder
