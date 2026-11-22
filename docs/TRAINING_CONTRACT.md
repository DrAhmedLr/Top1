# Structured training contract · v1

The Program screen stores planned training and actual workouts in the versioned training ledger. The adaptive client refreshes the owner's ledger on focus and retries pending changes on reconnect. Legacy checklist routines keep their own API, records and completion history. Historical checkmarks represent checklist actions only. [Adaptive client](../lib/adaptiveProgramClient.ts) · [Ledger model](../lib/training.ts)

## Documents and stable identities

`lib/training.ts` defines and validates two document kinds. All document, session, exercise and set IDs are UUIDs; reordering preserves IDs. Duplicate IDs within a collection are rejected.

- **Program:** version 1, name, notes, IANA time zone, archive flag and ordered session templates. Each template has a name, optional weekdays (ISO 1=Monday through 7=Sunday) and ordered planned exercises. Empty weekdays means unscheduled; an empty program/session is a valid draft. Exercise labels, equipment and notes are user-owned; no required catalog lookup.
- **Prescription:** exercises contain ordered sets with repetitions, kg load, duration in seconds, distance in metres and optional rest in seconds. A set needs reps/duration/distance. Missing fields remain unknown. Zero external load is valid for bodyweight training. Unit conversion belongs at the form boundary; storage stays canonical.
- **Workout:** name, notes, time zone, absolute start, optional end, state `in_progress`, `completed` or `abandoned`, original planned-session snapshot and actual exercises/sets. Optional origin identifies an exact program revision and session ID. Ad hoc workouts use a null origin. Actual exercises can link a planned exercise, be added, skipped, or substituted with an explanation. Completing a workout requires a performed exercise with a completed set. It never updates a benchmark or TOP%.

Resource ceilings are 32 templates/program, 64 exercises/template/workout and 64 sets/exercise; document payloads are bounded to 256 KiB (server UTF-8 bytes). These are payload safeguards, not coaching recommendations. There is no three-day or 45-minute training rule. Numeric bounds are input sanity limits, not safe exercise prescriptions.

## Plans versus historical snapshots

Programs may be edited or archived. Workouts retain the exact planned-session snapshot and origin revision selected at creation. The database resolves that revision and checks the snapshot against it. Later program edits do not cascade into workouts. `startWorkout` copies the snapshot and begins with no assumed actual sets.

Each accepted change appends an event. It never updates a stored event. Workout origin, snapshot, start instant and time zone remain fixed; in-progress actual work/notes can be revised. After completion or abandonment, edits require a nonblank correction reason of at least three characters. Removal/restoration also creates a revision and requires a reason for an existing workout. Corrections preserve all original data. To correct the wrong start/time-zone/plan identity, recoverably remove the record and create a replacement, explaining the change. Names and dates are not silently inferred from today's profile.

## Concurrency, retries and dates

A command has `version`, `kind`, entity `id`, `requestId`, `expectedRevision`, purge `epoch`, document `data`, `deleted` and `reason`. Create expects revision 0. Every accepted change increments the entity revision and the owner's change counter. Reusing the same request ID and identical payload returns its receipt; changing that payload or using a stale revision returns conflict. Owner transaction locks serialize changes/import/purge.

Instants include an offset and canonicalize to UTC at the API boundary. The original workout IANA zone is retained; calendar display uses that zone, with no UTC-day assumption. Start/end must be valid and no more than five minutes ahead of the receiving clock; end cannot precede start. Daylight-saving repeated times need an explicit offset. Scheduling a future plan is distinct from recording an actual future workout. Weekday templates follow the program time zone.

`training_events` stores the immutable command, revision, sequence, source and server save time. `training_state` stores epoch/counter. Reads page by increasing sequence (250/page), including deleted revisions for synchronization. Consumers derive current entities via `latestTraining`; they must not display every revision as a separate workout. A changed counter during multi-page loading rejects the mixed read. Export checks the counter and epoch again before marking the stream complete.

## Guest and account storage

`lib/trainingStorage.ts` provides an owner-bound repository, separate from React. The guest envelope `top1-training-v1:guest` stores the full ledger. Account caches/outboxes use the same prefix plus account ID. A single persisted pending command is retried with its original request ID after a lost response or reload. Consumers must render pending/error state, invoke retry on reconnection, dispose the old repository immediately on account switch and retain drafts until resolution.

The browser envelope is committed in one localStorage write. Unreadable data is retained and blocks replacement. Repository operations serialize within an instance and use Web Locks across tabs where supported. Refresh rejects concurrent browser changes. This foundation is not an offline/PWA guarantee. Account HTTP responses identify the owner and are checked before use.

Import requires explicit review. Guest revisions are sent in chronological batches of up to 20; batches are transactional. Partial success can be replayed using the original IDs and payloads. Account-created entities cannot be overwritten by import. Source is assigned by the server. Guest records stay in the browser after success/failure for export/review; no destructive auto-merge. No checklist-to-set conversion occurs.

## Ownership, export and deletion

Every operation derives the user from an active registered session. RLS permits only owner SELECT. Anonymous and direct authenticated table writes/truncation are revoked. Public RPC wrappers invoke private functions with fixed search paths, explicit session checks and scoped grants. `/api/training` also enforces origin, owner header and payload size. No service-role client is needed.

The account export includes all training revisions and state alongside separate legacy routine fields. The [export route](../app/api/account/export/route.ts) defines the schema version. Browser export/reset/deletion includes the new guest key, and account deletion clears the account cache and cascades through auth-user foreign keys. Structured-training-only purge requires recent authentication and retains measurements, profile, sharing and legacy routines. All measurement/training purge also clears the structured ledger. Purge increments epoch and counter, rejecting any old offline command or reviewed import. The epoch row survives series deletion to prevent replay resurrection.

## Deployment and recovery

The ledger depends on the [training migration](../supabase/migrations/20261111113722_training_ledger.sql). Match the hosted migration by name and contents before applying a schema change. Preserve training tables, event history and purge epochs across application rollbacks. Follow the [operations runbook](OPERATIONS_RUNBOOK.md).
