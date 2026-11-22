# Android and iOS release

TOP1 packages its shared React screens as local assets in Capacitor. The Android and iOS projects use the identifier `fit.top1.app`; registration with the store accounts still needs confirmation. Use the [mobile build instructions](../mobile/README.md) to build and sync the existing projects.

## Client and hosted APIs

The native client stores sessions in OS Keychain/Keystore and uses bearer authentication for the owned HTTPS API. The allowed native origins are `capacitor://localhost` and `https://localhost`. Website requests use their existing session cookies and origin checks. The Vite bundle includes only the public client settings. Confirmation and recovery open the canonical website. After confirmation the user can sign in independently to the app. Automatic return through a verified app link requires signed identifiers, domain association and device testing.

## Release acceptance

1. Confirm the iOS bundle ID, Android application ID and signing accounts. Keep signing keys outside source control.
2. Build and test on a physical iPhone and Android device. Check English, French and Arabic RTL, accessibility, keyboard, rotation, safe areas, back navigation, relaunch, app links and offline recovery.
3. Complete the [real-account and two-device sync procedure](SYNC_AND_ACCOUNT_VERIFICATION.md). Verify native sharing, export cleanup and the web account-deletion entry with the same test account.
4. Review the final archive and its network behavior against the [privacy inventory](MOBILE_PRIVACY_INVENTORY.md). Prepare accurate store descriptions, screenshots, icons, support and privacy URLs, Apple App Privacy and Google Data Safety/health declarations. Verify target SDK and toolchain requirements at upload. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
5. Record the tested build, devices, dates, results and outstanding issues. Run `pnpm check:submission` from `mobile/` after syncing. It compares the native asset copies and checks for the existence of `store-acceptance.json`. Review the actual test evidence separately.
6. Archive and sign the iOS build and Android App Bundle. Test through TestFlight and Play internal testing, meet account-specific testing requirements, then submit for review.

## Verification record

On 15 November 2026, the hosted native API release passed HTTP checks for the two configured origins, missing or invalid credentials and untrusted origins. On 21 November the shared mobile client passed TypeScript, Vite and bundle checks. Physical-device testing, real-account acceptance, native signing, store submission and approval were still open in that record. [21 November audit](AUDIT_2026_11_21.md)
