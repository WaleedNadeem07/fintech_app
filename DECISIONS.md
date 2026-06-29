## Stack

I went with **Express.js + TypeScript + Prisma + PostgreSQL** on the backend and **Next.js 15 + React Query** on the frontend.

The original plan called for NestJS, but I switched to Express early on. I've shipped production Express services before and I know exactly where the sharp edges are. Given the time constraint, I didn't want to spend an hour setting up NestJS modules and decorators when that time was better spent on the financial correctness and AI pieces — which are actually the hard parts of this assessment.

I started with TypeScript in strict mode, but relaxed `strictPropertyInitialization` (and the top-level `strict` flag) during deployment to unblock the Railway build after hitting friction with Prisma's generated types in the Express route handlers. It was a deliberate time-vs-purity tradeoff — the core financial logic still uses explicit null checks and Prisma's fully type-safe queries, so the risk surface of disabling strict mode is limited to the route layer. In a production codebase I'd resolve each individual error rather than toggling the flag. Prisma's generated types mean the entire data layer is fully type-safe with no hand-written interfaces needed for DB models.

For the LLM provider I originally planned to use Google Gemini, but hit rate limit issues on the free tier immediately. I then tried `llama3-70b-8192` on Groq, which was decommissioned in August 2025. I settled on **Groq with `qwen/qwen3.6-27b`**, it's on the free tier, has very low latency for short classification prompts, and handles the reasoning-tag stripping I had to add (the model wraps responses in `<think>...</think>` blocks).

---

## Database Schema

I designed the schema around five tables. Here's the reasoning behind each one.

### `User`
Simple, just `id`, `email`, `name`, and timestamps. I used UUIDs everywhere rather than auto-increment integers because they're safe to expose in URLs without leaking row counts.

### `Account`
A user can have one or more accounts. The two decisions worth explaining here:

**Balance as `Decimal(15, 2)` not `Float`:** I made this call immediately and it's non-negotiable. Floating-point arithmetic in financial systems causes rounding errors that compound silently. `Decimal(15, 2)` gives exact precision up to 999 trillion, which is more than enough, and PostgreSQL's native `NUMERIC` type guarantees correctness.

**`version` column for optimistic locking:** Every time an account's balance changes, I increment `version`. I use this as a secondary check on top of the pessimistic `FOR UPDATE` lock , more on this in the concurrency section. The column exists so that if my locking logic ever had a gap, the version mismatch would surface a 409 rather than silently corrupting a balance.

### `Transaction`
I called this `Transaction` rather than `Transfer` in the database because Prisma and PostgreSQL both treat `transaction` as a reserved concept, and having a model literally named `Transaction` in Prisma would clash with `prisma.$transaction(...)` in the service layer. The API still calls them "transfers" from the client's perspective.

**`description` field:** I added this specifically for the LLM categorization step. Without some kind of memo or description, the AI has nothing meaningful to classify. The field is optional — a transfer still works without one, it just gets categorized as "Other".

**`idempotencyKey` with a `@unique` constraint:** This is the core of the idempotency implementation. Every transfer must include a client-supplied key, and the DB enforces uniqueness at the constraint level. More on this below.

**`status` enum (`COMPLETED` / `FAILED`):** Right now every persisted transfer is `COMPLETED` because a failed transfer means the DB transaction rolled back and nothing gets written. I added `FAILED` anyway because in a real async settlement flow you'd want to persist failure records, and removing an enum variant later is painful.

### `TransactionCategory`
I put categorization data in a separate table rather than columns on `Transaction` for one reason: not every transaction is categorized yet when it's first written. The LLM call happens asynchronously after the transfer commits. If I'd put `category` directly on `Transaction`, I'd either have a nullable column with no clear meaning during the window before categorization, or I'd have to block the transfer response on the LLM call. A separate `TransactionCategory` row either exists or doesn't, which is cleaner.

The `isUserCorrected` and `correctedCategory` columns live here too. When the user overrides the AI, I set `isUserCorrected = true` and write the new value into `correctedCategory`. The auto-categorizer checks `isUserCorrected` before touching a record — once a human has corrected something, I don't overwrite it.

### `CategoryFeedback`
This table is what makes the learning loop work. Every time a user corrects a category, I write a row here capturing the transaction description, what the AI guessed, and what the user changed it to. When the next transaction comes in, I query this table to pull up to 10 recent corrections and inject them into the LLM prompt as few-shot examples.

I deliberately kept this separate from `TransactionCategory`. The feedback table is an append-only log of corrections — it's for prompt construction, not for displaying state. `TransactionCategory` is the current truth about a transaction's category.

---

## API Endpoints

I kept the endpoint surface small and organized around resources:
```
GET  /api/health

POST /api/users                        — create user with initial account + balance
GET  /api/users                        — list all users (used by admin panel)
GET  /api/users/:id                    — get user with their accounts
GET  /api/users/:id/insights           — spending insights for the user

GET  /api/accounts/:id                 — get account details and balance
GET  /api/accounts/:id/transactions    — paginated transaction history

POST /api/transfers                    — execute a transfer (idempotent)
GET  /api/transfers/:id                — get a specific transfer by ID

POST /api/transactions/:id/categorize  — manually trigger LLM categorization
PUT  /api/transactions/:id/category    — user correction for a category
```
A few decisions here worth calling out:

**`POST /api/users` creates an account automatically.** In a real system, account creation would be a separate step. I merged them for the demo because having to make two API calls to set up a user is unnecessary friction and the assessment doesn't require multi-account scenarios.

**Insights live under `/users/:id/insights`, not `/accounts/:id/insights`.** Insights are user-scoped, they aggregate across all of a user's accounts and consider the user's personal correction history. Attaching them to an account would be misleading.

**`POST /api/transactions/:id/categorize` exists as a manual trigger.** Auto-categorization fires after every transfer, but I added this endpoint so the admin or a test can force a re-categorization without creating a new transfer. Useful for testing.

**No `DELETE` or `PATCH` endpoints on transactions.** Transfers are immutable once written. If you need to reverse one, you'd do a new transfer in the opposite direction, that's the standard in financial systems.

---

## Idempotency

I went with **client-supplied idempotency keys** stored with a unique database constraint.

The flow is:

1. The client generates a UUID before making the request (in the frontend, this auto-generates and displays in the transfer form so the user can see it).
2. On `POST /api/transfers`, the service first does a fast `findUnique` on that key. If it already exists, it returns the existing transfer immediately, no locks, no writes.
3. If the key is new, the transfer proceeds. The `@unique` constraint on `Transaction.idempotencyKey` is the last line of defense: if two requests with the same key somehow both pass the fast-path check simultaneously, only one `INSERT` will succeed. The other will hit a Prisma `P2002` unique constraint error, which I catch and handle by falling back to returning the existing row.

**Why client-supplied rather than server-generated?** The server has no way to know if an incoming request is a retry or a new request without the client's participation. A client-generated UUID given to the first attempt travels with every retry of that same attempt, that's the only reliable signal.

I intentionally don't expire idempotency keys. In production you'd want a TTL (maybe 24 hours), but for this scope it's unnecessary complexity.

---

## Concurrency

I used **pessimistic row-level locking (`SELECT FOR UPDATE`)** combined with the **optimistic version check** described above.

Inside every transfer, before reading any balances, I lock both account rows. I always lock them in **ascending `id` order**, regardless of which is the sender and which is the receiver. This is critical, without a consistent ordering, two concurrent transfers between accounts A and B in opposite directions will each grab the first lock and then deadlock waiting for the second.

The entire sequence inside the Prisma `$transaction` is:

1. Lock both rows in ID order with `FOR UPDATE`
2. Check the sender's balance, fail with 422 if insufficient
3. Debit the sender, incrementing `version`
4. Verify the debit actually updated 1 row (the `updateMany` count check, if it's 0, the version didn't match, meaning a concurrent write won the race, and I throw a 409)
5. Credit the receiver, incrementing `version`
6. Insert the `Transaction` record

If anything fails, Prisma rolls back the entire transaction atomically. The database isolation level is `ReadCommitted` (PostgreSQL default), which combined with `FOR UPDATE` is sufficient — locked rows cannot be read in an uncommitted state by any other transaction.

I wrote a stress-test script at `scripts/test-concurrency.mjs` to verify this. It fires simultaneous transfers using `Promise.all` and checks that no account ever goes negative and that the final balances add up correctly.

---

## LLM Categorization

**Trigger:** I fire categorization via `setImmediate` after a successful transfer commits. This means the transfer API response is never blocked by the LLM call, the client gets its response in milliseconds and the category shows up a second or two later. The frontend polls every 2 seconds while any transaction is missing a category.

**Prompt construction:** I pull the last 10 `CategoryFeedback` entries for the user and prepend them as labelled examples. The prompt looks roughly like:

```
Here are corrections this user has made previously — follow their preferences:
  - "Uber ride to airport" → Transport
  - "McDonald's order" → Food & Dining

Based on these corrections, categorize this new transaction:
Description: "Grab ride downtown"
Reply with ONLY the category name.
```

**Why few-shot instead of fine-tuning?** Fine-tuning requires a training pipeline, a labeled dataset, and redeployment. Few-shot is immediate, every correction the user makes improves the next request with zero infrastructure. For the transaction volumes of a personal wallet, this is entirely sufficient and demonstrably correct.

**Response normalization:** The `qwen` model sometimes wraps its answers in `<think>...</think>` reasoning blocks. I strip those before checking the category. I try an exact match first, then a case-insensitive substring match, then a scan of the raw response for any valid category name. If none of those match, I fall back to `"Other"`. The transfer is never blocked or failed because of a categorization issue.

**Valid categories:** Food & Dining, Transport, Bills, Shopping, Entertainment, Salary, Transfers, Other.

---

## Spending Insights

The insights endpoint (`GET /api/users/:id/insights`) is **pure SQL — no LLM involved**. I compute:

- Total spent in the last 30 days, grouped by category
- The same for the 30–60 day window before that, to calculate a month-over-month trend
- Unusual spending: categories where this month's total exceeds 2× the per-category average

When I aggregate categories, I use `COALESCE(correctedCategory, category)` so user corrections are reflected in the insights. If a user changed "Transfers" to "Bills" for their rent payment, it should show up under Bills in the breakdown, not Transfers.

I didn't use an LLM for insights because SQL aggregation is the right tool here, it's fast, deterministic, and doesn't cost API credits. An LLM summary on top of this data could be a nice addition but wasn't necessary for the assessment.

---

## Frontend

I built the frontend in **Next.js 15 with the App Router** and **React Query** for data fetching. The UI is functional over polished, it covers every required flow but I didn't spend time on animations or pixel-perfect design.

**React Query instead of plain `fetch` + `useState`:** React Query gave me automatic refetching, loading/error states, and cache invalidation for free. The "poll every 2 seconds until all transactions have a category" behavior was a one-liner with `refetchInterval`.

**Idempotency key visible in the UI:** The transfer form shows the auto-generated UUID and lets the user regenerate it or edit it manually. This makes the idempotency behavior visible and testable rather than hidden behind the scenes.

**Admin panel at `/admin`:** I added this because the assessment involves creating multiple users and testing transfers between them. Having a table of all users with copyable IDs saves a lot of manual `curl` calls during testing.

---

## Intentional Omissions

**Authentication:** No JWT, no sessions. The assessment focuses on financial correctness and AI integration. Adding auth would take 1–2 hours and produce no signal relevant to what's being evaluated.

**Cursor-based pagination:** I used offset/limit pagination. Cursor-based is better at scale but overkill here.

**Multi-currency conversion:** The `currency` field exists on `Account` but I don't implement conversion. All accounts default to USD.

**Async job queue:** LLM categorization fires via `setImmediate` rather than a proper job queue like BullMQ. For production I'd want retries, dead-letter queues, and visibility into failures. For this scope, `setImmediate` is fine, if Groq is down, the categorization just doesn't happen and the transaction stays uncategorized.

**Real-time updates:** The frontend polls. WebSockets or Server-Sent Events would be cleaner, but polling with React Query's `refetchInterval` achieves the same result with far less complexity.