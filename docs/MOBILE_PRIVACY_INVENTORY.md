# Native privacy inventory — pending device and store review

This is an implementation inventory for completing store forms, not a submitted privacy declaration.

| Category | Current implementation | Required verification |
|---|---|---|
| Account identity | Supabase email/password; native refresh session stored through encrypted Keychain/Keystore storage | Registration, confirmation, recovery, refresh, logout and revoked-session rejection on physical devices |
| Fitness/profile data | User-entered measurements, demographics, optional routine/limitations, goals and context; account data stored in owner-protected Supabase rows | Final Apple App Privacy and Google Data Safety/health classifications; compare actual network traffic with this inventory |
| Customer journeys | With separate account opt-in, identifiable screens, actions, test names, focused time and connection IP are available to the admin. Events expire after 90 days and IPs after 30. Withdrawal deletes the records. | Validate network traffic and IP, product-interaction and fitness-related disclosures before native store submission. |
| Local drafts | Existing owner-scoped local drafts and guest data in the WebView; no automatic upload of guest workspace data | Offline recovery, account switching, account/guest deletion; OS backup configuration |
| Forecast learning | Program compares saved goals, comparable tests and logged workouts. Accounts retain their private forecast history. A separate opt-in permits future measured outcomes and plan adherence to contribute to aggregate estimates. Withdrawal removes previous contributions. | Check the localized consent control, withdrawal and exported forecast history on both devices. |
| Product analytics | Signed-in users may opt in to account-linked daily screen and action counts in Supabase. Turning off the preference deletes these counts. The operator dashboard shows aggregates. Home requests coarse country formatting from the TOP1 server. | Verify consent, withdrawal and network traffic on both platforms. Review product-interaction, account ID and approximate-location disclosures for the signed release. |
| Public sharing | Existing opt-in profile sharing with explicit fields; native links use https://top1.fit | Review displayed fields and revocation on device |
| Exports | User-triggered native share sheet receives a temporary app-cache file; temporary file removed after sharing | File contents, share cancellation, cleanup and recipient behavior on iOS/Android |
| Sensitive permissions | No HealthKit, Health Connect, location, camera, contacts, microphone or notification permissions added | Inspect final archive/merged Android manifest, including dependencies |
| Deletion | Existing in-app account deletion with password reauthentication and session revocation; raw workspace form drafts included in local cleanup | Real test-account deletion, provider backups disclosure, web deletion-entry URL and review access |

Native iOS required-reason manifest includes Filesystem file-timestamp access with C617.1 for user-requested exports. Android automatic backup is disabled. These settings do not replace the store data-collection forms or physical-device verification. Privacy manifest resource membership and plist syntax were checked; native binaries remain unbuilt.
