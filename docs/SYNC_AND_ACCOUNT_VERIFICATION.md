# Sync and account verification

The personal workspace API stores a single private JSON document containing `goal` and training/profile `context`. GET authenticates the registered account and active session; POST additionally enforces the request origin and owner header. `save_personal_workspace` compares the supplied revision atomically and returns PT409 on a stale create/update. The database enforces ownership and revision checks. Adaptive training plans and logged workouts use their own [training ledger](TRAINING_CONTRACT.md).

The client now refreshes on focus, visibility resume, reconnect, and every 15 seconds while visible. Reads and writes are serialized. Account changes detach the old controller. Submitted drafts retain their original revision in owner-scoped local storage through failures, refresh, and reload. Conflict review loads the newest document; explicit retry overlays only the edited goal or context section. Another concurrent change produces another conflict. Raw unfinished form inputs are stored separately with their starting revision, so refresh/navigation cannot silently reset them. Browser export/reset includes guest raw drafts; workspace export includes owner raw drafts.

Focused controller and API tests cover two devices, deletion, stale create/update, repeated conflicts, offline/reload recovery, storage failure, overlapping refresh/save, invalid responses, wrong account, revoked/anonymous access, origin checks, and visible polling. An isolated browser harness exercised two rendered editors, unfinished preferences during another device save, stale-save review/retry, and goal propagation. This harness uses a simulated transport, not hosted login credentials.

## Email confirmation

The confirmation page presents an explicit POST action before consuming a token. Token-hash verification also works when the recipient opens the link in another browser. The [confirmation template](../supabase/templates/confirmation.html) carries the return path through an encoded `next` parameter. Verify the template and callback allowlist against the hosted settings when checking email delivery.

## Real-account acceptance

Use a dedicated authorized account with synthetic measurements and a mailbox the tester controls. Record the build, platforms and outcome of each step.

1. Register, receive the confirmation email and confirm in a second browser or device. Check resend after expiry and the intended return destination.
2. Sign in independently on both devices. Change goal or preferences on one device and verify the other receives the update.
3. Edit the same section on both devices. Review the conflict and explicitly retry the intended edit. Verify the surviving values after reload and offline/reconnect.
4. Verify password recovery, sign-out isolation, export and deletion using the dedicated test account. Include native sharing, cache cleanup and reauthentication for a mobile release.

## Dated evidence

On 15 November 2026 the hosted settings showed signup, email confirmation and custom SMTP enabled. The sender domain had been verified. Confirmation with a synthetic token displayed the POST form, and 12 public HTTP checks passed on deployment `dpl_5weTDM9tXF8ojE7Bm1f7YUd22Lhd`. The final hosted template text, real-mailbox delivery and real-account two-device walkthrough still needed verification. Simulated client and API tests covered competing drafts, retries and session isolation. See the [21 November audit](AUDIT_2026_11_21.md) for subsequent release evidence.
