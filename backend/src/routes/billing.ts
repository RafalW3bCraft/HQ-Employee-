import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  defaultBillingService,
  BillingService,
  CreditExhaustedError,
} from '../modules/billing/index.js';
import { ValidationError } from '../errors/index.js';

const reconcilePurchaseSchema = z.object({
  companyId: z.string().default('00000000-0000-0000-0000-000000000001'),
  appUserId: z.string().default('00000000-0000-0000-0000-000000000001'),
  productId: z.string().min(1, 'productId is required'),
  transactionReceiptId: z.string().min(1, 'transactionReceiptId is required'),
  idempotencyKey: z.string().optional(),
});

const restorePurchasesSchema = z.object({
  companyId: z.string().default('00000000-0000-0000-0000-000000000001'),
  appUserId: z.string().min(1, 'appUserId is required'),
});

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  const billingService = defaultBillingService;

  // 1. Get Credit Offerings Catalog
  fastify.get('/api/billing/offerings', async (request, reply) => {
    const offerings = billingService.getOfferings();
    return reply.status(200).send({
      offerings,
    });
  });

  // 2. Query Authoritative Wallet Balance
  fastify.get('/api/billing/wallet', async (request, reply) => {
    const { companyId = '00000000-0000-0000-0000-000000000001' } = request.query as {
      companyId?: string;
    };
    const wallet = await billingService.getWallet(companyId);
    return reply.status(200).send(wallet);
  });

  // 3. Reconcile In-App Purchase
  fastify.post('/api/billing/reconcile', async (request, reply) => {
    const parse = reconcilePurchaseSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid purchase reconciliation payload', parse.error.format());
    }

    const idempotencyKey =
      parse.data.idempotencyKey ||
      (request.headers['idempotency-key'] as string) ||
      (request.headers['x-idempotency-key'] as string);

    const result = await billingService.reconcilePurchase({
      ...parse.data,
      idempotencyKey,
    });

    return reply.status(200).send(result);
  });

  // 4. Restore Previous Purchases
  fastify.post('/api/billing/restore', async (request, reply) => {
    const parse = restorePurchasesSchema.safeParse(request.body);
    if (!parse.success) {
      throw new ValidationError('Invalid restore request payload', parse.error.format());
    }

    const result = await billingService.restorePurchases(
      parse.data.companyId,
      parse.data.appUserId
    );

    return reply.status(200).send(result);
  });

  // 5. Ingest RevenueCat Server Webhook
  fastify.post('/api/billing/webhook', async (request, reply) => {
    const authHeader = (request.headers['authorization'] || request.headers['x-revenuecat-signature']) as string | undefined;
    const body = (request.body as Record<string, unknown>) || {};

    const result = await billingService.processRevenueCatWebhook(body, authHeader);
    return reply.status(200).send(result);
  });

  // 6. List Transaction Ledger Audit History
  fastify.get('/api/billing/transactions', async (request, reply) => {
    const { companyId = '00000000-0000-0000-0000-000000000001' } = request.query as {
      companyId?: string;
    };
    const transactions = await billingService.listTransactions(companyId);
    return reply.status(200).send({
      transactions,
    });
  });
};
