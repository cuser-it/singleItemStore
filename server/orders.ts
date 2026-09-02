import { createHash, randomUUID } from 'node:crypto';
import type { Response } from 'express';
import * as XLSX from 'xlsx';
import type { ProductVariant } from '../shared/site';
import type {
  CreateOrderInput,
  Order,
  OrderEvent,
  OrderFilters,
  OrderListResult,
  OrderTimelineItem,
  PaymentChannel,
  PaymentSettings,
  PaymentSettingsInput,
  ProductSku,
  ProductSkuInput,
} from '../shared/order';
import type { ContentStore } from './store';
import { prismaClient } from './prismaStore';

const phonePattern = /^1[3-9]\d{9}$/;
const moneyPattern = /^\d{1,8}(\.\d{1,2})?$/;
const maxQuantity = 99;
const shanghaiTimeZone = 'Asia/Shanghai';

type AuditLog = OrderTimelineItem & { orderId?: number; meta?: Record<string, unknown> };

type NotifyResult = { ok: true; order: Order; changed: boolean } | { ok: false; message: string };

function nowIso() {
  return new Date().toISOString();
}

function cents(value: string | number) {
  const normalized = typeof value === 'number' ? value.toFixed(2) : String(value).trim();
  if (!moneyPattern.test(normalized)) throw new Error('invalid amount');
  const [yuan, fen = ''] = normalized.split('.');
  return Number(yuan) * 100 + Number(fen.padEnd(2, '0').slice(0, 2));
}

function moneyFromCents(value: number) {
  return (value / 100).toFixed(2);
}

function normalizeMoney(value: string | number) {
  return moneyFromCents(cents(value));
}

function mapVariantToSku(variant: ProductVariant, siteId: number, index: number, timestamp: string): ProductSku {
  return {
    id: index + 1,
    siteId,
    skuCode: variant.id,
    name: variant.name,
    subtitle: variant.subtitle,
    price: normalizeMoney(variant.price),
    originalPrice: normalizeMoney(variant.originalPrice),
    saleLabel: variant.saleLabel,
    highlight: variant.highlight,
    enabled: true,
    sortOrder: index + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function decimalText(value: { toString: () => string } | string | number | null | undefined) {
  if (value === null || value === undefined) return '0.00';
  return typeof value === 'string' ? normalizeMoney(value) : normalizeMoney(value.toString());
}

function mapSkuRecord(record: {
  id: number;
  siteId: number;
  skuCode: string;
  name: string;
  subtitle: string;
  price: { toString: () => string } | string | number;
  originalPrice: { toString: () => string } | string | number;
  saleLabel: string;
  highlight: string | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ProductSku {
  return {
    id: record.id,
    siteId: record.siteId,
    skuCode: record.skuCode,
    name: record.name,
    subtitle: record.subtitle,
    price: decimalText(record.price),
    originalPrice: decimalText(record.originalPrice),
    saleLabel: record.saleLabel,
    highlight: record.highlight ?? undefined,
    enabled: record.enabled,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapOrderRecord(record: {
  id: number;
  orderNo: string;
  siteId: number;
  skuId: number | null;
  skuCode: string;
  skuName: string;
  productName: string;
  quantity: number;
  unitAmount: { toString: () => string } | string | number;
  totalAmount: { toString: () => string } | string | number;
  recipientName: string;
  phone: string;
  address: string;
  paymentChannel: string;
  paymentStatus: string;
  thirdPartyTradeNo: string | null;
  paidAt: Date | null;
  fulfillmentStatus: string;
  logisticsCompany: string | null;
  logisticsNo: string | null;
  shippedAt: Date | null;
  refundedAt: Date | null;
  refundNote: string | null;
  refundMarkedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletionReason: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Order {
  return {
    id: record.id,
    orderNo: record.orderNo,
    siteId: record.siteId,
    skuId: record.skuId,
    skuCode: record.skuCode,
    skuName: record.skuName,
    productName: record.productName,
    quantity: record.quantity,
    unitAmount: decimalText(record.unitAmount),
    totalAmount: decimalText(record.totalAmount),
    recipientName: record.recipientName,
    phone: record.phone,
    address: record.address,
    paymentChannel: record.paymentChannel as Order['paymentChannel'],
    paymentStatus: record.paymentStatus as Order['paymentStatus'],
    thirdPartyTradeNo: record.thirdPartyTradeNo ?? undefined,
    paidAt: record.paidAt?.toISOString(),
    fulfillmentStatus: record.fulfillmentStatus as Order['fulfillmentStatus'],
    logisticsCompany: record.logisticsCompany ?? undefined,
    logisticsNo: record.logisticsNo ?? undefined,
    shippedAt: record.shippedAt?.toISOString(),
    refundedAt: record.refundedAt?.toISOString(),
    refundNote: record.refundNote ?? undefined,
    refundMarkedBy: record.refundMarkedBy ?? undefined,
    deletedAt: record.deletedAt?.toISOString(),
    deletedBy: record.deletedBy ?? undefined,
    deletionReason: record.deletionReason ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapPaymentSettingsRecord(record: {
  gatewayUrl: string;
  merchantId: string;
  encryptedSecret: string;
  enabledChannels: unknown;
  notifyUrl: string;
  returnUrl: string;
  updatedAt: Date;
}): PaymentSettings {
  const enabledChannels = Array.isArray(record.enabledChannels) ? record.enabledChannels.filter((item): item is pNf => item === 'alipay' || item === 'wechat') : [];
  return {
    gatewayUrl: record.gatewayUrl,
    merchantId: record.merchantId,
    enabledChannels,
    notifyUrl: record.notifyUrl,
    returnUrl: record.returnUrl,
    secretMasked: maskSecret(record.encryptedSecret),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapLogRecord(record: { id: number; orderId: number | null; action: string; summary: string; actor: string; createdAt: Date }): OrderTimelineItem {
  return {
    id: record.id,
    action: record.action,
    summary: record.summary,
    actor: record.actor,
    createdAt: record.createdAt.toISOString(),
  };
}

function signParams(params: Record<string, string>, secret: string) {

function maskSecret(secret: string) {
  if (!secret) return '';
  if (secret.length <= 6) return '******';
  return `${secret.slice(0, 3)}******${secret.slice(-3)}`;
}

function encodeSecret(secret: string) {
  return Buffer.from(secret, 'utf8').toString('base64');
}

function decodeSecret(secret: string) {
  try {
    return Buffer.from(secret, 'base64').toString('utf8');
  } catch {
    return secret;
  }
}

function maskPhone(phone: string) {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function maskAddress(address: string) {
  if (address.length <= 8) return `${address.slice(0, 2)}***`;
  return `${address.slice(0, 6)}***${address.slice(-2)}`;
}

function escapeCell(value: unknown) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export class OrderService {
  private skus = new Map<number, ProductSku[]>();
  private orders: Order[] = [];
  private logs: AuditLog[] = [];
  private idempotency = new Map<string, number>();
  private skuSeq = 1000;
  private orderSeq = 1000;
  private logSeq = 1;
  private clients = new Set<Response>();
  private readonly persistent = Boolean(process.env.DATABASE_URL);
  private paymentSettings: PaymentSettingsInput & { updatedAt: string } = {
    gatewayUrl: process.env.EPAY_GATEWAY_URL ?? 'https://pay.example.test/submit.php',
    merchantId: process.env.EPAY_MERCHANT_ID ?? 'demo',
    merchantSecret: process.env.EPAY_MERCHANT_SECRET ?? 'demo-secret',
    enabledChannels: ['alipay', 'wechat'],
    notifyUrl: process.env.EPAY_NOTIFY_URL ?? '/api/payment/epay/notify',
    returnUrl: process.env.EPAY_RETURN_URL ?? '/payment/return',
    updatedAt: nowIso(),
  };


  constructor(private store: ContentStore) {}

  private ready?: Promise<void>;

  private async ensureReady() {
    if (!this.persistent) return;
    if (!this.ready) this.ready = this.ensurePersistentSchema();
    await this.ready;
  }

  private async ensurePersistentSchema() {
    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProductSku" (
        "id" SERIAL PRIMARY KEY,
        "siteId" INTEGER NOT NULL,
        "skuCode" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "subtitle" TEXT NOT NULL,
        "price" NUMERIC(10,2) NOT NULL,
        "originalPrice" NUMERIC(10,2) NOT NULL,
        "saleLabel" TEXT NOT NULL,
        "highlight" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PaymentSettings" (
        "id" SERIAL PRIMARY KEY,
        "siteId" INTEGER NOT NULL UNIQUE,
        "gatewayUrl" TEXT NOT NULL,
        "merchantId" TEXT NOT NULL,
        "encryptedSecret" TEXT NOT NULL,
        "enabledChannels" JSONB NOT NULL,
        "notifyUrl" TEXT NOT NULL,
        "returnUrl" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Order" (
        "id" SERIAL PRIMARY KEY,
        "orderNo" TEXT NOT NULL UNIQUE,
        "siteId" INTEGER NOT NULL,
        "skuId" INTEGER,
        "skuCode" TEXT NOT NULL,
        "skuName" TEXT NOT NULL,
        "productName" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL,
        "unitAmount" NUMERIC(10,2) NOT NULL,
        "totalAmount" NUMERIC(10,2) NOT NULL,
        "recipientName" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "paymentChannel" TEXT NOT NULL,
        "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
        "thirdPartyTradeNo" TEXT,
        "paidAt" TIMESTAMP(3),
        "fulfillmentStatus" TEXT NOT NULL DEFAULT 'WAIT_SHIP',
        "logisticsCompany" TEXT,
        "logisticsNo" TEXT,
        "shippedAt" TIMESTAMP(3),
        "refundedAt" TIMESTAMP(3),
        "refundNote" TEXT,
        "refundMarkedBy" TEXT,
        "deletedAt" TIMESTAMP(3),
        "deletedBy" TEXT,
        "deletionReason" TEXT,
        "idempotencyKey" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OperationLog" (
        "id" SERIAL PRIMARY KEY,
        "siteId" INTEGER NOT NULL,
        "orderId" INTEGER,
        "action" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "actor" TEXT NOT NULL,
        "meta" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prismaClient.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "ProductSku_siteId_skuCode_key" ON "ProductSku" ("siteId", "skuCode")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ProductSku_siteId_enabled_idx" ON "ProductSku" ("siteId", "enabled")');
    await prismaClient.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Order_siteId_idempotencyKey_key" ON "Order" ("siteId", "idempotencyKey")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_siteId_createdAt_idx" ON "Order" ("siteId", "createdAt")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_siteId_paymentStatus_idx" ON "Order" ("siteId", "paymentStatus")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_siteId_fulfillmentStatus_idx" ON "Order" ("siteId", "fulfillmentStatus")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_siteId_deletedAt_idx" ON "Order" ("siteId", "deletedAt")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "OperationLog_siteId_createdAt_idx" ON "OperationLog" ("siteId", "createdAt")');
    await prismaClient.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "OperationLog_orderId_idx" ON "OperationLog" ("orderId")');
  }

  async ensureSiteSkus(siteId?: number) {
    await this.ensureReady();
    const site = siteId ? undefined : await this.store.getActiveSite();
    const resolvedSiteId = siteId ?? site!.id;
    const bootstrap = await this.store.getBootstrap(resolvedSiteId);
    const variants = bootstrap.settings.productVariants;
    if (!this.persistent) {
      if (!this.skus.has(resolvedSiteId)) {
        const timestamp = nowIso();
        this.skus.set(resolvedSiteId, variants.map((variant, index) => mapVariantToSku(variant, resolvedSiteId, index, timestamp)));
        this.skuSeq = Math.max(this.skuSeq, ...this.skus.get(resolvedSiteId)!.map((item) => item.id)) + 1;
      } else if (JSON.stringify(this.skus.get(resolvedSiteId)!.map((sku) => [sku.skuCode, sku.name, sku.subtitle, sku.price, sku.originalPrice, sku.saleLabel, sku.highlight, sku.sortOrder])) !== JSON.stringify(variants.map((variant) => [variant.id, variant.name, variant.subtitle, variant.price.toFixed(2), variant.originalPrice.toFixed(2), variant.saleLabel, variant.highlight, variants.indexOf(variant) + 1]))) {
        const current = this.skus.get(resolvedSiteId)!;
        const timestamp = nowIso();
        const byCode = new Map(current.map((sku) => [sku.skuCode, sku]));
        const next = variants.map((variant, index) => {
          const existing = byCode.get(variant.id);
          const mapped = mapVariantToSku(variant, resolvedSiteId, index, timestamp);
          return existing ? { ...mapped, id: existing.id, enabled: existing.enabled, createdAt: existing.createdAt } : mapped;
        });
        this.skus.set(resolvedSiteId, next);
      }
      return this.skus.get(resolvedSiteId)!;
    }
    const existing = await prismaClient.productSku.findMany({ where: { siteId: resolvedSiteId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    const existingByCode = new Map(existing.map((sku) => [sku.skuCode, sku]));
    const nextCodes = new Set(variants.map((variant) => variant.id));
    const mapped: ProductSku[] = [];
    for (const [index, variant] of variants.entries()) {
      const current = existingByCode.get(variant.id);
      const payload = mapVariantToSku(variant, resolvedSiteId, index, nowIso());
      if (current) {
        const updated = await prismaClient.productSku.update({
          where: { id: current.id },
          data: {
            skuCode: payload.skuCode,
            name: payload.name,
            subtitle: payload.subtitle,
            price: payload.price,
            originalPrice: payload.originalPrice,
            saleLabel: payload.saleLabel,
            highlight: payload.highlight ?? null,
            enabled: current.enabled,
            sortOrder: payload.sortOrder,
          },
        });
        mapped.push(mapSkuRecord(updated));
      } else {
        const created = await prismaClient.productSku.create({
          data: {
            siteId: resolvedSiteId,
            skuCode: payload.skuCode,
            name: payload.name,
            subtitle: payload.subtitle,
            price: payload.price,
            originalPrice: payload.originalPrice,
            saleLabel: payload.saleLabel,
            highlight: payload.highlight ?? null,
            enabled: true,
            sortOrder: payload.sortOrder,
          },
        });
        mapped.push(mapSkuRecord(created));
      }
    }
    const staleIds = existing.filter((sku) => !nextCodes.has(sku.skuCode)).map((sku) => sku.id);
    if (staleIds.length) {
      await prismaClient.productSku.deleteMany({ where: { id: { in: staleIds } } });
    }
    return mapped;
  }

  async listSkus(siteId?: number, enabledOnly = false) {
    if (!this.persistent) {
      const skus = await this.ensureSiteSkus(siteId);
      return skus.filter((sku) => !enabledOnly || sku.enabled).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    }
    const resolvedSiteId = siteId ?? (await this.store.getActiveSite()).id;
    await this.ensureSiteSkus(resolvedSiteId);
    const records = await prismaClient.productSku.findMany({
      where: { siteId: resolvedSiteId, ...(enabledOnly ? { enabled: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return records.map(mapSkuRecord);
  }

  async createSku(input: ProductSkuInput, actor = 'admin') {
    if (!this.persistent) {
      const site = await this.store.getActiveSite();
      const skus = await this.ensureSiteSkus(site.id);
      if (skus.some((sku) => sku.skuCode === input.skuCode.trim())) throw new Error('sku code exists');
      const timestamp = nowIso();
      const sku: ProductSku = { ...this.normalizeSkuInput(input), id: this.skuSeq++, siteId: site.id, createdAt: timestamp, updatedAt: timestamp };
      skus.push(sku);
      this.log('sku_created', `SKU ${sku.skuCode} created`, actor, undefined, { skuId: sku.id });
      return sku;
    }
    const site = await this.store.getActiveSite();
    const payload = this.normalizeSkuInput(input);
    const created = await prismaClient.productSku.create({
      data: {
        siteId: site.id,
        skuCode: payload.skuCode,
        name: payload.name,
        subtitle: payload.subtitle,
        price: payload.price,
        originalPrice: payload.originalPrice,
        saleLabel: payload.saleLabel,
        highlight: payload.highlight ?? null,
        enabled: payload.enabled,
        sortOrder: payload.sortOrder,
      },
    });
    this.log('sku_created', `SKU ${created.skuCode} created`, actor, undefined, { skuId: created.id });
    return mapSkuRecord(created);
  }

  async updateSku(id: number, input: ProductSkuInput, actor = 'admin') {
    if (!this.persistent) {
      const site = await this.store.getActiveSite();
      const skus = await this.ensureSiteSkus(site.id);
      const index = skus.findIndex((sku) => sku.id === id);
      if (index < 0) return null;
      if (skus.some((sku) => sku.id !== id && sku.skuCode === input.skuCode.trim())) throw new Error('sku code exists');
      const previous = skus[index];
      const next = { ...previous, ...this.normalizeSkuInput(input), updatedAt: nowIso() };
      skus[index] = next;
      this.log('sku_updated', `SKU ${next.skuCode} updated`, actor, undefined, { skuId: id, priceChanged: previous.price !== next.price });
      return next;
    }
    const payload = this.normalizeSkuInput(input);
    const updated = await prismaClient.productSku.update({
      where: { id },
      data: {
        skuCode: payload.skuCode,
        name: payload.name,
        subtitle: payload.subtitle,
        price: payload.price,
        originalPrice: payload.originalPrice,
        saleLabel: payload.saleLabel,
        highlight: payload.highlight ?? null,
        enabled: payload.enabled,
        sortOrder: payload.sortOrder,
      },
    }).catch(() => null);
    if (!updated) return null;
    this.log('sku_updated', `SKU ${updated.skuCode} updated`, actor, undefined, { skuId: id });
    return mapSkuRecord(updated);
  }

  async disableSku(id: number, actor = 'admin') {
    if (!this.persistent) {
      const site = await this.store.getActiveSite();
      const skus = await this.ensureSiteSkus(site.id);
      const index = skus.findIndex((sku) => sku.id === id);
      if (index < 0) return false;
      skus[index] = { ...skus[index], enabled: false, updatedAt: nowIso() };
      this.log('sku_disabled', `SKU ${skus[index].skuCode} disabled`, actor, undefined, { skuId: id });
      return true;
    }
    const updated = await prismaClient.productSku.update({ where: { id }, data: { enabled: false } }).catch(() => null);
    if (!updated) return false;
    this.log('sku_disabled', `SKU ${updated.skuCode} disabled`, actor, undefined, { skuId: id });
    return true;
  }

  async createOrder(input: CreateOrderInput) {
    const site = await this.store.getActiveSite();
    const key = input.idempotencyKey?.trim();
    if (key && this.idempotency.has(`${site.id}:${key}`)) {
      const order = this.orders.find((item) => item.id === this.idempotency.get(`${site.id}:${key}`));
      if (order) return this.buildPayment(order);
    }
    this.validateOrderInput(input);
    const sku = (await this.listSkus(site.id, true)).find((item) => item.id === input.skuId);
    if (!sku) throw new Error('sku not found');
    const unit = cents(sku.price);
    const total = unit * input.quantity;
    const timestamp = nowIso();
    const order: Order = {
      id: ++this.orderSeq,
      orderNo: this.nextOrderNo(),
      siteId: site.id,
      skuId: sku.id,
      skuCode: sku.skuCode,
      skuName: sku.name,
      productName: (await this.store.getSiteSettings(site.id)).title,
      quantity: input.quantity,
      unitAmount: moneyFromCents(unit),
      totalAmount: moneyFromCents(total),
      recipientName: input.recipientName.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      paymentChannel: input.paymentChannel,
      paymentStatus: 'PAYING',
      fulfillmentStatus: 'WAIT_SHIP',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.orders.unshift(order);
    if (key) this.idempotency.set(`${site.id}:${key}`, order.id);
    this.log('order_created', `Order ${order.orderNo} created`, 'system', order.id);
    this.emit({ type: 'order_created', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
    return this.buildPayment(order);
  }

  async listOrders(filters: OrderFilters = {}): Promise<OrderListResult> {
    const site = await this.store.getActiveSite();
    const page = Math.max(1, Number(filters.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize ?? 20)));
    const start = parseDate(filters.startAt);
    const end = parseDate(filters.endAt);
    const query = filters.query?.trim().toLowerCase();
    const items = this.orders.filter((order) => {
      if (order.siteId !== site.id) return false;
      if ((filters.deletedStatus ?? 'active') === 'active' && order.deletedAt) return false;
      if (filters.deletedStatus === 'deleted' && !order.deletedAt) return false;
      if (filters.paymentStatus && filters.paymentStatus !== 'all' && order.paymentStatus !== filters.paymentStatus) return false;
      if (filters.fulfillmentStatus && filters.fulfillmentStatus !== 'all' && order.fulfillmentStatus !== filters.fulfillmentStatus) return false;
      if (filters.refundStatus === 'refunded' && !order.refundedAt) return false;
      if (filters.refundStatus === 'not_refunded' && order.refundedAt) return false;
      if (filters.skuId && order.skuId !== filters.skuId) return false;
      if (start && new Date(order.createdAt) < start) return false;
      if (end && new Date(order.createdAt) >= end) return false;
      if (query && ![order.orderNo, order.phone, order.recipientName].some((value) => value.toLowerCase().includes(query))) return false;
      return true;
    });
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
  }

  async getOrder(id: number) {
    return this.orders.find((order) => order.id === id) ?? null;
  }

  async getOrderTimeline(id: number) {
    return this.logs.filter((log) => log.orderId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async queryPublicOrder(orderNo: string, phone: string) {
    if (!phonePattern.test(phone)) throw new Error('invalid phone');
    const order = this.orders.find((item) => item.orderNo === orderNo.trim() && item.phone === phone.trim() && !item.deletedAt);
    if (!order) return null;
    return { ...order, phone: maskPhone(order.phone), address: maskAddress(order.address) };
  }

  async shipOrder(id: number, logisticsCompany: string, logisticsNo: string, actor = 'admin') {
    const order = await this.getOrder(id);
    if (!order || order.deletedAt) return null;
    if (!logisticsCompany.trim() || !logisticsNo.trim()) throw new Error('logistics required');
    if (order.fulfillmentStatus === 'SHIPPED') throw new Error('already shipped');
    order.logisticsCompany = logisticsCompany.trim();
    order.logisticsNo = logisticsNo.trim();
    order.shippedAt = nowIso();
    order.fulfillmentStatus = 'SHIPPED';
    order.updatedAt = nowIso();
    this.log('order_shipped', `Order ${order.orderNo} shipped`, actor, id);
    this.emit({ type: 'order_shipped', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
    return order;
  }

  async markRefunded(id: number, note: string, actor = 'admin') {
    const order = await this.getOrder(id);
    if (!order || order.deletedAt) return null;
    if (!note.trim()) throw new Error('refund note required');
    order.paymentStatus = 'REFUNDED';
    order.refundedAt = nowIso();
    order.refundNote = note.trim();
    order.refundMarkedBy = actor;
    order.updatedAt = nowIso();
    this.log('refund_marked', `Order ${order.orderNo} refund marked`, actor, id);
    this.emit({ type: 'refund_marked', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
    return order;
  }

  async deleteOrder(id: number, reason: string, actor = 'admin') {
    const order = await this.getOrder(id);
    if (!order || order.deletedAt) return null;
    if (!reason.trim()) throw new Error('delete reason required');
    const olderThan30Days = Date.now() - new Date(order.createdAt).getTime() >= 30 * 24 * 60 * 60 * 1000;
    if (!olderThan30Days && !order.refundedAt) throw new Error('delete condition not met');
    order.deletedAt = nowIso();
    order.deletedBy = actor;
    order.deletionReason = reason.trim();
    order.updatedAt = nowIso();
    this.log('order_deleted', `Order ${order.orderNo} deleted`, actor, id);
    this.emit({ type: 'order_deleted', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
    return order;
  }

  async handleNotify(raw: Record<string, string>): Promise<NotifyResult> {
    const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value)]));
    const secret = this.paymentSettings.merchantSecret ?? '';
    const expected = signParams(params, secret);
    const order = this.orders.find((item) => item.orderNo === params.out_trade_no);
    if (!order) return { ok: false, message: 'order not found' };
    if (params.pid !== this.paymentSettings.merchantId) return { ok: false, message: 'merchant mismatch' };
    if (params.sign !== expected) {
      this.log('payment_notify', `Payment notify sign failed for ${order.orderNo}`, 'payment', order.id);
      return { ok: false, message: 'invalid sign' };
    }
    if (normalizeMoney(params.money ?? '0') !== order.totalAmount) return { ok: false, message: 'amount mismatch' };
    if (params.trade_status !== 'TRADE_SUCCESS') return { ok: false, message: 'not success' };
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') return { ok: true, order, changed: false };
    order.paymentStatus = 'PAID';
    order.thirdPartyTradeNo = params.trade_no;
    order.paidAt = nowIso();
    order.updatedAt = nowIso();
    this.log('payment_paid', `Order ${order.orderNo} paid by notify`, 'payment', order.id, { tradeNo: params.trade_no, signOk: true });
    this.emit({ type: 'payment_paid', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
    return { ok: true, order, changed: true };
  }

  async getPaymentSettings(): Promise<PaymentSettings> {
    await this.ensureReady();
    if (!this.persistent) {
      return {
        gatewayUrl: this.paymentSettings.gatewayUrl,
        merchantId: this.paymentSettings.merchantId,
        enabledChannels: this.paymentSettings.enabledChannels,
        notifyUrl: this.paymentSettings.notifyUrl,
        returnUrl: this.paymentSettings.returnUrl,
        secretMasked: maskSecret(this.paymentSettings.merchantSecret ?? ''),
        updatedAt: this.paymentSettings.updatedAt,
      };
    }
    const siteId = (await this.store.getActiveSite()).id;
    const existing = await prismaClient.paymentSettings.findUnique({ where: { siteId } });
    if (!existing) {
      const created = await prismaClient.paymentSettings.create({
        data: {
          siteId,
          gatewayUrl: this.paymentSettings.gatewayUrl,
          merchantId: this.paymentSettings.merchantId,
          encryptedSecret: encodeSecret(this.paymentSettings.merchantSecret ?? ''),
          enabledChannels: this.paymentSettings.enabledChannels,
          notifyUrl: this.paymentSettings.notifyUrl,
          returnUrl: this.paymentSettings.returnUrl,
        },
      });
      return mapPaymentSettingsRecord(created);
    }
    return mapPaymentSettingsRecord(existing);
  }

  async updatePaymentSettings(input: PaymentSettingsInput, actor = 'admin') {
    if (!this.persistent) {
      this.paymentSettings = {
        gatewayUrl: input.gatewayUrl.trim(),
        merchantId: input.merchantId.trim(),
        merchantSecret: input.merchantSecret?.trim() || this.paymentSettings.merchantSecret,
        enabledChannels: input.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wechat'),
        notifyUrl: input.notifyUrl.trim(),
        returnUrl: input.returnUrl.trim(),
        updatedAt: nowIso(),
      };
      this.log('payment_settings_updated', 'Payment settings updated', actor);
      return this.getPaymentSettings();
    }
    const siteId = (await this.store.getActiveSite()).id;
    const current = await prismaClient.paymentSettings.findUnique({ where: { siteId } });
    const updated = await prismaClient.paymentSettings.upsert({
      where: { siteId },
      update: {
        gatewayUrl: input.gatewayUrl.trim(),
        merchantId: input.merchantId.trim(),
        encryptedSecret: input.merchantSecret ? encodeSecret(input.merchantSecret.trim()) : current?.encryptedSecret ?? encodeSecret(this.paymentSettings.merchantSecret ?? ''),
        enabledChannels: input.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wechat'),
        notifyUrl: input.notifyUrl.trim(),
        returnUrl: input.returnUrl.trim(),
      },
      create: {
        siteId,
        gatewayUrl: input.gatewayUrl.trim(),
        merchantId: input.merchantId.trim(),
        encryptedSecret: encodeSecret(input.merchantSecret ?? this.paymentSettings.merchantSecret ?? ''),
        enabledChannels: input.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wechat'),
        notifyUrl: input.notifyUrl.trim(),
        returnUrl: input.returnUrl.trim(),
      },
    });
    this.log('payment_settings_updated', 'Payment settings updated', actor);
    return mapPaymentSettingsRecord(updated);
  }

  exportOrders(filters: OrderFilters, columns: string[]) {
    const allowed: Record<string, string> = {
      orderNo: '订单号', recipientName: '姓名', phone: '手机号', address: '地址', skuName: '规格', quantity: '数量', totalAmount: '成交金额', paymentStatus: '支付状态', fulfillmentStatus: '履约状态', logisticsCompany: '物流公司', logisticsNo: '物流单号', createdAt: '创建时间', paidAt: '支付时间', shippedAt: '发货时间', refundNote: '退款备注',
    };
    const picked = columns.length ? columns : ['orderNo', 'recipientName', 'phone', 'address', 'skuName', 'quantity', 'totalAmount', 'paymentStatus', 'fulfillmentStatus', 'createdAt'];
    if (picked.some((column) => !allowed[column])) throw new Error('invalid export column');
    const rows = this.filterOrdersSync(filters);
    const sheetRows = [picked.map((column) => allowed[column])].concat(rows.map((order) => picked.map((column) => escapeCell((order as any)[column]))));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
    this.log('orders_exported', `Exported ${rows.length} orders`, 'admin', undefined, { columns: picked, count: rows.length, timeZone: shanghaiTimeZone });
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  addClient(res: Response) {
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  mockNotifyParams(orderNo: string, tradeNo = `MOCK${Date.now()}`) {
    const order = this.orders.find((item) => item.orderNo === orderNo);
    if (!order) throw new Error('order not found');
    const params = { pid: this.paymentSettings.merchantId, trade_no: tradeNo, out_trade_no: order.orderNo, type: order.paymentChannel, name: order.skuName, money: order.totalAmount, trade_status: 'TRADE_SUCCESS' };
    return { ...params, sign: signParams(params, this.paymentSettings.merchantSecret ?? ''), sign_type: 'MD5' };
  }

  private normalizeSkuInput(input: ProductSkuInput): ProductSkuInput {
    if (!input.skuCode.trim() || !input.name.trim()) throw new Error('sku required');
    return { ...input, skuCode: input.skuCode.trim(), name: input.name.trim(), subtitle: input.subtitle.trim(), price: normalizeMoney(input.price), originalPrice: normalizeMoney(input.originalPrice), saleLabel: input.saleLabel.trim() || '券后价', highlight: input.highlight?.trim(), enabled: Boolean(input.enabled), sortOrder: Number(input.sortOrder) || 0 };
  }

  private validateOrderInput(input: CreateOrderInput) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > maxQuantity) throw new Error('invalid quantity');
    if (!phonePattern.test(input.phone.trim())) throw new Error('invalid phone');
    if (!input.recipientName.trim() || !input.address.trim()) throw new Error('recipient required');
    if (!['alipay', 'wechat'].includes(input.paymentChannel)) throw new Error('invalid payment channel');
    if (!this.paymentSettings.enabledChannels.includes(input.paymentChannel)) throw new Error('payment channel disabled');
  }

  private buildPayment(order: Order) {
    const params = { pid: this.paymentSettings.merchantId, type: order.paymentChannel, out_trade_no: order.orderNo, notify_url: this.paymentSettings.notifyUrl, return_url: `${this.paymentSettings.returnUrl}?orderNo=${encodeURIComponent(order.orderNo)}`, name: order.skuName, money: order.totalAmount, sitename: 'single-item-store' };
    const signed = { ...params, sign: signParams(params, this.paymentSettings.merchantSecret ?? ''), sign_type: 'MD5' };
    const query = new URLSearchParams(signed).toString();
    return { order, paymentUrl: `${this.paymentSettings.gatewayUrl}?${query}`, params: signed };
  }

  private nextOrderNo() {
    const date = new Date();
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: shanghaiTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replace(/-/g, '');
    return `SO${stamp}${String(++this.orderSeq).padStart(6, '0')}${randomUUID().slice(0, 4).toUpperCase()}`;
  }

  private log(action: string, summary: string, actor: string, orderId?: number, meta?: Record<string, unknown>) {
    this.logs.push({ id: this.logSeq++, action, summary, actor, orderId, meta, createdAt: nowIso() });
  }

  private emit(event: OrderEvent) {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(payload);
  }

  private filterOrdersSync(filters: OrderFilters = {}) {
    const start = parseDate(filters.startAt);
    const end = parseDate(filters.endAt);
    return this.orders.filter((order) => {
      if ((filters.deletedStatus ?? 'active') === 'active' && order.deletedAt) return false;
      if (filters.deletedStatus === 'deleted' && !order.deletedAt) return false;
      if (filters.paymentStatus && filters.paymentStatus !== 'all' && order.paymentStatus !== filters.paymentStatus) return false;
      if (filters.fulfillmentStatus && filters.fulfillmentStatus !== 'all' && order.fulfillmentStatus !== filters.fulfillmentStatus) return false;
      if (filters.refundStatus === 'refunded' && !order.refundedAt) return false;
      if (filters.refundStatus === 'not_refunded' && order.refundedAt) return false;
      if (filters.skuId && order.skuId !== filters.skuId) return false;
      if (start && new Date(order.createdAt) < start) return false;
      if (end && new Date(order.createdAt) >= end) return false;
      return true;
    });
  }
}
