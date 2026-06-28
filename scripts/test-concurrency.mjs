#!/usr/bin/env node
/**
 * Concurrency test suite for the fintech transfer API.
 *
 * Usage:
 *   node scripts/test-concurrency.mjs <subject-acct> <bankroll-acct> <sender-b-acct>
 *
 *   subject   — account being stress-tested (Charlie in your case)
 *   bankroll  — absorbs / supplies funds for balance resets (Bob)
 *   sender-b  — second concurrent sender used in Test 3 (Alice)
 *
 * All IDs are visible on the /admin page.
 *
 * Tests:
 *   Test 1 — Overdraft race     : subject reset to $100, then 5× $30 fired simultaneously
 *             Correct: 3 succeed, 2 fail with 422 Insufficient Funds
 *   Test 2 — Single-winner race : subject reset to $100, then 3× $80 fired simultaneously
 *             Correct: 1 succeeds, 2 fail with 422 Insufficient Funds
 *   Test 3 — Non-conflicting    : bankroll→subject and sender-b→subject simultaneously
 *             Correct: both succeed, no deadlock
 */

import { randomUUID } from 'crypto';

// ─── config ────────────────────────────────────────────────────────────────

const API = process.env.API_URL ?? 'http://localhost:3000/api';
const RESET_TARGET = 100; // balance subject is set to before each test

const [, , SUBJECT, BANKROLL, SENDER_B] = process.argv;

if (!SUBJECT || !BANKROLL || !SENDER_B) {
  console.error(
    '\nUsage: node scripts/test-concurrency.mjs <subject-acct> <bankroll-acct> <sender-b-acct>\n',
  );
  process.exit(1);
}

// ─── ANSI helpers ──────────────────────────────────────────────────────────

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m' };

const green  = (s) => `${c.green}${s}${c.reset}`;
const red    = (s) => `${c.red}${s}${c.reset}`;
const yellow = (s) => `${c.yellow}${s}${c.reset}`;
const cyan   = (s) => `${c.cyan}${s}${c.reset}`;
const bold   = (s) => `${c.bold}${s}${c.reset}`;
const dim    = (s) => `${c.dim}${s}${c.reset}`;

const pass = green('✅ PASS');
const fail = red('❌ FAIL');

// ─── API helpers ───────────────────────────────────────────────────────────

async function getBalance(accountId) {
  const res = await fetch(`${API}/accounts/${accountId}`);
  if (!res.ok) throw new Error(`Could not fetch account ${accountId}`);
  const { balance } = await res.json();
  return Math.round(parseFloat(balance) * 100) / 100;
}

async function transfer({ fromAccountId, toAccountId, amount, label }) {
  const start = Date.now();
  const res = await fetch(`${API}/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromAccountId,
      toAccountId,
      amount: Math.round(amount * 100) / 100,
      idempotencyKey: randomUUID(),
      description: label,
    }),
  });
  const ms = Date.now() - start;
  const data = await res.json();
  return { ok: res.ok, status: res.status, data, ms, label };
}

/**
 * Bring `accountId` to exactly `target` dollars by transferring
 * the difference to/from `bankrollId`.
 */
async function resetBalance(accountId, target, bankrollId) {
  const current = await getBalance(accountId);
  const diff = Math.round((current - target) * 100) / 100;

  if (Math.abs(diff) < 0.01) {
    console.log(dim(`  Balance already at $${target.toFixed(2)} — no reset needed`));
    return;
  }

  if (diff > 0) {
    // Too much money: drain excess to bankroll
    console.log(dim(`  Resetting: transferring $${diff.toFixed(2)} from subject → bankroll`));
    const result = await transfer({
      fromAccountId: accountId,
      toAccountId: bankrollId,
      amount: diff,
      label: 'Test reset (drain)',
    });
    if (!result.ok) throw new Error(`Balance reset failed: ${result.data?.error ?? result.status}`);
  } else {
    // Not enough money: top up from bankroll
    const needed = Math.abs(diff);
    const bankrollBalance = await getBalance(bankrollId);
    if (bankrollBalance < needed) {
      throw new Error(
        `Bankroll has insufficient funds for reset — needs $${needed.toFixed(2)}, has $${bankrollBalance.toFixed(2)}`,
      );
    }
    console.log(dim(`  Resetting: transferring $${needed.toFixed(2)} from bankroll → subject`));
    const result = await transfer({
      fromAccountId: bankrollId,
      toAccountId: accountId,
      amount: needed,
      label: 'Test reset (top up)',
    });
    if (!result.ok) throw new Error(`Balance reset failed: ${result.data?.error ?? result.status}`);
  }

  const after = await getBalance(accountId);
  console.log(dim(`  Subject balance confirmed: $${after.toFixed(2)}`));
}

function printResults(results) {
  for (const r of results) {
    const time = dim(`${r.ms}ms`);
    if (r.ok) {
      console.log(`  ${green('✓')} ${r.label} — succeeded ${time}`);
    } else {
      const msg = r.data?.error ?? `HTTP ${r.status}`;
      console.log(`  ${red('✗')} ${r.label} — ${msg} ${time}`);
    }
  }
}

function header(n, title) {
  console.log(`\n${bold(cyan(`── TEST ${n}: ${title} `)).padEnd(72, '─')}`);
}

function balanceLine(label, before, after) {
  const delta = after - before;
  const sign  = delta >= 0 ? green(`+$${delta.toFixed(2)}`) : red(`-$${Math.abs(delta).toFixed(2)}`);
  console.log(`  ${label.padEnd(12)} $${before.toFixed(2)} → $${after.toFixed(2)}  (${sign})`);
}

// ─── TEST 1: Overdraft race ─────────────────────────────────────────────────
// Subject reset to $100. 5× $30 fired simultaneously.
// Only 3 should succeed — the 4th and 5th hit an empty account.

async function test1() {
  header(1, `5 concurrent $30 transfers (subject reset to $${RESET_TARGET})`);

  await resetBalance(SUBJECT, RESET_TARGET, BANKROLL);
  const before = await getBalance(SUBJECT);

  const AMOUNT     = 30;
  const COUNT      = 5;
  const expectedOk = Math.floor(before / AMOUNT); // 3

  console.log(`\n  Subject balance : $${before.toFixed(2)}`);
  console.log(`  Sending         : ${COUNT}× $${AMOUNT} simultaneously`);
  console.log(`  Expected pass   : ${expectedOk}   Expected fail: ${COUNT - expectedOk}`);
  console.log();

  const results = await Promise.all(
    Array.from({ length: COUNT }, (_, i) =>
      transfer({ fromAccountId: SUBJECT, toAccountId: BANKROLL, amount: AMOUNT, label: `Transfer ${i + 1}` }),
    ),
  );

  printResults(results);

  const succeeded = results.filter((r) => r.ok).length;
  const after     = await getBalance(SUBJECT);

  console.log();
  balanceLine('Subject', before, after);

  const expectedBalance = Math.round((before - succeeded * AMOUNT) * 100) / 100;
  const balanceCorrect  = Math.abs(after - expectedBalance) < 0.01;
  const countCorrect    = succeeded === expectedOk;

  console.log();
  console.log(`  Succeeded      : ${succeeded}/${COUNT}  ${countCorrect ? pass : fail}`);
  console.log(`  Final balance  : $${expectedBalance.toFixed(2)} expected, $${after.toFixed(2)} actual  ${balanceCorrect ? pass : fail}`);
}

// ─── TEST 2: Single-winner race ─────────────────────────────────────────────
// Subject reset to $100. 3× $80 fired simultaneously.
// Exactly 1 should succeed; the other 2 arrive after the balance is gone.

async function test2() {
  header(2, `3 concurrent $80 transfers (subject reset to $${RESET_TARGET})`);

  await resetBalance(SUBJECT, RESET_TARGET, BANKROLL);
  const before = await getBalance(SUBJECT);

  const AMOUNT     = 80;
  const COUNT      = 3;
  const expectedOk = Math.floor(before / AMOUNT); // 1

  console.log(`\n  Subject balance : $${before.toFixed(2)}`);
  console.log(`  Sending         : ${COUNT}× $${AMOUNT} simultaneously`);
  console.log(`  Expected pass   : ${expectedOk}   Expected fail: ${COUNT - expectedOk}`);
  console.log();

  const results = await Promise.all(
    Array.from({ length: COUNT }, (_, i) =>
      transfer({ fromAccountId: SUBJECT, toAccountId: BANKROLL, amount: AMOUNT, label: `Transfer ${i + 1}` }),
    ),
  );

  printResults(results);

  const succeeded = results.filter((r) => r.ok).length;
  const after     = await getBalance(SUBJECT);

  console.log();
  balanceLine('Subject', before, after);

  const expectedBalance = Math.round((before - succeeded * AMOUNT) * 100) / 100;
  const balanceCorrect  = Math.abs(after - expectedBalance) < 0.01;
  const countCorrect    = succeeded === expectedOk;

  console.log();
  console.log(`  Succeeded      : ${succeeded}/${COUNT}  ${countCorrect ? pass : fail}`);
  console.log(`  Final balance  : $${expectedBalance.toFixed(2)} expected, $${after.toFixed(2)} actual  ${balanceCorrect ? pass : fail}`);
}

// ─── TEST 3: Non-conflicting concurrent sends ────────────────────────────────
// Bankroll→Subject and SenderB→Subject at the same time.
// Different senders, same receiver — no shared lock contention.
// Both should succeed; subject receives both amounts.

async function test3() {
  header(3, 'Bankroll → Subject and SenderB → Subject simultaneously');

  const BANKROLL_SENDS = 50;
  const SENDER_B_SENDS = 75;

  const [bankrollBefore, senderBBefore, subjectBefore] = await Promise.all([
    getBalance(BANKROLL),
    getBalance(SENDER_B),
    getBalance(SUBJECT),
  ]);

  console.log(`  Bankroll balance: $${bankrollBefore.toFixed(2)}  (sending $${BANKROLL_SENDS})`);
  console.log(`  SenderB balance : $${senderBBefore.toFixed(2)}  (sending $${SENDER_B_SENDS})`);
  console.log(`  Subject balance : $${subjectBefore.toFixed(2)}  (receiving both)`);
  console.log(`  Expected        : both succeed, subject receives $${BANKROLL_SENDS + SENDER_B_SENDS}`);
  console.log();

  if (bankrollBefore < BANKROLL_SENDS) console.log(yellow(`  ⚠  Bankroll has less than $${BANKROLL_SENDS}`));
  if (senderBBefore  < SENDER_B_SENDS) console.log(yellow(`  ⚠  SenderB has less than $${SENDER_B_SENDS}`));

  const results = await Promise.all([
    transfer({ fromAccountId: BANKROLL,  toAccountId: SUBJECT, amount: BANKROLL_SENDS,  label: 'Bankroll → Subject' }),
    transfer({ fromAccountId: SENDER_B,  toAccountId: SUBJECT, amount: SENDER_B_SENDS,  label: 'SenderB  → Subject' }),
  ]);

  printResults(results);

  const [bankrollAfter, senderBAfter, subjectAfter] = await Promise.all([
    getBalance(BANKROLL),
    getBalance(SENDER_B),
    getBalance(SUBJECT),
  ]);

  console.log();
  balanceLine('Bankroll', bankrollBefore, bankrollAfter);
  balanceLine('SenderB',  senderBBefore,  senderBAfter);
  balanceLine('Subject',  subjectBefore,  subjectAfter);

  const succeeded     = results.filter((r) => r.ok).length;
  const expectedDelta = results.reduce(
    (sum, r, i) => (r.ok ? sum + [BANKROLL_SENDS, SENDER_B_SENDS][i] : sum), 0,
  );
  const actualDelta  = Math.round((subjectAfter - subjectBefore) * 100) / 100;
  const deltaCorrect = Math.abs(actualDelta - expectedDelta) < 0.01;

  console.log();
  console.log(`  Succeeded      : ${succeeded}/${2}  ${succeeded === 2 ? pass : yellow('⚠  check balances above')}`);
  console.log(`  Subject received: $${actualDelta.toFixed(2)} (expected $${expectedDelta.toFixed(2)})  ${deltaCorrect ? pass : fail}`);
}

// ─── main ──────────────────────────────────────────────────────────────────

console.log(bold('\n╔══════════════════════════════════════╗'));
console.log(bold('║   Fintech API Concurrency Test Suite  ║'));
console.log(bold('╚══════════════════════════════════════╝'));
console.log(dim(`  API      : ${API}`));
console.log(dim(`  Subject  : ${SUBJECT}`));
console.log(dim(`  Bankroll : ${BANKROLL}`));
console.log(dim(`  SenderB  : ${SENDER_B}`));
console.log(dim(`  Each test resets subject balance to $${RESET_TARGET} before running`));

try {
  await test1();
  await test2();
  await test3();
} catch (err) {
  console.error(red(`\nFatal: ${err.message}`));
  process.exit(1);
}

console.log(`\n${dim('─'.repeat(50))}\n`);
