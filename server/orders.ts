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
import type { Prisma } from '@prisma/client';

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
  const secret = decodeSecret(record.encryptedSecret);
  return {
    gatewayUrl: record.gatewayUrl,
    merchantId: record.merchantId,
    enabledChannels: Array.isArray(record.enabledChannels) ? record.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wxpay') : ['alipay', 'wxpay'],
    notifyUrl: record.notifyUrl,
    returnUrl: record.returnUrl,
    secretMasked: maskSecret(secret),
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

/** 把 Origin 头规范化为 http(s) 源，非法或非 http(s) 时返回空串 */
function normalizeOrigin(requestOrigin: string | undefined) {
  if (!requestOrigin) return '';
  try {
    const parsed = new URL(requestOrigin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : '';
  } catch {
    return '';
  }
}

/** 将 target 的协议/主机/端口改为 origin 的值。
 *  注意不能用 target.host = originUrl.host：按 WHATWG 规范，赋值不带端口时会保留原有端口，
 *  会把 http://localhost:3001/x + https://shop.example.com 拼成 https://shop.example.com:3001/x */
function applyOrigin(target: URL, origin: string) {
  const originUrl = new URL(origin);
  target.protocol = originUrl.protocol;
  target.hostname = originUrl.hostname;
  target.port = originUrl.port;
}

const notifyFallbackPath = '/api/payment/epay/notify';

/**
 * 生成支付网关的异步通知地址（notify_url）。
 * 与 return_url 采用同样的规则：域名/端口取自用户下单时访问的页面 Origin，后台配置只贡献路径。
 * 历史上这里直接透传后台配置，一旦被填成 http://localhost:3001/... ，支付网关回调的是它自己的
 * localhost，通知永远到不了本服务，订单会一直停留在“支付中”。
 */
export function resolveNotifyUrl(configured: string, requestOrigin: string | undefined) {
  const raw = (configured || notifyFallbackPath).trim();
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) return raw;
  let target: URL;
  try {
    target = new URL(raw, origin);
  } catch {
    target = new URL(notifyFallbackPath, origin);
  }
  applyOrigin(target, origin);
  return target.toString();
}

/**
 * 生成支付网关的同步跳转地址（return_url）。
 * - 域名/端口始终取自用户发起下单请求的页面 Origin
 * - 后台配置的 returnUrl 只贡献路径与查询参数
 * - 没有 Origin（如服务端自测）时，退回配置值原样使用
 */
export function resolveReturnUrl(configured: string, requestOrigin: string | undefined, orderNo: string) {
  const fallbackPath = '/payment/return';
  const raw = (configured || fallbackPath).trim();
  const origin = normalizeOrigin(requestOrigin);
  let target: URL;
  try {
    target = new URL(raw, origin || 'http://placeholder.invalid');
  } catch {
    target = new URL(fallbackPath, origin || 'http://placeholder.invalid');
  }
  if (origin) {
    applyOrigin(target, origin);
  }
  target.searchParams.set('orderNo', orderNo);
  if (!origin && target.hostname === 'placeholder.invalid') return `${target.pathname}${target.search}`;
  return target.toString();
}

function signParams(params: Record<string, string>, secret: string) {
  const filtered = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  const query = filtered.map(([key, value]) => `${key}=${value}`).join('&');
  return createHash('md5').update(`${query}${secret}`).digest('hex');
}
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
    enabledChannels: ['alipay', 'wxpay'],
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
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Order'
            AND column_name = 'id'
            AND data_type = 'text'
        ) THEN
          ALTER TABLE "Order" RENAME TO "OrderLegacy";
        END IF;
      END $$;
    `);
    await prismaClient.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE TYPE "StorePaymentStatus" AS ENUM ('UNPAID', 'PAYING', 'PAID', 'PAYMENT_FAILED', 'REFUNDED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await prismaClient.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "StoreFulfillmentStatus" AS ENUM ('WAIT_SHIP', 'SHIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
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
        "paymentStatus" "StorePaymentStatus" NOT NULL DEFAULT 'UNPAID',
        "thirdPartyTradeNo" TEXT,
        "paidAt" TIMESTAMP(3),
        "fulfillmentStatus" "StoreFulfillmentStatus" NOT NULL DEFAULT 'WAIT_SHIP',
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
      }
      // SKU 一旦生成即以自身为准：productVariants 只用于站点初始化，
      // 不能反向覆盖后台手动编辑过的 SKU（与 Prisma 分支保持一致）
      return this.skus.get(resolvedSiteId)!;
    }
    const existing = await prismaClient.productSku.findMany({ where: { siteId: resolvedSiteId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    
    // 如果 SKU 已存在，直接返回，不覆盖手动编辑的数据
    if (existing.length > 0) {
      return existing.map(mapSkuRecord);
    }
    
    // 仅在 SKU 不存在时，从 productVariants 初始化
    const mapped: ProductSku[] = [];
    for (const [index, variant] of variants.entries()) {
      const payload = mapVariantToSku(variant, resolvedSiteId, index, nowIso());
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
    }).catch((err) => {
      console.error('[updateSku] Database update failed:', err);
      return null;
    });
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

  async enableSku(id: number, actor = 'admin') {
    if (!this.persistent) {
      const site = await this.store.getActiveSite();
      const skus = await this.ensureSiteSkus(site.id);
      const index = skus.findIndex((sku) => sku.id === id);
      if (index < 0) return false;
      skus[index] = { ...skus[index], enabled: true, updatedAt: nowIso() };
      this.log('sku_enabled', `SKU ${skus[index].skuCode} enabled`, actor, undefined, { skuId: id });
      return true;
    }
    const updated = await prismaClient.productSku.update({ where: { id }, data: { enabled: true } }).catch(() => null);
    if (!updated) return false;
    this.log('sku_enabled', `SKU ${updated.skuCode} enabled`, actor, undefined, { skuId: id });
    return true;
  }

  async deleteSku(id: number, actor = 'admin') {
    if (!this.persistent) {
      const site = await this.store.getActiveSite();
      const skus = await this.ensureSiteSkus(site.id);
      const index = skus.findIndex((sku) => sku.id === id);
      if (index < 0) return false;
      const sku = skus[index];
      skus.splice(index, 1);
      this.log('sku_deleted', `SKU ${sku.skuCode} deleted`, actor, undefined, { skuId: id });
      return true;
    }
    const sku = await prismaClient.productSku.findUnique({ where: { id } });
    if (!sku) return false;
    await prismaClient.productSku.delete({ where: { id } });
    this.log('sku_deleted', `SKU ${sku.skuCode} deleted`, actor, undefined, { skuId: id });
    return true;
  }
  async createOrder(input: CreateOrderInput, requestOrigin?: string) {
    await this.ensureReady();
    const site = await this.store.getBootstrap(input.siteId).then((bootstrap) => bootstrap.site);
    if (!site.isActive) throw new Error('site not active');
    const key = input.idempotencyKey?.trim();
    const settings = await this.loadPaymentSettingsState();
    if (this.persistent && key) {
      const existing = await prismaClient.order.findFirst({ where: { siteId: site.id, idempotencyKey: key } });
      if (existing) return this.buildPayment(mapOrderRecord(existing), settings, requestOrigin);
    } else if (!this.persistent && key) {
      const existing = this.orders.find((item) => item.siteId === site.id && item.idempotencyKey === key);
      if (existing) return this.buildPayment(existing, settings, requestOrigin);
    }
    this.validateOrderInput(input, settings.enabledChannels);
    const sku = (await this.listSkus(site.id, true)).find((item) => item.id === input.skuId);
    if (!sku) throw new Error('sku not found');
    const unit = cents(sku.price);
    const total = unit * input.quantity;
    const timestamp = nowIso();
    const orderPayload = {
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
      paymentStatus: 'PAYING' as const,
      fulfillmentStatus: 'WAIT_SHIP' as const,
      idempotencyKey: key || null,
    };
    if (!this.persistent) {
      const order: Order = {
        id: ++this.orderSeq,
        orderNo: this.nextOrderNo(),
        ...orderPayload,
        thirdPartyTradeNo: undefined,
        paidAt: undefined,
        logisticsCompany: undefined,
        logisticsNo: undefined,
        shippedAt: undefined,
        refundedAt: undefined,
        refundNote: undefined,
        refundMarkedBy: undefined,
        deletedAt: undefined,
        deletedBy: undefined,
        deletionReason: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.orders.unshift(order);
      if (key) this.idempotency.set(`${site.id}:${key}`, order.id);
      await this.log('order_created', `Order ${order.orderNo} created`, 'system', order.id);
      this.emit({ type: 'order_created', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
      return this.buildPayment(order, settings, requestOrigin);
    }
    const created = await prismaClient.order.create({
      data: {
        orderNo: this.nextOrderNo(),
        ...orderPayload,
      },
    });
    await this.log('order_created', `Order ${created.orderNo} created`, 'system', created.id);
    this.emit({ type: 'order_created', orderId: created.id, orderNo: created.orderNo, updatedAt: created.updatedAt.toISOString() });
    return this.buildPayment(mapOrderRecord(created), settings, requestOrigin);
  }

  async listOrders(filters: OrderFilters = {}): Promise<OrderListResult> {
    await this.ensureReady();
    const siteId = filters.siteId ?? (await this.store.getActiveSite()).id;
    const page = Math.max(1, Number(filters.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize ?? 20)));
    if (!this.persistent) {
      const items = this.filterOrdersSync(filters, siteId);
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
    }
    const where = this.buildOrderWhere(siteId, filters);
    const [total, rows] = await Promise.all([
      prismaClient.order.count({ where }),
      prismaClient.order.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { items: rows.map(mapOrderRecord), total, page, pageSize };
  }

  async getOrder(id: number) {
    await this.ensureReady();
    if (!this.persistent) {
      return this.orders.find((order) => order.id === id) ?? null;
    }
    const order = await prismaClient.order.findUnique({ where: { id } });
    return order ? mapOrderRecord(order) : null;
  }

  async getOrderTimeline(id: number) {
    await this.ensureReady();
    if (!this.persistent) {
      return this.logs.filter((log) => log.orderId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    const rows = await prismaClient.operationLog.findMany({ where: { orderId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(mapLogRecord);
  }

  async queryPublicOrder(orderNo: string, phone: string) {
    await this.ensureReady();
    if (!phonePattern.test(phone)) throw new Error('invalid phone');
    if (!this.persistent) {
      const order = this.orders.find((item) => item.orderNo === orderNo.trim() && item.phone === phone.trim() && !item.deletedAt);
      if (!order) return null;
      return { ...order, phone: maskPhone(order.phone), address: maskAddress(order.address) };
    }
    const order = await prismaClient.order.findFirst({ where: { orderNo: orderNo.trim(), phone: phone.trim(), deletedAt: null } });
    if (!order) return null;
    const mapped = mapOrderRecord(order);
    return { ...mapped, phone: maskPhone(mapped.phone), address: maskAddress(mapped.address) };
  }

  async getPaymentSuccessConfig(orderNo?: string) {
    await this.ensureReady();
    let siteId: number | undefined;
    if (orderNo?.trim()) {
      if (!this.persistent) siteId = this.orders.find((item) => item.orderNo === orderNo.trim())?.siteId;
      else siteId = (await prismaClient.order.findUnique({ where: { orderNo: orderNo.trim() }, select: { siteId: true } }))?.siteId;
    }
    const settings = await this.store.getSiteSettings(siteId);
    return {
      message: settings.paymentSuccessMessage || '添加客服领取服用说明',
      customerServiceUrl: settings.customerServiceUrl || '',
      customerServiceQrCode: settings.customerServiceQrCode,
    };
  }

  async shipOrder(id: number, logisticsCompany: string, logisticsNo: string, actor = 'admin') {
    await this.ensureReady();
    if (!logisticsCompany.trim() || !logisticsNo.trim()) throw new Error('logistics required');
    if (!this.persistent) {
      const order = await this.getOrder(id);
      if (!order || order.deletedAt) return null;
      if (order.fulfillmentStatus === 'SHIPPED') throw new Error('already shipped');
      order.logisticsCompany = logisticsCompany.trim();
      order.logisticsNo = logisticsNo.trim();
      order.shippedAt = nowIso();
      order.fulfillmentStatus = 'SHIPPED';
      order.updatedAt = nowIso();
      await this.log('order_shipped', `Order ${order.orderNo} shipped`, actor, id);
      this.emit({ type: 'order_shipped', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
      return order;
    }
    const current = await prismaClient.order.findUnique({ where: { id } });
    if (!current || current.deletedAt) return null;
    if (current.fulfillmentStatus === 'SHIPPED') throw new Error('already shipped');
    const updated = await prismaClient.order.update({
      where: { id: current.id },
      data: { logisticsCompany: logisticsCompany.trim(), logisticsNo: logisticsNo.trim(), shippedAt: new Date(), fulfillmentStatus: 'SHIPPED' },
    });
    await this.log('order_shipped', `Order ${updated.orderNo} shipped`, actor, id);
    this.emit({ type: 'order_shipped', orderId: updated.id, orderNo: updated.orderNo, updatedAt: updated.updatedAt.toISOString() });
    return mapOrderRecord(updated);
  }

  async markRefunded(id: number, note: string, actor = 'admin') {
    await this.ensureReady();
    if (!note.trim()) throw new Error('refund note required');
    if (!this.persistent) {
      const order = await this.getOrder(id);
      if (!order || order.deletedAt) return null;
      order.paymentStatus = 'REFUNDED';
      order.refundedAt = nowIso();
      order.refundNote = note.trim();
      order.refundMarkedBy = actor;
      order.updatedAt = nowIso();
      await this.log('refund_marked', `Order ${order.orderNo} refund marked`, actor, id);
      this.emit({ type: 'refund_marked', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
      return order;
    }
    const current = await prismaClient.order.findUnique({ where: { id } });
    if (!current || current.deletedAt) return null;
    const updated = await prismaClient.order.update({
      where: { id: current.id },
      data: { paymentStatus: 'REFUNDED', refundedAt: new Date(), refundNote: note.trim(), refundMarkedBy: actor },
    });
    await this.log('refund_marked', `Order ${updated.orderNo} refund marked`, actor, id);
    this.emit({ type: 'refund_marked', orderId: updated.id, orderNo: updated.orderNo, updatedAt: updated.updatedAt.toISOString() });
    return mapOrderRecord(updated);
  }

  async deleteOrder(id: number, reason: string, actor = 'admin') {
    await this.ensureReady();
    if (!reason.trim()) throw new Error('delete reason required');
    if (!this.persistent) {
      const order = await this.getOrder(id);
      if (!order || order.deletedAt) return null;
      const olderThan30Days = Date.now() - new Date(order.createdAt).getTime() >= 30 * 24 * 60 * 60 * 1000;
      if (!olderThan30Days && !order.refundedAt) throw new Error('delete condition not met');
      order.deletedAt = nowIso();
      order.deletedBy = actor;
      order.deletionReason = reason.trim();
      order.updatedAt = nowIso();
      await this.log('order_deleted', `Order ${order.orderNo} deleted`, actor, id);
      this.emit({ type: 'order_deleted', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
      return order;
    }
    const current = await prismaClient.order.findUnique({ where: { id } });
    if (!current || current.deletedAt) return null;
    const olderThan30Days = Date.now() - current.createdAt.getTime() >= 30 * 24 * 60 * 60 * 1000;
    if (!olderThan30Days && !current.refundedAt) throw new Error('delete condition not met');
    const updated = await prismaClient.order.update({
      where: { id: current.id },
      data: { deletedAt: new Date(), deletedBy: actor, deletionReason: reason.trim() },
    });
    await this.log('order_deleted', `Order ${updated.orderNo} deleted`, actor, id);
    this.emit({ type: 'order_deleted', orderId: updated.id, orderNo: updated.orderNo, updatedAt: updated.updatedAt.toISOString() });
    return mapOrderRecord(updated);
  }

  async handleNotify(raw: Record<string, string>): Promise<NotifyResult> {
    await this.ensureReady();
    const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, String(value)]));
    const settings = await this.loadPaymentSettingsState();
    const expected = signParams(params, settings.merchantSecret ?? '');
    if (!this.persistent) {
      const order = this.orders.find((item) => item.orderNo === params.out_trade_no);
      if (!order) return { ok: false, message: 'order not found' };
      if (params.pid !== settings.merchantId) return { ok: false, message: 'merchant mismatch' };
      if (params.sign !== expected) {
        await this.log('payment_notify', `Payment notify sign failed for ${order.orderNo}`, 'payment', order.id);
        return { ok: false, message: 'invalid sign' };
      }
      if (normalizeMoney(params.money ?? '0') !== order.totalAmount) return { ok: false, message: 'amount mismatch' };
      if (params.trade_status !== 'TRADE_SUCCESS') return { ok: false, message: 'not success' };
      if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') return { ok: true, order, changed: false };
      order.paymentStatus = 'PAID';
      order.thirdPartyTradeNo = params.trade_no;
      order.paidAt = nowIso();
      order.updatedAt = nowIso();
      await this.log('payment_paid', `Order ${order.orderNo} paid by notify`, 'payment', order.id, { tradeNo: params.trade_no, signOk: true });
      this.emit({ type: 'payment_paid', orderId: order.id, orderNo: order.orderNo, updatedAt: order.updatedAt });
      return { ok: true, order, changed: true };
    }
    const order = await prismaClient.order.findUnique({ where: { orderNo: params.out_trade_no } });
    if (!order) return { ok: false, message: 'order not found' };
    if (params.pid !== settings.merchantId) return { ok: false, message: 'merchant mismatch' };
    if (params.sign !== expected) {
      await this.log('payment_notify', `Payment notify sign failed for ${order.orderNo}`, 'payment', order.id);
      return { ok: false, message: 'invalid sign' };
    }
    if (normalizeMoney(params.money ?? '0') !== mapOrderRecord(order).totalAmount) return { ok: false, message: 'amount mismatch' };
    if (params.trade_status !== 'TRADE_SUCCESS') return { ok: false, message: 'not success' };
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED') return { ok: true, order: mapOrderRecord(order), changed: false };
    const updated = await prismaClient.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', thirdPartyTradeNo: params.trade_no, paidAt: new Date() } });
    await this.log('payment_paid', `Order ${updated.orderNo} paid by notify`, 'payment', updated.id, { tradeNo: params.trade_no, signOk: true });
    this.emit({ type: 'payment_paid', orderId: updated.id, orderNo: updated.orderNo, updatedAt: updated.updatedAt.toISOString() });
    return { ok: true, order: mapOrderRecord(updated), changed: true };
  }

  async getPaymentSettings(): Promise<PaymentSettings> {
    await this.ensureReady();
    const state = await this.loadPaymentSettingsState();
    return {
      gatewayUrl: state.gatewayUrl,
      merchantId: state.merchantId,
      enabledChannels: state.enabledChannels,
      notifyUrl: state.notifyUrl,
      returnUrl: state.returnUrl,
      secretMasked: maskSecret(state.merchantSecret ?? ''),
      updatedAt: state.updatedAt,
    };
  }

  async updatePaymentSettings(input: PaymentSettingsInput, actor = 'admin') {
    await this.ensureReady();
    if (!this.persistent) {
      this.paymentSettings = {
        gatewayUrl: input.gatewayUrl.trim(),
        merchantId: input.merchantId.trim(),
        merchantSecret: input.merchantSecret?.trim() || this.paymentSettings.merchantSecret,
        enabledChannels: input.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wxpay'),
        notifyUrl: input.notifyUrl.trim(),
        returnUrl: input.returnUrl.trim(),
        updatedAt: nowIso(),
      };
      await this.log('payment_settings_updated', 'Payment settings updated', actor);
      return this.getPaymentSettings();
    }
    const current = await prismaClient.paymentSettings.findFirst();
    const updated = await prismaClient.paymentSettings.upsert({
      where: { id: current?.id ?? 0 },
      update: {
        gatewayUrl: input.gatewayUrl.trim(),
        merchantId: input.merchantId.trim(),
        encryptedSecret: input.merchantSecret ? encodeSecret(input.merchantSecret.trim()) : current?.encryptedSecret ?? encodeSecret(this.paymentSettings.merchantSecret ?? ''),
        enabledChannels: input.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wxpay'),
        notifyUrl: input.notifyUrl.trim(),
        returnUrl: input.returnUrl.trim(),
      },
      create: {
        gatewayUrl: input.gatewayUrl.trim(),
        merchantId: input.merchantId.trim(),
        encryptedSecret: encodeSecret(input.merchantSecret ?? this.paymentSettings.merchantSecret ?? ''),
        enabledChannels: input.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wxpay'),
        notifyUrl: input.notifyUrl.trim(),
        returnUrl: input.returnUrl.trim(),
      },
    });
    await this.log('payment_settings_updated', 'Payment settings updated', actor);
    return mapPaymentSettingsRecord(updated);
  }

  async exportOrders(filters: OrderFilters, columns: string[]) {
    await this.ensureReady();
    const allowed: Record<string, string> = {
      orderNo: '订单号', productName: '商品名称', recipientName: '姓名', phone: '手机号', address: '地址', skuName: '规格', quantity: '数量', unitAmount: '单价', totalAmount: '成交金额', paymentChannel: '支付渠道', paymentStatus: '支付状态', fulfillmentStatus: '履约状态', logisticsCompany: '物流公司', logisticsNo: '物流单号', createdAt: '创建时间', paidAt: '支付时间', shippedAt: '发货时间', refundedAt: '退款时间', refundNote: '退款备注',
    };
    const picked = columns.length ? columns : ['orderNo', 'recipientName', 'phone', 'address', 'skuName', 'quantity', 'totalAmount', 'paymentStatus', 'fulfillmentStatus', 'createdAt'];
    // 用 hasOwnProperty 而不是真值判断：否则 __proto__ / constructor 等原型链上的键会绕过校验
    if (picked.some((column) => !Object.prototype.hasOwnProperty.call(allowed, column))) throw new Error('invalid export column');
    const rows = this.persistent ? await this.listOrderRows(filters) : this.filterOrdersSync(filters, filters.siteId ?? (await this.store.getActiveSite()).id);
    const sheetRows = [picked.map((column) => allowed[column])].concat(rows.map((order) => picked.map((column) => escapeCell((order as any)[column]))));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Orders');
    await this.log('orders_exported', `Exported ${rows.length} orders`, 'admin', undefined, { columns: picked, count: rows.length, timeZone: shanghaiTimeZone });
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async addClient(res: Response) {
    this.clients.add(res);
    res.on('close', () => this.clients.delete(res));
  }

  async mockNotifyParams(orderNo: string, tradeNo = `MOCK${Date.now()}`) {
    await this.ensureReady();
    const settings = await this.loadPaymentSettingsState();
    const order = this.persistent
      ? mapOrderRecord((await prismaClient.order.findFirst({ where: { orderNo } })) ?? (() => { throw new Error('order not found'); })())
      : this.orders.find((item) => item.orderNo === orderNo);
    if (!order) throw new Error('order not found');
    const params = { pid: settings.merchantId, trade_no: tradeNo, out_trade_no: order.orderNo, type: order.paymentChannel, name: order.skuName, money: order.totalAmount, trade_status: 'TRADE_SUCCESS' };
    return { ...params, sign: signParams(params, settings.merchantSecret ?? ''), sign_type: 'MD5' };
  }

  private async loadPaymentSettingsState(): Promise<PaymentSettingsInput & { updatedAt: string }> {
    if (!this.persistent) return this.paymentSettings;
    const existing = await prismaClient.paymentSettings.findFirst();
    if (existing) {
      return {
        gatewayUrl: existing.gatewayUrl,
        merchantId: existing.merchantId,
        merchantSecret: decodeSecret(existing.encryptedSecret),
        enabledChannels: Array.isArray(existing.enabledChannels) ? existing.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wxpay') : ['alipay', 'wxpay'],
        notifyUrl: existing.notifyUrl,
        returnUrl: existing.returnUrl,
        updatedAt: existing.updatedAt.toISOString(),
      };
    }
    const created = await prismaClient.paymentSettings.create({
      data: {
        gatewayUrl: this.paymentSettings.gatewayUrl,
        merchantId: this.paymentSettings.merchantId,
        encryptedSecret: encodeSecret(this.paymentSettings.merchantSecret ?? ''),
        enabledChannels: this.paymentSettings.enabledChannels,
        notifyUrl: this.paymentSettings.notifyUrl,
        returnUrl: this.paymentSettings.returnUrl,
      },
    });
    return {
      gatewayUrl: created.gatewayUrl,
      merchantId: created.merchantId,
      merchantSecret: decodeSecret(created.encryptedSecret),
      enabledChannels: Array.isArray(created.enabledChannels) ? created.enabledChannels.filter((item): item is PaymentChannel => item === 'alipay' || item === 'wxpay') : ['alipay', 'wxpay'],
      notifyUrl: created.notifyUrl,
      returnUrl: created.returnUrl,
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  private normalizeSkuInput(input: ProductSkuInput): ProductSkuInput {
    if (!input.skuCode.trim() || !input.name.trim()) throw new Error('sku required');
    return { ...input, skuCode: input.skuCode.trim(), name: input.name.trim(), subtitle: input.subtitle.trim(), price: normalizeMoney(input.price), originalPrice: normalizeMoney(input.originalPrice), saleLabel: input.saleLabel.trim() || '券后价', highlight: input.highlight?.trim(), enabled: Boolean(input.enabled), sortOrder: Number(input.sortOrder) || 0 };
  }

  private validateOrderInput(input: CreateOrderInput, enabledChannels = this.paymentSettings.enabledChannels) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > maxQuantity) throw new Error('invalid quantity');
    if (!phonePattern.test(input.phone.trim())) throw new Error('invalid phone');
    if (!input.recipientName.trim() || !input.address.trim()) throw new Error('recipient required');
    if (!['alipay', 'wxpay'].includes(input.paymentChannel)) throw new Error('invalid payment channel');
    if (!enabledChannels.includes(input.paymentChannel)) throw new Error('payment channel disabled');
  }

  private buildPayment(order: Order, settings = this.paymentSettings, requestOrigin?: string) {
    const params = { pid: settings.merchantId, type: order.paymentChannel, out_trade_no: order.orderNo, notify_url: resolveNotifyUrl(settings.notifyUrl, requestOrigin), name: order.skuName, money: order.totalAmount, return_url: resolveReturnUrl(settings.returnUrl, requestOrigin, order.orderNo) };
    const signed = { ...params, sign: signParams(params, settings.merchantSecret ?? ''), sign_type: 'MD5' };
    const query = new URLSearchParams(signed).toString();
    return { order, paymentUrl: `${settings.gatewayUrl}?${query}`, params: signed };
  }

  private nextOrderNo() {
    const date = new Date();
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: shanghaiTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replace(/-/g, '');
    return `SO${stamp}${String(++this.orderSeq).padStart(6, '0')}${randomUUID().slice(0, 4).toUpperCase()}`;
  }

  private async log(action: string, summary: string, actor: string, orderId?: number, meta?: Record<string, unknown>) {
    if (!this.persistent) {
      this.logs.push({ id: this.logSeq++, action, summary, actor, orderId, meta, createdAt: nowIso() });
      return;
    }
    const orderSite = orderId ? await prismaClient.order.findUnique({ where: { id: orderId }, select: { siteId: true } }) : null;
    const siteId = orderSite?.siteId ?? (await this.store.getActiveSite()).id;
    const created = await prismaClient.operationLog.create({
      data: { siteId, orderId: orderId ?? null, action, summary, actor, meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined },
    });
    this.logs.push({ id: created.id, action: created.action, summary: created.summary, actor: created.actor, orderId: created.orderId ?? undefined, meta: (created.meta as Record<string, unknown> | null) ?? undefined, createdAt: created.createdAt.toISOString() });
  }

  private emit(event: OrderEvent) {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) client.write(payload);
  }

  private async listOrderRows(filters: OrderFilters = {}) {
    const siteId = filters.siteId ?? (await this.store.getActiveSite()).id;
    const where = this.buildOrderWhere(siteId, filters);
    const rows = await prismaClient.order.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(mapOrderRecord);
  }

  private buildOrderWhere(siteId: number, filters: OrderFilters = {}) {
    const start = parseDate(filters.startAt);
    const end = parseDate(filters.endAt);
    const query = filters.query?.trim();
    const where: Record<string, unknown> = { siteId };
    if ((filters.deletedStatus ?? 'active') === 'active') where.deletedAt = null;
    if (filters.deletedStatus === 'deleted') where.deletedAt = { not: null };
    if (filters.paymentStatus && filters.paymentStatus !== 'all') where.paymentStatus = filters.paymentStatus;
    if (filters.fulfillmentStatus && filters.fulfillmentStatus !== 'all') where.fulfillmentStatus = filters.fulfillmentStatus;
    if (filters.refundStatus === 'refunded') where.refundedAt = { not: null };
    if (filters.refundStatus === 'not_refunded') where.refundedAt = null;
    if (filters.skuId) where.skuId = filters.skuId;
    if (start || end) where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) };
    if (query) where.OR = [{ orderNo: { contains: query, mode: 'insensitive' } }, { phone: { contains: query, mode: 'insensitive' } }, { recipientName: { contains: query, mode: 'insensitive' } }];
    return where;
  }

  private filterOrdersSync(filters: OrderFilters = {}, siteId?: number) {
    const start = parseDate(filters.startAt);
    const end = parseDate(filters.endAt);
    return this.orders.filter((order) => {
      if (siteId && order.siteId !== siteId) return false;
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
