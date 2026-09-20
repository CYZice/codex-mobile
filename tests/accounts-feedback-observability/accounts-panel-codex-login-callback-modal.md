### Accounts panel Codex login callback modal

#### Feature/Change Name
Accounts settings includes an always-available `Login` button that starts `codex login`, opens the returned authorization URL, shows an in-app callback modal, requests the pasted localhost callback URL from the server, and imports the completed Codex account.

#### Prerequisites/Setup
1. Dev server running (`pnpm run dev`)
2. `codex` CLI available in the server process `PATH`
3. Browser can open the authorization URL returned by the server
4. Light theme and dark theme are available from the appearance switcher

#### Steps
1. Open settings and expand `Accounts`.
2. In light theme, verify `Login` appears even when an active account is already listed.
3. Click `Login`.
4. Verify the Codex CLI/browser login opens only once and an in-app `Complete Codex login` modal appears as a fallback surface.
5. Complete authorization in the browser until it redirects to a `http://localhost:<port>/auth/callback?...` URL.
6. Wait for the account list to refresh automatically after the local callback updates `auth.json`; if the callback cannot reach the Codex CLI, paste that full localhost callback URL into the modal input and click `Complete`.
7. Verify the account list refreshes, the new or refreshed account is active, and normal thread/account data reloads.
8. Click `Login` again, close the modal, and verify the Accounts panel keeps the `Open login URL` fallback link available.
9. Switch to dark theme and repeat steps 1-4, verifying the Login button, link, modal, input, and buttons have readable contrast.

#### Expected Results
- `Login` is available regardless of current login state.
- Starting login runs `codex login` on the server and exposes the generated OpenAI authorization URL without opening a duplicate browser tab.
- Normal localhost callback completion is detected from the updated `auth.json` and finishes automatically; the manual path only accepts local callback URLs and uses the server to request the pasted callback.
- After completion, `$CODEX_HOME/auth.json` is imported into the Accounts list and selected as the active account.
- Completion does not remain stuck waiting for the `codex login` process after the callback has updated `auth.json`.
- Light-theme and dark-theme controls are readable and do not overlap.

#### Rollback/Cleanup
- Remove any test-only account from the Accounts panel if needed.
- If a login is abandoned, restart the dev server to clear any in-memory pending login process.

---
