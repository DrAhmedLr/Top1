# TOP1 mobile

The iOS and Android projects package the shared React screens with Capacitor. Both projects are included in this repository.

## Build and check the client

1. From the repository root, install Node.js 24, the version of pnpm specified in `package.json`, and dependencies with `pnpm install --frozen-lockfile`.
2. Supply the public client settings `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in a local root `.env.local`. The mobile bundle uses the allowlist in [vite.config.ts](vite.config.ts).
3. Change into `mobile/` and run `pnpm install --frozen-lockfile`, then `pnpm prepare:native`. The second command restores missing default app icons, splash images and the Gradle wrapper JAR from the pinned Capacitor CLI package on disk. Existing artwork is preserved. The Capacitor templates ship under MIT and the Gradle wrapper includes its Apache 2.0 license.
4. For shared-screen or client changes, run `pnpm check:client`. It type-checks, builds once and checks the web assets. To copy that same build into the native projects, run `pnpm exec cap sync` from this folder.
5. On the native build machine run `pnpm doctor` to check toolchains. With the appropriate SDK installed, open the relevant project using `pnpm open:ios` or `pnpm open:android`. Follow the [release and device acceptance guide](../docs/MOBILE_RELEASE.md).

To version custom app icons or splash artwork, replace the corresponding file, remove its exact entry from [.gitignore](.gitignore) and commit both changes. Future checkouts will preserve that artwork when preparing the native projects.

The client bundles local assets. No remote `server.url` is used. Native auth sessions use encrypted OS storage; browser-preview sessions are memory-only. The website APIs support native bearer auth from `capacitor://localhost` and `https://localhost`. Browser previews on arbitrary localhost ports are intended for guest UI work; they are not authorized production API origins.

Email confirmation and password recovery use the canonical website. Confirm email in the browser, then sign in independently in the app. Automatic signed app-link return is still pending. No authentication token or password should be copied into chat or committed to source.

After syncing, `pnpm check:submission` compares each generated web asset with the copies in both native projects, checks packaging settings and looks for `store-acceptance.json`. The release reviewer must verify the contents of the device and store acceptance record.
