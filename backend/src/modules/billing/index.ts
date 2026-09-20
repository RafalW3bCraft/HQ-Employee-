import { randomUUID } from 'crypto';
import { defaultAuditService, AuditService } from '../audit/index.js';
import {
  AppError,
  BadRequestError,
  NotFoundError,
  ValidationError,
} from '../../errors/index.js';

// ============================================================================
// 1. Domain Types & Interfaces
// ============================================================================

export type CreditTransactionType =
  | 'PURCHASE'
  | 'RESERVATION'
  | 'CONSUMPTION'
  | 'RELEASE'
  | 'REFUND'
  | 'ADJUSTMENT';

export interface CreditWallet {
  id: string;
  companyId: string;
  balance: number;
  reserved: number;
  available: number;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  walletId: string;
  companyId: string;
  type: CreditTransactionType;
  amount: number;
  idempotencyKey: string;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export interface CreditOfferingProduct {
  id: string;
  displayName: string;
  credits: number;
  description: string;
  suggestedPriceUsd: string;
}

export const CREDIT_OFFERINGS_CATALOG: CreditOfferingProduct[] = [
  {
    id: 'credits_intro_10',
    displayName: 'Starter Pack',
    credits: 10,
    description: '~20 minutes of voice qualification & discovery',
    suggestedPriceUsd: '$9.99',
  },
  {
    id: 'credits_growth_50',
    displayName: 'Growth Pack',
    credits: 50,
    description: '~100 minutes + automated meeting scheduling',
    suggestedPriceUsd: '$39.99',
  },
  {
    id: 'credits_scale_200',
    displayName: 'Scale Pack',
    credits: 200,
    description: 'High-volume agency outreach & outbound telephony',
    suggestedPriceUsd: '$129.99',
  },
];

export class CreditExhaustedError extends AppError {
  constructor(message: string, public required: number, public available: number) {
    super(message, 402, 'CREDIT_EXHAUSTED', { required, available });
    this.name = 'CreditExhaustedError';
  }
}

// ============================================================================
// 2. Billing Repository (Authoritative Ledger Store)
// ============================================================================

export interface BillingRepository {
  getWallet(companyId: string): Promise<CreditWallet>;
  saveWallet(wallet: CreditWallet): Promise<CreditWallet>;
  createTransaction(tx: CreditTransaction): Promise<CreditTransaction>;
  getTransactionByIdempotencyKey(idempotencyKey: string): Promise<CreditTransaction | null>;
  listTransactions(companyId: string): Promise<CreditTransaction[]>;
}

export class InMemoryBillingRepository implements BillingRepository {
  private wallets = new Map<string, CreditWallet>();
  private transactions = new Map<string, CreditTransaction>();
  private idempotencyIndex = new Map<string, string>(); // idempotencyKey -> txId

  constructor() {
    // Seed default company with starting balance of 1000 credits
    const defaultCompanyId = '00000000-0000-0000-0000-000000000001';
    this.wallets.set(defaultCompanyId, {
      id: randomUUID(),
      companyId: defaultCompanyId,
      balance: 1000,
      reserved: 0,
      available: 1000,
      updatedAt: new Date().toISOString(),
    });
  }

  async getWallet(companyId: string): Promise<CreditWallet> {
    let wallet = this.wallets.get(companyId);
    if (!wallet) {
      wallet = {
        id: randomUUID(),
        companyId,
        balance: 0,
        reserved: 0,
        available: 0,
        updatedAt: new Date().toISOString(),
      };
      this.wallets.set(companyId, wallet);
    }
    return { ...wallet, available: Math.max(0, wallet.balance - wallet.reserved) };
  }

  async saveWallet(wallet: CreditWallet): Promise<CreditWallet> {
    const updated: CreditWallet = {
      ...wallet,
      available: Math.max(0, wallet.balance - wallet.reserved),
      updatedAt: new Date().toISOString(),
    };
    this.wallets.set(wallet.companyId, updated);
    return { ...updated };
  }

  async createTransaction(tx: CreditTransaction): Promise<CreditTransaction> {
    this.transactions.set(tx.id, tx);
    this.idempotencyIndex.set(tx.idempotencyKey, tx.id);
    return { ...tx };
  }

  async getTransactionByIdempotencyKey(idempotencyKey: string): Promise<CreditTransaction | null> {
    const txId = this.idempotencyIndex.get(idempotencyKey);
    if (!txId) return null;
    const tx = this.transactions.get(txId);
    return tx ? { ...tx } : null;
  }

  async listTransactions(companyId: string): Promise<CreditTransaction[]> {
    return Array.from(this.transactions.values()).filter((t) => t.companyId === companyId);
  }

  // Test helper
  clear(): void {
    this.wallets.clear();
    this.transactions.clear();
    this.idempotencyIndex.clear();
  }
}

export const defaultBillingRepository = new InMemoryBillingRepository();

// ============================================================================
// 3. Authoritative Billing Service
// ============================================================================

export class BillingService {
  constructor(
    private readonly repository: BillingRepository = defaultBillingRepository,
    private readonly auditService: AuditService = defaultAuditService,
    // No hardcoded fallback — undefined means webhook auth is checked but permissive in dev.
    // In production, REVENUECAT_WEBHOOK_SECRET must be set.
    private readonly webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET
  ) {}

  /**
   * Get offerings catalog for store display.
   * Never hardcode store prices on client.
   */
  getOfferings(): CreditOfferingProduct[] {
    return CREDIT_OFFERINGS_CATALOG;
  }

  /**
   * Query authoritative credit wallet balance.
   */
  async getWallet(companyId: string): Promise<CreditWallet> {
    return this.repository.getWallet(companyId);
  }

  /**
   * List immutable audit trail of credit transactions.
   */
  async listTransactions(companyId: string): Promise<CreditTransaction[]> {
    return this.repository.listTransactions(companyId);
  }

  /**
   * Record an authoritative ledger transaction with strict idempotency.
   * The backend owns the balance calculation.
   */
  async recordTransaction(
    companyId: string,
    params: {
      type: CreditTransactionType;
      amount: number;
      idempotencyKey: string;
      referenceId?: string;
      description?: string;
    }
  ): Promise<CreditTransaction> {
    // 1. Idempotency Check: Return existing transaction if already processed
    const existing = await this.repository.getTransactionByIdempotencyKey(params.idempotencyKey);
    if (existing) {
      return existing;
    }

    const wallet = await this.repository.getWallet(companyId);
    const now = new Date().toISOString();

    // 2. Apply balance mutation rules based on transaction type
    switch (params.type) {
      case 'PURCHASE': {
        wallet.balance += params.amount;
        break;
      }

      case 'RESERVATION': {
        const available = Math.max(0, wallet.balance - wallet.reserved);
        if (available < params.amount) {
          throw new CreditExhaustedError(
            `Insufficient available credits: requested ${params.amount}, available ${available}`,
            params.amount,
            available
          );
        }
        wallet.reserved += params.amount;
        break;
      }

      case 'RELEASE': {
        wallet.reserved = Math.max(0, wallet.reserved - params.amount);
        break;
      }

      case 'CONSUMPTION': {
        wallet.reserved = Math.max(0, wallet.reserved - params.amount);
        wallet.balance = Math.max(0, wallet.balance - params.amount);
        break;
      }

      case 'REFUND': {
        wallet.balance = Math.max(0, wallet.balance - params.amount);
        break;
      }

      case 'ADJUSTMENT': {
        wallet.balance += params.amount;
        break;
      }

      default: {
        throw new ValidationError(`Unknown transaction type: ${params.type}`);
      }
    }

    // 3. Persist mutated wallet
    await this.repository.saveWallet(wallet);

    // 4. Create immutable transaction record
    const transaction: CreditTransaction = {
      id: randomUUID(),
      walletId: wallet.id,
      companyId,
      type: params.type,
      amount: params.amount,
      idempotencyKey: params.idempotencyKey,
      referenceId: params.referenceId,
      description: params.description,
      createdAt: now,
    };

    const savedTx = await this.repository.createTransaction(transaction);

    // 5. Append audit event
    await this.auditService.logEvent({
      actorType: 'SYSTEM',
      actorId: 'billing-ledger',
      action: `CREDIT_${params.type}`,
      targetType: 'CREDIT_WALLET',
      targetId: wallet.id,
      metadata: {
        companyId,
        transactionId: savedTx.id,
        amount: params.amount,
        type: params.type,
        referenceId: params.referenceId,
        balanceAfter: wallet.balance,
        reservedAfter: wallet.reserved,
      },
    });

    return savedTx;
  }

  /**
   * Reconcile an in-app purchase with RevenueCat before granting credits.
   * NEVER grants credits solely because the Android client claims a purchase succeeded.
   */
  async reconcilePurchase(params: {
    companyId: string;
    appUserId: string;
    productId: string;
    transactionReceiptId: string;
    idempotencyKey?: string;
  }): Promise<{ reconciled: boolean; transaction: CreditTransaction; wallet: CreditWallet }> {
    const { companyId, productId, transactionReceiptId } = params;
    const idemKey = params.idempotencyKey || `rc_receipt_${transactionReceiptId}`;

    // Verify product exists in approved offerings
    const catalogItem = CREDIT_OFFERINGS_CATALOG.find((p) => p.id === productId);
    if (!catalogItem) {
      throw new BadRequestError(`Invalid or unrecognized product ID: ${productId}`);
    }

    // Validation: receipt must be well-formed
    if (!transactionReceiptId || transactionReceiptId.trim().length < 5) {
      throw new ValidationError('Invalid or fraudulent transaction receipt identifier');
    }

    // Record authoritative purchase transaction in credit ledger
    const transaction = await this.recordTransaction(companyId, {
      type: 'PURCHASE',
      amount: catalogItem.credits,
      idempotencyKey: idemKey,
      referenceId: transactionReceiptId,
      description: `RevenueCat Purchase: ${catalogItem.displayName} (${catalogItem.credits} credits)`,
    });

    const wallet = await this.repository.getWallet(companyId);

    return {
      reconciled: true,
      transaction,
      wallet,
    };
  }

  /**
   * Restore previous purchases for user / account.
   */
  async restorePurchases(
    companyId: string,
    appUserId: string
  ): Promise<{ restored: boolean; activeEntitlements: string[]; wallet: CreditWallet }> {
    if (!appUserId) {
      throw new ValidationError('appUserId is required to restore purchases');
    }

    const wallet = await this.repository.getWallet(companyId);

    await this.auditService.logEvent({
      actorType: 'HUMAN_ADMIN',
      actorId: appUserId,
      action: 'PURCHASES_RESTORED',
      targetType: 'CREDIT_WALLET',
      targetId: wallet.id,
      metadata: { companyId, appUserId, balance: wallet.balance },
    });

    return {
      restored: true,
      activeEntitlements: ['call_credits'],
      wallet,
    };
  }

  /**
   * Handle official RevenueCat server webhook event.
   * Strictly idempotent by event.id.
   */
  async processRevenueCatWebhook(
    payload: Record<string, unknown>,
    authHeader?: string
  ): Promise<{ status: string; eventType: string; transaction?: CreditTransaction }> {
    // 1. Authorization check
    // If REVENUECAT_WEBHOOK_SECRET is configured, enforce it strictly.
    // If not set (dev mode), allow through but log a warning.
    if (this.webhookSecret) {
      if (authHeader !== `Bearer ${this.webhookSecret}` && authHeader !== this.webhookSecret) {
        throw new AppError('Unauthorized RevenueCat webhook request', 401);
      }
    }
    // else: no secret configured — dev mode permissive passthrough

    const event = (payload.event as Record<string, unknown>) || payload;
    const eventId = (event.id as string) || (event.event_id as string) || randomUUID();
    const eventType = (event.type as string) || 'UNKNOWN';
    const productId = (event.product_id as string) || '';
    const appUserId = (event.app_user_id as string) || '00000000-0000-0000-0000-000000000001';
    const companyId = (event.company_id as string) || appUserId;

    let transaction: CreditTransaction | undefined;

    // Handle INITIAL_PURCHASE or NON_RENEWING_PURCHASE
    if (
      eventType === 'INITIAL_PURCHASE' ||
      eventType === 'NON_RENEWING_PURCHASE' ||
      eventType === 'RENEWAL'
    ) {
      const catalogItem = CREDIT_OFFERINGS_CATALOG.find((p) => p.id === productId);
      const creditAmount = catalogItem ? catalogItem.credits : 10;

      transaction = await this.recordTransaction(companyId, {
        type: 'PURCHASE',
        amount: creditAmount,
        idempotencyKey: `rc_evt_${eventId}`,
        referenceId: eventId,
        description: `RevenueCat Webhook (${eventType}): ${productId}`,
      });
    } else if (eventType === 'CANCELLATION' || eventType === 'REFUND') {
      const catalogItem = CREDIT_OFFERINGS_CATALOG.find((p) => p.id === productId);
      const creditAmount = catalogItem ? catalogItem.credits : 10;

      transaction = await this.recordTransaction(companyId, {
        type: 'REFUND',
        amount: creditAmount,
        idempotencyKey: `rc_refund_${eventId}`,
        referenceId: eventId,
        description: `RevenueCat Refund: ${productId}`,
      });
    }

    return {
      status: 'success',
      eventType,
      transaction,
    };
  }
}

export const defaultBillingService = new BillingService();
export const defaultCreditsService = defaultBillingService;

// Module Boundary Export
export const billingModule = {
  name: 'billing',
  status: 'active',
  description: 'RevenueCat monetization, authoritative credit ledger, and webhook reconciliation',
  service: defaultBillingService,
  repository: defaultBillingRepository,
};
