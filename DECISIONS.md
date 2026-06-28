# DECISIONS.md

## Stack Choice
- **Express.js over NestJS**: Extensive production experience with Express + Prisma. Given the 7-hour constraint, using a familiar stack allows more time on financial correctness and edge cases rather than framework boilerplate.
- **TypeScript throughout**: Strict mode enabled. Prisma's generated types make the data layer fully type-safe with zero runtime overhead.
- **Prisma ORM**: Type-safe queries, clean migration system, and first-class PostgreSQL support.

## Data Modeling

### Balance precision
- `Decimal(15, 2)` for all monetary values. Avoids floating-point rounding errors entirely — no IEEE 754 surprises when summing or comparing balances.

### Account versioning
- `version` column on `Account`. Used as a secondary optimistic-locking guard on top of `SELECT FOR UPDATE`. In practice, the `FOR UPDATE` lock prevents concurrent writes, but the version check in `updateMany` means a count of 0 rows updated is surfaced as an explicit 409 error rather than a silent no-op.

## Idempotency

**Approach: client-supplied idempotency key stored with a unique DB constraint.**

1. On every `POST /transfers`, the client provides an `idempotencyKey` (e.g., a UUID generated on the client before the first attempt).
2. Before acquiring any locks, we do a fast `findUnique` on that key. If it already exists, we return the existing transfer immediately — no DB writes, no locks.
3. If the key is new, we proceed into the transaction. The `UNIQUE` constraint on `Transaction.idempotencyKey` is the final safety net: if two requests with the same key slip past the fast-path check simultaneously, only one `INSERT` will succeed; the other catches `PrismaClientKnownRequestError P2002` and falls back to returning the existing row.

**Why a client-supplied key?** The client is the only party that knows whether a specific attempt is a retry. Server-generated keys cannot express "this is a retry of request X" without the client's participation.

## Concurrency

**Approach: Pessimistic locking (`SELECT FOR UPDATE`) with a consistent lock ordering.**

Inside every transfer, we lock both account rows in ascending `id` order before reading balances or writing. This prevents the classic deadlock scenario where transfer A→B and transfer B→A both lock the first account and then wait for each other.

The lock is held for the duration of the Prisma `$transaction`, which atomically:
1. Locks both rows
2. Validates the sender's balance
3. Debits the sender
4. Credits the receiver
5. Inserts the transaction record

If the balance check fails, the transaction rolls back and no money moves. If any write fails, the entire operation rolls back.

**Isolation level: `ReadCommitted`** (PostgreSQL default). Combined with `FOR UPDATE`, this is sufficient — the locked rows cannot be modified by any other transaction until released.

## Transfer Status
`Status` enum has `COMPLETED` and `FAILED`. Currently all persisted transfers are `COMPLETED` (a failed transfer means the DB transaction rolled back and nothing is written). `FAILED` is reserved for future use (e.g., async settlement flows).

## LLM Feedback Loop (Learning)
_To be filled in during later implementation._

## Intentional Scope Omissions
- **Authentication/Authorization**: No JWT or session layer. The assessment focuses on financial correctness and AI integration; adding auth would add 1–2 hours of boilerplate with no signal value.
- **Pagination cursor**: Using offset/limit. Cursor-based pagination is better at scale but unnecessary here.
- **Multi-currency conversion**: All accounts default to USD. Currency field exists for future use.
- **Async categorization queue**: LLM categorization is called synchronously after a transfer. A job queue (BullMQ, etc.) would be more robust in production but adds complexity beyond the scope.
