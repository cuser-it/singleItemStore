export type ProductSku = {
  id: number;
  siteId: number;
  skuCode: string;
  name: string;
  subtitle: string;
  price: string;
  originalPrice: string;
  saleLabel: string;
  highlight?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductSkuInput = {
  skuCode: string;
  name: string;
  subtitle: string;
  price: string;
  originalPrice: string;
  saleLabel: string;
  highlight?: string;
  enabled: boolean;
  sortOrder: number;
};

export type PaymentStatus = 'UNPAID' | 'PAYING' | 'PAID' | 'PAYMENT_FAILED' | 'REFUNDED';
export type FulfillmentStatus = 'WAIT_SHIP' | 'SHIPPED';
export type PaymentChannel = 'alipay' | 'wxpay';

export type Order = {
  id: number;
  orderNo: string;
  siteId: number;
  skuId: number | null;
  skuCode: string;
  skuName: string;
  productName: string;
  quantity: number;
  unitAmount: string;
  totalAmount: string;
  recipientName: string;
  phone: string;
  address: string;
  paymentChannel: PaymentChannel;
  paymentStatus: PaymentStatus;
  thirdPartyTradeNo?: string;
  paidAt?: string;
  fulfillmentStatus: FulfillmentStatus;
  logisticsCompany?: string;
  logisticsNo?: string;
  shippedAt?: string;
  refundedAt?: string;
  refundNote?: string;
  refundMarkedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  /** 下单幂等键（仅内存模式下随订单一起保存，Prisma 模式存于数据库列） */
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
  siteId?: number;
  skuId: number;
  quantity: number;
  recipientName: string;
  phone: string;
  address: string;
  paymentChannel: PaymentChannel;
  idempotencyKey?: string;
};

export type PaymentCreateResult = {
  order: Order;
  paymentUrl: string;
  params: Record<string, string>;
};

export type OrderFilters = {
  siteId?: number;
  page?: number;
  pageSize?: number;
  query?: string;
  paymentStatus?: PaymentStatus | 'all';
  fulfillmentStatus?: FulfillmentStatus | 'all';
  refundStatus?: 'all' | 'refunded' | 'not_refunded';
  deletedStatus?: 'active' | 'deleted' | 'all';
  skuId?: number;
  startAt?: string;
  endAt?: string;
};

export type OrderListResult = {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
};

export type OrderTimelineItem = {
  id: number;
  action: string;
  summary: string;
  actor: string;
  createdAt: string;
};

export type PaymentSettings = {
  gatewayUrl: string;
  merchantId: string;
  enabledChannels: PaymentChannel[];
  notifyUrl: string;
  returnUrl: string;
  /**
   * 站点的公网访问地址（如 https://shop.example.com 或 http://1.2.3.4:3001）。
   * 支付网关的异步回调由网关服务器发起，必须能从公网访问到本服务，
   * 因此部署后在后台填写一次即可，无需修改代码。留空则回退为买家下单时访问的域名。
   */
  publicBaseUrl: string;
  secretMasked: string;
  updatedAt: string;
};

export type PaymentSettingsInput = Omit<PaymentSettings, 'secretMasked' | 'updatedAt'> & {
  merchantSecret?: string;
};

export type OrderEvent = {
  type: 'order_created' | 'payment_paid' | 'order_shipped' | 'refund_marked' | 'order_deleted';
  orderId: number;
  orderNo: string;
  updatedAt: string;
};
