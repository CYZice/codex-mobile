### Home without promotional card

#### Feature/Change Name
The home route opens directly into project selection and the composer without a recurring Plugins and Apps advertisement.

#### Prerequisites/Setup
1. Dev server running at `http://127.0.0.1:4173`
2. App loaded on the home/new-thread route

#### Steps
1. Open the app on the home route.
2. Verify project selection and the composer are visible without a `Plugins are here` card.
3. Refresh the page and repeat the check.
4. Switch between light and dark themes and repeat the check at desktop and 375x812 mobile viewports.
5. Inspect startup requests and verify `/codex-api/preferences/first-launch-plugins-card` is not requested.

#### Expected Results
- No first-launch or recurring promotional card appears on the home route.
- Refreshing does not add the card back.
- The obsolete card preference endpoint is not called during startup.
- Plugins and Apps remain available through the existing Skills & Apps navigation.

#### Rollback/Cleanup
- No cleanup is required.

---
