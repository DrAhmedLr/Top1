# Product usage analytics

The Usage view at `/admin` shows activity from registered accounts that enabled **Share usage counts** under **Profile → Settings**. The reporting windows cover the current UTC day and the previous 6, 29 or 89 days. An active account recorded an event in that window. A returning account recorded events on at least two distinct days within the window.

## Operator access

Apply the usage analytics migration to the intended Supabase project. Find the UUID of the verified drahmedlr@gmail.com account under Authentication → Users. In the SQL editor, replace the placeholder with that UUID and run the first statement to grant access. The second statement revokes it.

```sql
insert into private.usage_operators(user_id)
values ('<registered-account-uuid>'::uuid)
on conflict do nothing;
```

```sql
delete from private.usage_operators
where user_id = '<registered-account-uuid>'::uuid;
```

Sign in and open **My profile → Admin panel**, or visit `/admin` directly. Only a signed-in operator sees the Profile link. The native app opens the panel in the browser, which may require a separate web sign-in. Membership and the active session are checked by PostgreSQL on every report. Keep the `private` schema outside the Supabase Data API’s exposed schemas. The dashboard uses the operator’s ordinary signed-in session. The next report reflects grants, revocations and consent withdrawals.

The **Event collection** control pauses or resumes new usage counters for all accounts. Existing reports, individual consent changes, erasure and exports remain available while collection is paused. A stale operator change prompts a reload.

## Reading the dashboard

For release comparisons, use equally long UTC windows and record the start date, end date and collection cutoff for each. Report distinct active accounts, returning accounts and recorded events. The current UTC day is partial until midnight. [Report query](../supabase/migrations/20261122164343_usage_analytics.sql)

The dashboard includes opted-in staff and test accounts in its totals. Keep usage sharing off on accounts used for internal checks. For a separate authorized analysis of customer use, exclude known staff and test accounts before aggregation. When using dashboard totals that include internal activity, disclose that limitation.

| Measure | What TOP1 counts |
|---|---|
| Opened quick log | Accounts that selected a quick-log action on Home |
| Saved a measurement | Accounts that saved a changed result or its measurement context |
| Saved a goal | Accounts that saved a goal or a training plan with a target, including edits |
| Logged a workout | Accounts that saved a performed workout |
| Screens opened | Screen changes while analytics was enabled, plus the current screen when collection starts |
| Actions taken | Counts of the supported actions recorded during the reporting period |

Feature adoption counts each account once per feature during the period. An account can appear in any combination of rows. Each daily bar counts distinct active accounts. The table below the chart provides the corresponding event counts. Offline actions, guests and accounts that declined analytics are absent, so these reports describe participating accounts.

## Storage and lifecycle

The web and native apps use the same account preference. Each event increments a PostgreSQL counter for the authenticated account, UTC day, enumerated action and optional screen category. For each combination the counter stops at 500 per day. The database enforces the event vocabulary and checks consent on every write. Supabase stores the account reference for consent, export, deletion and distinct-account counts. The Usage view receives aggregate results. Its daily counters store only the enumerated screen and action, date, count and account reference.

Turning off collection removes that account’s counters across devices. Deleting the account also removes the preference, counts and any operator membership. Counters are retained until withdrawal or account deletion. Reports can therefore change when someone withdraws. An account export includes the analytics snapshot at the start of the export. Collection is best effort and does not delay a measurement or workout save.

Run `pnpm test:database` for consent, deletion, operator authorization, expired sessions, reporting periods and distinct-account checks. Run `pnpm test` for the client allowlist and event behavior.

## Customer directory and journeys

The Customers view lists account email and registration date. Open a customer to see actions, visits and active time by screen over 7, 30 or 90 days. Identifiable journeys have a separate Profile → Settings switch. Existing usage-count consent never creates a journey. Reporting begins after the user enables sharing. Turning it off removes the events and IPs. The event collection switch pauses both product analytics streams.

While a consenting account uses the app, the client sends enumerated screen changes and product actions with an optional registry metric ID. Workout and goal save failures record the action category. The payload contains no form contents or test results. Focused screen time stops when the app backgrounds, loses focus or goes a minute without interaction. The collector keeps a short in-memory retry queue, with a per-event ID and consent generation so retransmission or re-enabling sharing cannot duplicate or restore prior events. Offline activity, unlogged actions and background time can leave gaps.

The server reads the connection IP from Vercel’s trusted forwarding header. It can identify a shared network or VPN. Display and export exclude IPs after 30 days and events after 90 days. The hourly database retention job erases expired values. Accounts can export their retained events and IPs. Only the actively signed-in, verified, granted admin can read other accounts’ timelines.

## Goal outcomes

The Goal outcomes view groups shared, prospectively recorded guided goals by metric and unit. The reporting window selects elapsed deadlines. Its on-time user count counts each person once per metric. The attempt counts distinguish reached, missed, unmeasured and superseded goals. Adherence divides logged sessions completed as prescribed by scheduled sessions due through the result. Each forecast stage and model version has separate coverage, average issued probability, actual on-time rate, actual minus predicted percentage points, and mean squared probability error (Brier score). Compare the group that followed the remaining prescription with all measured outcomes. Missing follow-up stays outside both error calculations. Programme sharing controls contributions independently of journey sharing.
