import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server.js';
import { loadConfig } from '../src/config/index.js';
import {
  defaultBillingService,
  defaultBillingRepository,
  CreditExhaustedError,
} from '../src/modules/billing/index.js';

describe('RevenueCat Monetization & Authoritative Credit Ledger Integration', () => {
  let server: FastifyInstance;
  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const testAppUserId = 'app_user_revenuecat_123';

  before(async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
    });
    server = await createServer(config);
    await server.ready();
  });

  beforeEach(async () => {
    // Reset test wallet
    defaultBillingRepository.clear();
    await defaultBillingRepository.saveWallet({
      id: 'wallet-001',
      companyId: testCompanyId,
      balance: 100,
      reserved: 0,
      available: 100,
      updatedAt: new Date().toISOString(),
    });
  });

  // --------------------------------------------------------------------------
  // TEST 1: Offerings & Product Loading
  // --------------------------------------------------------------------------
  it('1. loads credit packages and offerings without hardcoding store prices', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/billing/offerings',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.offerings));
    assert.strictEqual(body.offerings.length, 3);

    const productIds = body.offerings.map((p: any) => p.id);
    assert.ok(productIds.includes('credits_intro_10'));
    assert.ok(productIds.includes('credits_growth_50'));
    assert.ok(productIds.includes('credits_scale_200'));

    const intro = body.offerings.find((p: any) => p.id === 'credits_intro_10');
    assert.strictEqual(intro.credits, 10);
    assert.ok(intro.description);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Authoritative Wallet Query
  // --------------------------------------------------------------------------
  it('2. returns authoritative wallet balance and reservation calculations', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/billing/wallet?companyId=${testCompanyId}`,
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.balance, 100);
    assert.strictEqual(body.reserved, 0);
    assert.strictEqual(body.available, 100);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Successful Purchase Reconciliation
  // --------------------------------------------------------------------------
  it('3. validates and authoritatively reconciles in-app purchase into ledger', async () => {
    const receiptId = `rc_tx_receipt_${Date.now()}`;

    const res = await server.inject({
      method: 'POST',
      url: '/api/billing/reconcile',
      payload: {
        companyId: testCompanyId,
        appUserId: testAppUserId,
        productId: 'credits_growth_50',
        transactionReceiptId: receiptId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.reconciled, true);
    assert.strictEqual(body.transaction.type, 'PURCHASE');
    assert.strictEqual(body.transaction.amount, 50);

    // Initial 100 + 50 = 150
    assert.strictEqual(body.wallet.balance, 150);
    assert.strictEqual(body.wallet.available, 150);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Idempotent Purchase Processing
  // --------------------------------------------------------------------------
  it('4. guarantees idempotency: duplicate purchase receipt does not duplicate credits', async () => {
    const receiptId = `rc_tx_receipt_idempotent_${Date.now()}`;

    // First reconciliation
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/billing/reconcile',
      payload: {
        companyId: testCompanyId,
        appUserId: testAppUserId,
        productId: 'credits_intro_10',
        transactionReceiptId: receiptId,
      },
    });
    assert.strictEqual(res1.statusCode, 200);
    const body1 = JSON.parse(res1.payload);
    assert.strictEqual(body1.wallet.balance, 110);

    // Duplicate second reconciliation
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/billing/reconcile',
      payload: {
        companyId: testCompanyId,
        appUserId: testAppUserId,
        productId: 'credits_intro_10',
        transactionReceiptId: receiptId,
      },
    });
    assert.strictEqual(res2.statusCode, 200);
    const body2 = JSON.parse(res2.payload);

    // Balance must remain 110, transaction ID must match
    assert.strictEqual(body2.wallet.balance, 110);
    assert.strictEqual(body1.transaction.id, body2.transaction.id);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Rejection of Invalid / Fraudulent Receipts
  // --------------------------------------------------------------------------
  it('5. never grants credits on invalid receipts or unapproved product IDs', async () => {
    // Bad product ID
    const resBadProduct = await server.inject({
      method: 'POST',
      url: '/api/billing/reconcile',
      payload: {
        companyId: testCompanyId,
        appUserId: testAppUserId,
        productId: 'hacked_free_10000_credits',
        transactionReceiptId: 'rc_tx_receipt_123',
      },
    });
    assert.strictEqual(resBadProduct.statusCode, 400);

    // Empty receipt
    const resEmptyReceipt = await server.inject({
      method: 'POST',
      url: '/api/billing/reconcile',
      payload: {
        companyId: testCompanyId,
        appUserId: testAppUserId,
        productId: 'credits_intro_10',
        transactionReceiptId: '',
      },
    });
    assert.strictEqual(resEmptyReceipt.statusCode, 400);

    // Balance remains 100
    const wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 100);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Credit Ledger Lifecycle: RESERVATION, RELEASE, CONSUMPTION
  // --------------------------------------------------------------------------
  it('6. executes full call credit lifecycle: RESERVATION -> RELEASE -> CONSUMPTION', async () => {
    // 1. RESERVATION
    const resTx = await defaultBillingService.recordTransaction(testCompanyId, {
      type: 'RESERVATION',
      amount: 25,
      idempotencyKey: 'res_call_101',
      referenceId: 'call_turn_101',
      description: 'Pre-call reservation',
    });
    assert.strictEqual(resTx.type, 'RESERVATION');

    let wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 100);
    assert.strictEqual(wallet.reserved, 25);
    assert.strictEqual(wallet.available, 75);

    // 2. RELEASE (simulating aborted call)
    await defaultBillingService.recordTransaction(testCompanyId, {
      type: 'RELEASE',
      amount: 25,
      idempotencyKey: 'rel_call_101',
      referenceId: 'call_turn_101',
      description: 'Release reservation on call failure',
    });

    wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 100);
    assert.strictEqual(wallet.reserved, 0);
    assert.strictEqual(wallet.available, 100);

    // 3. RESERVATION + CONSUMPTION (simulating connected call)
    await defaultBillingService.recordTransaction(testCompanyId, {
      type: 'RESERVATION',
      amount: 25,
      idempotencyKey: 'res_call_102',
      referenceId: 'call_turn_102',
    });

    // Call completes, actual usage is 15 credits
    await defaultBillingService.recordTransaction(testCompanyId, {
      type: 'CONSUMPTION',
      amount: 15,
      idempotencyKey: 'con_call_102',
      referenceId: 'call_turn_102',
      description: 'Finalized call duration: 3 mins',
    });

    wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 85); // 100 - 15 = 85
    assert.strictEqual(wallet.reserved, 10); // 25 - 15 = 10 (remaining reservation released)

    // Release remaining reservation
    await defaultBillingService.recordTransaction(testCompanyId, {
      type: 'RELEASE',
      amount: 10,
      idempotencyKey: 'rel_call_102_remainder',
    });

    wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 85);
    assert.strictEqual(wallet.reserved, 0);
    assert.strictEqual(wallet.available, 85);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Insufficient Credits Failure
  // --------------------------------------------------------------------------
  it('7. rejects credit reservation when balance is insufficient with 402', async () => {
    await assert.rejects(
      async () => {
        await defaultBillingService.recordTransaction(testCompanyId, {
          type: 'RESERVATION',
          amount: 500, // available is only 100
          idempotencyKey: 'res_fail_over_budget',
        });
      },
      (err: any) => {
        assert.strictEqual(err.name, 'CreditExhaustedError');
        assert.strictEqual(err.statusCode, 402);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 8: RevenueCat Webhook Ingestion & Refund Processing
  // --------------------------------------------------------------------------
  it('8. processes RevenueCat server webhooks for purchase and refund events', async () => {
    const webhookEventId = `rc_webhook_${Date.now()}`;
    // When REVENUECAT_WEBHOOK_SECRET is set in env (loaded by dotenv), the service requires it.
    // Pass it in the Authorization header so the test works in both dev and CI environments.
    const webhookAuthHeader = process.env.REVENUECAT_WEBHOOK_SECRET
      ? `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`
      : undefined;

    // A. Webhook purchase event
    const purchaseWebhook = {
      event: {
        id: webhookEventId,
        type: 'INITIAL_PURCHASE',
        product_id: 'credits_scale_200',
        app_user_id: testCompanyId,
        company_id: testCompanyId,
      },
    };

    const purchaseRes = await server.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: purchaseWebhook,
      headers: webhookAuthHeader ? { authorization: webhookAuthHeader } : {},
    });

    assert.strictEqual(purchaseRes.statusCode, 200);
    const purchaseBody = JSON.parse(purchaseRes.payload);
    assert.strictEqual(purchaseBody.status, 'success');
    assert.strictEqual(purchaseBody.transaction.type, 'PURCHASE');
    assert.strictEqual(purchaseBody.transaction.amount, 200);

    let wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 300); // 100 + 200

    // Duplicate webhook delivery should be idempotent
    const duplicateRes = await server.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: purchaseWebhook,
      headers: webhookAuthHeader ? { authorization: webhookAuthHeader } : {},
    });
    assert.strictEqual(duplicateRes.statusCode, 200);
    wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 300);

    // B. Webhook refund event
    const refundEventId = `rc_refund_${Date.now()}`;
    const refundWebhook = {
      event: {
        id: refundEventId,
        type: 'REFUND',
        product_id: 'credits_scale_200',
        app_user_id: testCompanyId,
        company_id: testCompanyId,
      },
    };

    const refundRes = await server.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: refundWebhook,
      headers: webhookAuthHeader ? { authorization: webhookAuthHeader } : {},
    });
    assert.strictEqual(refundRes.statusCode, 200);

    wallet = await defaultBillingService.getWallet(testCompanyId);
    assert.strictEqual(wallet.balance, 100); // 300 - 200 = 100
  });

  // --------------------------------------------------------------------------
  // TEST 9: Restore Purchases
  // --------------------------------------------------------------------------
  it('9. restores previous purchase entitlements and returns authoritative wallet', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/billing/restore',
      payload: {
        companyId: testCompanyId,
        appUserId: testAppUserId,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.restored, true);
    assert.ok(Array.isArray(body.activeEntitlements));
    assert.strictEqual(body.wallet.balance, 100);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Transactions Audit History
  // --------------------------------------------------------------------------
  it('10. records and lists immutable credit ledger transactions history', async () => {
    // Add an adjustment
    await defaultBillingService.recordTransaction(testCompanyId, {
      type: 'ADJUSTMENT',
      amount: 15,
      idempotencyKey: `adj_${Date.now()}`,
      description: 'Promotional credit adjustment',
    });

    const res = await server.inject({
      method: 'GET',
      url: `/api/billing/transactions?companyId=${testCompanyId}`,
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.transactions));
    assert.ok(body.transactions.length >= 1);
    const adj = body.transactions.find((t: any) => t.type === 'ADJUSTMENT');
    assert.ok(adj);
    assert.strictEqual(adj.amount, 15);
  });

  // --------------------------------------------------------------------------
  // TEST 11: First-time User Welcome Grant (1000 Credits)
  // --------------------------------------------------------------------------
  it('11. grants exactly 1000 free credits to new user on onboarding with WELCOME_GRANT', async () => {
    const freshCompanyId = '00000000-0000-0000-0000-000000000099';
    const res = await server.inject({
      method: 'POST',
      url: '/api/billing/welcome-grant',
      payload: {
        companyId: freshCompanyId,
        userId: 'user-fresh-01',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.granted, true);
    assert.strictEqual(body.wallet.balance, 1000);
    assert.strictEqual(body.wallet.available, 1000);
    assert.strictEqual(body.transaction.type, 'WELCOME_GRANT');
    assert.strictEqual(body.transaction.amount, 1000);
    assert.strictEqual(body.transaction.idempotencyKey, `welcome_grant_${freshCompanyId}`);
  });

  // --------------------------------------------------------------------------
  // TEST 12: Idempotent Replay Protection (Still 1000 Credits)
  // --------------------------------------------------------------------------
  it('12. prevents duplicate welcome grant on repeated requests, relogins, or reinstall', async () => {
    const freshCompanyId = '00000000-0000-0000-0000-000000000099';
    // Initial grant on registration
    const firstRes = await server.inject({
      method: 'POST',
      url: '/api/billing/welcome-grant',
      payload: {
        companyId: freshCompanyId,
        userId: 'user-fresh-01',
      },
    });
    assert.strictEqual(firstRes.statusCode, 200);
    assert.strictEqual(JSON.parse(firstRes.payload).granted, true);

    // Second request (e.g. user re-logins, re-installs app, or replays request)
    const res = await server.inject({
      method: 'POST',
      url: '/api/billing/welcome-grant',
      payload: {
        companyId: freshCompanyId,
        userId: 'user-fresh-01-relogin',
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.granted, false);
    assert.strictEqual(body.wallet.balance, 1000);
    assert.strictEqual(body.wallet.available, 1000);
  });

  // --------------------------------------------------------------------------
  // TEST 13: Concurrency Protection (Exactly One Grant)
  // --------------------------------------------------------------------------
  it('13. guarantees concurrency safety under parallel welcome grant requests', async () => {
    const concurrentCompanyId = '00000000-0000-0000-0000-000000000088';
    const [res1, res2, res3] = await Promise.all([
      server.inject({
        method: 'POST',
        url: '/api/billing/welcome-grant',
        payload: { companyId: concurrentCompanyId, userId: 'worker-1' },
      }),
      server.inject({
        method: 'POST',
        url: '/api/billing/welcome-grant',
        payload: { companyId: concurrentCompanyId, userId: 'worker-2' },
      }),
      server.inject({
        method: 'POST',
        url: '/api/billing/welcome-grant',
        payload: { companyId: concurrentCompanyId, userId: 'worker-3' },
      }),
    ]);

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res3.statusCode, 200);

    const b1 = JSON.parse(res1.payload);
    const b2 = JSON.parse(res2.payload);
    const b3 = JSON.parse(res3.payload);

    const grantedCount = [b1.granted, b2.granted, b3.granted].filter(Boolean).length;
    assert.strictEqual(grantedCount, 1);

    const finalWallet = await defaultBillingService.getWallet(concurrentCompanyId);
    assert.strictEqual(finalWallet.balance, 1000);
  });

  // --------------------------------------------------------------------------
  // TEST 14: Tenant Isolation on Credit Ledgers
  // --------------------------------------------------------------------------
  it('14. maintains strict cross-tenant credit wallet isolation', async () => {
    const tenantA = '00000000-0000-0000-0000-000000000077';
    const tenantB = '00000000-0000-0000-0000-000000000066';

    await defaultBillingService.grantWelcomeCredits(tenantA);
    const walletA = await defaultBillingService.getWallet(tenantA);
    const walletB = await defaultBillingService.getWallet(tenantB);

    assert.strictEqual(walletA.balance, 1000);
    assert.strictEqual(walletB.balance, 0); // Tenant B has not received grant yet
  });
});

