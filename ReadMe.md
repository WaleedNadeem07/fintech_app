## Concurrency Testing

A stress test script is included to verify correctness under concurrent requests.

Run:

```bash
node scripts/test-concurrency.mjs <subject-account> <bankroll-account> <sender-b-account>
```

e.g 
node scripts/test-concurrency.mjs e2b8def1-fa0f-41fd-832b-1173316a8911 acc-bob-001 acc-alice-001

The script verifies:

- Concurrent overdraft prevention
- Atomic balance updates
- Correct handling of simultaneous transfers
- Concurrent transfers from independent senders