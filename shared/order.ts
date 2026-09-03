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
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
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
