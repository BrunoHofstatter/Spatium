# Enable private Spatium sync

Project: `pfomcrdvmrrufutppuwl`. The browser project URL and publishable key are already configured in `src/sync/supabase.ts`. Only the publishable key belongs in the deployed app; the database password, service-role key and Supabase management token do not.

1. In the Supabase project, disable **Allow new users to sign up** in Authentication's general settings. Keep the email/password sign-in provider enabled.
2. Under **Authentication → Users**, use **Add user → Create new user** to create your own email/password login. Confirm the email in the creation dialog. This is your Spatium login, separate from your dashboard login. Create exactly one user before the initial SQL setup.
3. Open **SQL Editor**, paste the complete contents of [setup.sql](setup.sql), and run it. The script chooses that single Auth user as the owner, creates the document table and version-checked functions, and denies other accounts and anonymous callers. It can be rerun safely. If the project already contains multiple users, configure the intended owner explicitly in `private.spatium_owner` before rerunning rather than deleting users.
4. Publish the updated app through the existing GitHub Pages workflow.
5. Open **Settings → Cloud sync** on the device holding the work you want to start with. Sign in and choose **Start with this device**. Wait for **Saved to cloud**.
6. Sign in with the same login on the other device. A fresh device pulls the cloud copy. If both devices already contain work, choose the starting copy explicitly.

Cloud writes replace the complete document, with the server checking the previous revision atomically. Automatic refresh runs when returning to the app and periodically while visible. Polling normally downloads only a revision number. Board scroll and focused-area navigation stay device-local. Changes are saved locally before upload; offline changes survive reload and resume when connectivity returns.

When both copies change, sync pauses for a whole-copy choice. Before replacing anything, the current device and cloud copies are retained in **Recent recovery copies** on that device (up to twelve recent snapshots). They can be restored locally and reviewed before another explicit cloud choice. There is no automatic merge or cross-account migration. Signing out pauses cloud sync and retains local work.

If the app reports that cloud setup is missing, finish steps 1–3 and select **Sync now**. If it reports the wrong owner, verify the Auth user ID against `private.spatium_owner`. Recover/reset your app password through the Supabase dashboard if needed; public signup and email-based password recovery are not part of this single-user setup.

## Upgrade an existing installation to the grid release

Rerun the complete updated setup.sql before publishing format-4 clients. The script is idempotent: it retains the owner and live document, copies the existing format-1/2/3 document once into private.spatium_grid_backup, and makes spatium_save accept only format 4. The backup is private, never rotated out, and is not exposed through the public Data API. The first new client save converts the live document; the SQL itself does not erase or replace its contents.

The new client also pins the original local/cloud documents under dedicated IndexedDB keys before replacing them. Migration uses existing IDs and deterministic order so unchanged phone and PC copies do not create false conflicts. Old cached clients cannot save format 3 after the SQL update; close/reopen old PWA sessions and use the new build on both devices.

If the app says cloud sync needs the grid update, local saving remains usable. Run setup.sql with project admin access, then Sync now. Browser login/publishable keys cannot perform this administrative update. Never put a management token or database password in the repository or the deployed app.

## Checks

`npm test` includes a PostgreSQL-backed test of owner isolation, denied anonymous access, denied direct writes, stale-revision rejection and idempotent setup. Browser sync tests use mocked Auth/Data API responses and independent browser storage to exercise the complete app flow. Hosted acceptance still requires applying the SQL to the real project and creating the login.
