# Decisions.md

## Stack Choice
- **Express.js over NestJS**: I have extensive production experience with Express.js + Prisma. Given the 7-hour constraint, using a framework I deeply know allows me to spend more time on financial correctness and edge-cases rather than framework boilerplate.

## Data Modeling
- **Decimal type for balance**: Prevents floating-point precision errors in financial calculations.
- **Idempotency Key**: Implemented as a unique database constraint. This ensures the transfer endpoint is safe against network retries.
- **Pessimistic Locking**: Chose `SELECT FOR UPDATE` over Optimistic Locking for the core transfer, because it guarantees serializable isolation for the debit/credit operation with minimal complexity for a single-wallet transfer.
