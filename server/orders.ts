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

function signParams(params: Record<string, string>, secret: string) {
  const base = Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'sign_type' && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('md5').update(`${base}${secret}`).digest('hex');
}

function maskSecret(secret: string) {
  if (!secret) return '';
  if (secret.length <= 6) return '******';
  return `${secret.slice(0, 3)}******${secret.slice(-3)}`;
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
  private skuSignatures = new Map<number, string>();
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

  async ensureSiteSkus(siteId?: number) {
    const site = siteId ? undefined : await this.store.getActiveSite();
    const resolvedSiteId = siteId ?? site!.id;
    const bootstrap = await this.store.getBootstrap(resolvedSiteId);
    const variants = bootstrap.settings.productVariants;
    const signature = JSON.stringify(variants);
    if (!this.skus.has(resolvedSiteId)) {
      const timestamp = nowIso();
      this.skus.set(resolvedSiteId, variants.map((variant, index) => mapVariantToSku(variant, resolvedSiteId, index, timestamp)));
      this.skuSeq = Math.max(this.skuSeq, ...this.skus.get(resolvedSiteId)!.map((item) => item.id)) + 1;
      this.skuSignatures.set(resolvedSiteId, signature);
    } else if (this.skuSignatures.get(resolvedSiteId) !== signature) {
      const current = this.skus.get(resolvedSiteId)!;
      const timestamp = nowIso();
      const byCode = new Map(current.map((sku) => [sku.skuCode, sku]));
      const next = variants.map((variant, index) => {
        const existing = byCode.get(variant.id);
        const mapped = mapVariantToSku(variant, resolvedSiteId, index, timestamp);
        return existing ? { ...mapped, id: existing.id, enabled: existing.enabled, createdAt: existing.createdAt } : mapped;
      });
      this.skus.set(resolvedSiteId, next);
      this.skuSignatures.set(resolvedSiteId, signature);
    }
    return this.skus.get(resolvedSiteId)!;
  }

  async listSkus(siteId?: number, enabledOnly = false) {
    const skus = await this.ensureSiteSkus(siteId);
    return skus.filter((sku) => !enabledOnly || sku.enabled).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  async createSku(input: ProductSkuInput, actor = 'admin') {
    const site = await this.store.getActiveSite();
    const skus = await this.ensureSiteSkus(site.id);
    if (skus.some((sku) => sku.skuCode === input.skuCode.trim())) throw new Error('sku code exists');
    const timestamp = nowIso();
    const sku: ProductSku = { ...this.normalizeSkuInput(input), id: this.skuSeq++, siteId: site.id, createdAt: timestamp, updatedAt: timestamp };
    skus.push(sku);
    this.log('sku_created', `SKU ${sku.skuCode} created`, actor, undefined, { skuId: sku.id });
    return sku;
  }

  async updateSku(id: number, input: ProductSkuInput, actor = 'admin') {
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

  async disableSku(id: number, actor = 'admin') {
    const site = await this.store.getActiveSite();
    const skus = await this.ensureSiteSkus(site.id);
    const index = skus.findIndex((sku) => sku.id === id);
    if (index < 0) return false;
    skus[index] = { ...skus[index], enabled: false, updatedAt: nowIso() };
    this.log('sku_disabled', `SKU ${skus[index].skuCode} disabled`, actor, undefined, { skuId: id });
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

  getPaymentSettings(): PaymentSettings {
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

  updatePaymentSettings(input: PaymentSettingsInput, actor = 'admin') {
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
