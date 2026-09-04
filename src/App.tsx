import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  Menu,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  Checkbox,
} from 'antd';
import { OrderExportModal } from './components/OrderExportModal';
import { CheckoutSheet, clampCheckoutQuantity, type CheckoutRecipient } from './components/CheckoutSheet';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  BellOutlined,
  EditOutlined,
  FileImageOutlined,
  FormOutlined,
  LogoutOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  TagsOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  type AdminBootstrap,
  type FloatingPurchase,
  type MediaAsset,
  type MediaSection,
  type PublicBootstrap,
  type Review,
  type Site,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from '../shared/site';
import type { Order, PaymentSettings, ProductSku, ProductSkuInput } from '../shared/order';
import PaymentSuccess from './PaymentSuccess';
import {
  activateSite,
  createFloatingPurchase,
  createMediaAsset,
  createReview,
  createSite,
  deleteFloatingPurchase,
  deleteMediaAsset,
  deleteReview,
  deleteSite,
  fetchAdminBootstrap,
  fetchAdminMe,
  fetchPublicBootstrap,
  loginAdmin,
  logoutAdmin,
  saveSiteSettings,
  updateFloatingPurchase,
  updateMediaAsset,
  updateReview,
  updateSite,
  uploadAsset,
  createSku,
  updateSku,
  deleteSku,
  createOrder,
  queryPublicOrder,
  fetchAdminSkus,
  fetchAdminOrders,
  fetchPaymentSettings,
  savePaymentSettings,
  shipOrder,
  markOrderRefunded,
  softDeleteOrder,
  exportOrders,
} from './api';
import { useAdminRouter, getPageKey, ADMIN_ROUTES } from './AdminRouter';

export function formatPaymentStatus(value: string) {
  const labels: Record<string, string> = {
    UNPAID: '待支付',
    PAYING: '支付中',
    PAID: '已支付',
    PAYMENT_FAILED: '支付失败',
    REFUNDED: '已退款',
  };

  return labels[value] ?? '未知状态';
}

export function formatFulfillmentStatus(value: string) {
  const labels: Record<string, string> = {
    WAIT_SHIP: '待发货',
    SHIPPED: '已发货',
  };

  return labels[value] ?? '未知状态';
}

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return pathname;
}


function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <button className={open ? 'sheet-mask sheet-mask--show' : 'sheet-mask'} type="button" hidden={!open} onClick={onClose} aria-label={`关闭${title}`} />
      <aside className={open ? 'sheet sheet--open' : 'sheet'} aria-hidden={!open} aria-label={title}>
        <header className="sheet__header">
          <div className="sheet__title">{title}</div>
          <button className="sheet__close" type="button" onClick={onClose} aria-label={`关闭${title}`}>
            ×
          </button>
        </header>
        {children}
      </aside>
    </>
  );
}

function PriceBanner({ sku }: { sku: { id: string; name: string; subtitle: string; price: number; originalPrice: number; saleLabel: string; highlight?: string } }) {
  return (
    <section className="price-bar" aria-label="价格横幅">
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="104" viewBox="0 0 600 104" role="img" aria-labelledby="price-title price-desc">
        <title id="price-title">价格促销栏</title>
        <desc id="price-desc">深紫色与粉色叠加的价格栏</desc>
        <rect width="600" height="104" fill="#3510A8" />
        <path d="M390 2H600V102H420Z" fill="#ED008C" />
        <path d="M0 2H420L390 102H0Z" fill="#4300E8" />
        <g fill="#FFFFFF" fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <text x="19" y="40" fontSize="18" fontWeight="700">
            原价
          </text>
          <text x="19" y="79" fontSize="22" fontWeight="700">
            ¥{sku.originalPrice.toFixed(1)}
          </text>
        </g>
        <g fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <rect x="120" y="18" width="114" height="29" rx="15" fill="#FF3A68" />
          <text x="177" y="38" fill="#FFFFFF" fontSize="16" fontWeight="700" textAnchor="middle">
            {sku.highlight ?? '50000+已售'}
          </text>
          <rect x="120" y="53" width="130" height="34" rx="17" fill="#FFFFFF" />
          <text x="185" y="76" fill="#FF315F" fontSize="16" fontWeight="700" textAnchor="middle">
            {sku.saleLabel}¥{sku.price.toFixed(1)}
          </text>
        </g>
        <g fill="#FFFFFF" textAnchor="middle" fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <text x="486" y="42" fontSize="26" fontWeight="700">
            限时价
          </text>
          <text x="486" y="64" fontSize="15" fontWeight="700">
            立即下单
          </text>
          <text x="486" y="84" fontSize="15" fontWeight="700">
            正品保障
          </text>
        </g>
      </svg>
    </section>
  );
}

function titleText(settings: SiteSettings) {
  return settings.title || settings.shopName;
}

// 生成随机头像 URL
function getRandomAvatar(seed: string | number) {
  const avatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=',
    'https://api.dicebear.com/7.x/bottts/svg?seed=',
    'https://api.dicebear.com/7.x/initials/svg?seed=',
  ];
  const randomIndex = (typeof seed === 'string' ? seed.charCodeAt(0) : seed) % avatars.length;
  return `${avatars[randomIndex]}${seed}`;
}

function DRu() {
  const pathname = usePathname();
  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [loadError, setLoadError] = useState('');
  const [slide, setSlide] = useState(0);
  const [selectedSkuId, setSelectedSkuId] = useState('single');
  const [quantity, setQuantity] = useState(1);
  const [checkoutPayment, setCheckoutPayment] = useState<'wxpay' | 'alipay'>('wxpay');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [purchaseIndex, setPurchaseIndex] = useState(0);
  const [queryOrderNo, setQueryOrderNo] = useState('');
  const [queryPhone, setQueryPhone] = useState('');
  const [queriedOrder, setQueriedOrder] = useState<Order | null>(null);
  const [reviewLikes, setReviewLikes] = useState<Record<number, number>>();

  // 从 URL 中提取 slug（如 /shop-a）
  const slug = pathname === '/' ? undefined : pathname.slice(1);

  useEffect(() => {
    let active = true;
    fetchPublicBootstrap(slug)
      .then((data) => {
        if (!active) return;
        setBootstrap(data);
        setSelectedSkuId(data.skus?.[0]?.skuCode ?? 'single');
        setLoadError('');
        // 初始化点赞数据
        const initialLikes: Record<number, number> = {};
        data.allReviews.forEach((review) => {
          initialLikes[review.id] = Math.floor(Math.random() * 50) + 10; // 随机10-60个赞
        });
        setReviewLikes(initialLikes);
      })
      .catch(() => {
        if (active) setLoadError('前台数据加载失败，请刷新后重试');
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!bootstrap?.heroImages.length) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % bootstrap.heroImages.length), 2500);
    return () => window.clearInterval(timer);
  }, [bootstrap?.heroImages.length]);

  useEffect(() => {
    if (!bootstrap?.floatingPurchases.length) return;
    const timer = window.setInterval(() => setPurchaseIndex((current) => (current + 1) % bootstrap.floatingPurchases.length), 2100);
    return () => window.clearInterval(timer);
  }, [bootstrap?.floatingPurchases.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle('body-locked', reviewOpen || checkoutOpen);
    return () => document.body.classList.remove('body-locked');
  }, [reviewOpen, checkoutOpen]);

  if (loadError) {
    return (
      <div className="store-page">
        <div className="admin-loading">
          <Alert type="error" message="前台加载失败" description={loadError} showIcon />
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="store-page">
        <div className="admin-loading">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  const settings = bootstrap.settings;
  const liveSkus = bootstrap.skus ?? [];
  const selectedSkuRecord = liveSkus.find((sku) => sku.skuCode === selectedSkuId) ?? liveSkus[0];
  const selectedSku = selectedSkuRecord ? {
    id: selectedSkuRecord.skuCode,
    name: selectedSkuRecord.name,
    subtitle: selectedSkuRecord.subtitle,
    price: Number(selectedSkuRecord.price),
    originalPrice: Number(selectedSkuRecord.originalPrice),
    saleLabel: selectedSkuRecord.saleLabel,
    highlight: selectedSkuRecord.highlight,
  } : {
    id: 'single',
    name: settings.title || settings.shopName,
    subtitle: settings.subtitle,
    price: 99,
    originalPrice: 299,
    saleLabel: '券后价',
  };
  const reviewTags = settings.reviewTags;
  const heroImages = bootstrap.heroImages;
  const detailImages = bootstrap.detailImages;
  const reviews = bootstrap.reviews;
  const allReviews = bootstrap.allReviews;
  const floatingPurchases = bootstrap.floatingPurchases;
  const latestItems = floatingPurchases.slice(0, 8);
  const floatingItem = latestItems[purchaseIndex % latestItems.length] ?? null;

  const showToast = (message = '订单操作完成') => setToast(message);
  
  const handleReviewLike = (reviewId: number) => {
    setReviewLikes((prev) => {
      if (!prev) return prev;
      return { ...prev, [reviewId]: (prev[reviewId] ?? 0) + 1 };
    });
  };

  const handleCheckoutSubmit = async (recipient: CheckoutRecipient) => {
    const sku = bootstrap.skus?.find((item) => item.skuCode === selectedSku.id);
    if (!sku) {
      showToast('当前规格暂不可下单');
      return;
    }
    // 只提交 skuId 与数量，金额由后台按 SKU 单价重新计算并在支付回调中校验
    setCheckoutSubmitting(true);
    try {
      const result = await createOrder({
        siteId: bootstrap.site.id,
        skuId: sku.id,
        quantity: clampCheckoutQuantity(quantity),
        recipientName: recipient.recipientName,
        phone: recipient.phone,
        address: recipient.address,
        paymentChannel: checkoutPayment,
      });
      setCheckoutOpen(false);
      showToast(`订单 ${result.order.orderNo} 已创建，正在打开支付`);
      window.open(result.paymentUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '订单提交失败');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const handlePublicOrderQuery = async () => {
    try {
      const order = await queryPublicOrder(queryOrderNo, queryPhone);
      setQueriedOrder(order);
      showToast('订单查询成功');
    } catch (error) {
      setQueriedOrder(null);
      showToast(error instanceof Error ? error.message : '订单查询失败');
    }
  };

  return (
    <div className="store-page">
      <main>
        <section className="hero" aria-label="商品图片">
          <div className="slides" style={{ transform: `translateX(${-100 * slide}%)` }}>
            {heroImages.map((image) => (
              <div className="slide" key={image.id}>
                <img src={image.resolvedUrl} alt={image.alt} draggable={false} />
              </div>
            ))}
          </div>
          <div className="dots" aria-hidden="true">
            {heroImages.map((image, index) => (
              <button key={image.id} className={index === slide ? 'dot active' : 'dot'} type="button" onClick={() => setSlide(index)} aria-label={`切换到第${index + 1}张`} />
            ))}
          </div>
        </section>

        <PriceBanner sku={selectedSku} />

        <section className="card pad product-hero">
          <div className="product-hero__top">
            <span className="official">商城官方自营</span>
            <span>{settings.serviceNote}</span>
          </div>
          <h1 className="title">{titleText(settings)}</h1>

        </section>

        <section className="card info-card" aria-label="商品说明">
          <div className="info-row">
            <b>产品描述</b>
            <span>{settings.productDescription}</span>
          </div>
          <div className="info-row">
            <b>邮费说明</b>
            <span>{settings.shippingNote}</span>
          </div>
          <div className="info-row">
            <b>温馨提示</b>
            <span>{settings.reminder}</span>
          </div>
          <div className="info-row">
            <b>发货时间</b>
            <span>{settings.shippingTime}</span>
          </div>
        </section>

        <section className="card" id="review-card">
          <button className="review-head" type="button" onClick={() => setReviewOpen(true)}>
            <b>宝贝评价(999+)</b>
            <span>查看全部 &gt;</span>
          </button>
          <div className="tags">
            {reviewTags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
          {reviews.map((review) => (
            <article className="review" key={review.id}>
              <div className="reviewer" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src={getRandomAvatar(review.id)} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0 }} />
                <span>{review.name}</span>
              </div>
              <p>{review.content}</p>
              <div className="review-photos">
                {review.images.map((image, index) => (
                  <img src={image} alt={`${review.name}评价图${index + 1}`} key={`${review.id}-${index}`} loading="lazy" />
                ))}
              </div>
            </article>
          ))}
        </section>

        <div className="section-title">产品详情</div>
        <section className="detail-images">
          {detailImages.map((image, index) => (
            <p key={image.id}>
              <img src={image.resolvedUrl} alt={`详情图${index + 1}`} loading="lazy" />
            </p>
          ))}
        </section>

        <section className="card">
          <div className="buy-title">最新抢购</div>
          <div className="orders">
            <ul>
              {latestItems.map((item, index) => (
                <li key={`${item.id}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={getRandomAvatar(`${item.id}-${index}`)} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0 }} />
                  <span>{item.content}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card pad order-query-card" style={{ marginBottom: '40px' }}>
          <div className="buy-title" style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>订单查询</div>
          <div className="order-query-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input value={queryOrderNo} onChange={(event) => setQueryOrderNo(event.target.value)} placeholder="请输入订单号" style={{ padding: '12px 16px', fontSize: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            <input value={queryPhone} onChange={(event) => setQueryPhone(event.target.value)} inputMode="tel" maxLength={11} placeholder="请输入收货手机号" style={{ padding: '12px 16px', fontSize: '16px', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
            <button type="button" onClick={() => void handlePublicOrderQuery()} style={{ padding: '12px', fontSize: '16px', fontWeight: 'bold', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>查询订单</button>
          </div>
          {queriedOrder && (
            <div className="order-query-result" style={{ marginTop: '24px', padding: '20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>订单号</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>{queriedOrder.orderNo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>下单时间</span>
                  <span style={{ fontSize: '14px' }}>{new Date(queriedOrder.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>支付金额</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#f5222d' }}>¥{queriedOrder.totalAmount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>订单状态</span>
                  <span style={{ fontSize: '14px', padding: '4px 12px', borderRadius: '12px', background: queriedOrder.paymentStatus === 'PAID' ? '#f6ffed' : '#fff7e6', color: queriedOrder.paymentStatus === 'PAID' ? '#52c41a' : '#fa8c16', fontWeight: 'bold' }}>
                    {queriedOrder.paymentStatus === 'PAID' ? '已支付' : queriedOrder.paymentStatus === 'PAYING' ? '支付中' : queriedOrder.paymentStatus === 'REFUNDED' ? '已退款' : '待支付'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>收件人</span>
                  <span style={{ fontSize: '14px' }}>{queriedOrder.recipientName}</span>
                </div>
                {queriedOrder.fulfillmentStatus === 'SHIPPED' && queriedOrder.logisticsNo && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '14px', color: '#666' }}>物流单号</span>
                    <span style={{ fontSize: '14px', color: '#1890ff', cursor: 'pointer', userSelect: 'all' }} onClick={() => { navigator.clipboard.writeText(queriedOrder.logisticsNo ?? '').then(() => showToast('物流单号已复制')).catch(() => {}); }}>
                      {queriedOrder.logisticsCompany ?? ''} {queriedOrder.logisticsNo}
                    </span>
                  </div>
                )}
                {queriedOrder.fulfillmentStatus === 'WAIT_SHIP' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '14px', color: '#666' }}>发货状态</span>
                    <span style={{ fontSize: '14px', color: '#fa8c16' }}>待发货</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <div className="purchase-feed" aria-live="polite">
        <p className="purchase-item active" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {floatingItem && (
            <>
              <img 
                src={getRandomAvatar(`floating-${floatingItem.id || purchaseIndex}`)} 
                alt="" 
                style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0 }} 
              />
              <span>{floatingItem.content}</span>
            </>
          )}
          {!floatingItem && floatingPurchases[0] && (
            <>
              <img 
                src={getRandomAvatar(`floating-${floatingPurchases[0].id || 0}`)} 
                alt="" 
                style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0 }} 
              />
              <span>{floatingPurchases[0].content}</span>
            </>
          )}
        </p>
      </div>

      <Sheet open={reviewOpen} title="商品评论" onClose={() => setReviewOpen(false)}>
        <div className="review-sheet-body">
          <div className="review-title-container">宝贝评价(999+)</div>
          <div className="review-tag-container">
            {reviewTags.map((tag) => (
              <div className="review-tag-item" key={tag}>
                {tag}
              </div>
            ))}
          </div>
          <div className="review-item-container">
            {allReviews.map((review) => (
              <div className="review-item-content" key={review.id}>
                <div className="reviewer-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={getRandomAvatar(review.id)} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0 }} />
                    <div>
                      <div className="reviewer-name">{review.name}</div>
                      <div className="reviewer-sub" style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                        {new Date(review.createdAt || Date.now()).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleReviewLike(review.id)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      padding: '4px 8px', 
                      background: '#f5f5f5', 
                      border: 'none', 
                      borderRadius: '12px', 
                      fontSize: '12px', 
                      color: '#666',
                      cursor: 'pointer'
                    }}
                  >
                    <span>👍</span>
                    <span>{reviewLikes?.[review.id] ?? 0}</span>
                  </button>
                </div>
                <div className="context-text">{review.content}</div>
                <div className="sheet-review-image-row">
                  {review.images[0] ? <img src={review.images[0]} alt={`${review.name}图片评论`} /> : null}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#999' }}>
            仅展示最近10条评论
          </div>
        </div>
      </Sheet>

      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={titleText(settings)}
        shopName={settings.shopName}
        heroImage={heroImages[0] ? { url: heroImages[0].resolvedUrl, alt: heroImages[0].alt } : null}
        skus={liveSkus}
        selectedSkuCode={selectedSku.id}
        onSelectSku={setSelectedSkuId}
        quantity={quantity}
        onQuantityChange={(next) => setQuantity(clampCheckoutQuantity(next))}
        guarantee={settings.guarantee}
        serviceNote={settings.serviceNote}
        shippingNote={settings.shippingNote}
        shippingTime={settings.shippingTime}
        paymentChannel={checkoutPayment}
        onPaymentChannelChange={setCheckoutPayment}
        onSubmit={handleCheckoutSubmit}
        submitting={checkoutSubmitting}
      />

      <nav className="bottom-bar">
        <button className="buy-now" type="button" onClick={() => setCheckoutOpen(true)}>
          立即发货
        </button>
      </nav>
      <div className={toast ? 'toast show' : 'toast'}>{toast || '已为演示页面保留下单样式，未提交任何接口'}</div>
    </div>
  );
}

type MediaDraft = {
  id?: number;
  section: MediaSection;
  sourceType: 'upload' | 'url';
  source: string;
  alt: string;
  sortOrder: number;
  enabled: boolean;
};

type ReviewDraft = {
  id?: number;
  name: string;
  content: string;
  images: string;
  featuredOnHome: boolean;
  homeOrder: number;
  enabled: boolean;
};

type PurchaseDraft = {
  id?: number;
  content: string;
  enabled: boolean;
  sortOrder: number;
};

type SiteDraft = {
  id?: number;
  name: string;
  slug: string;
  templateSiteId?: number;
};

type SkuDraft = ProductSkuInput & { id?: number };

const emptySkuDraft: SkuDraft = {
  skuCode: '',
  name: '',
  subtitle: '',
  price: '0.00',
  originalPrice: '0.00',
  saleLabel: '券后价',
  highlight: '',
  enabled: true,
  sortOrder: 0,
};
function isPcUserAgent() {
  const userAgent = navigator.userAgent.toLowerCase();
  return !/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
}

function useIsDesktop() {
  const [isDesktop] = useState(isPcUserAgent);

  return isDesktop;
}

function AdminBlocked() {
  return (
    <div className="store-page admin-page admin-blocked-page">
      <main className="admin-blocked-shell">
        <section className="admin-blocked-card">
          <div className="admin-blocked-kicker">后台仅支持 PC 端</div>
          <h1 className="admin-blocked-title">请使用桌面浏览器访问管理页</h1>
          <p className="admin-blocked-copy">
            当前设备不是 PC 浏览器，无法打开后台管理界面。请在电脑端重新访问 /admin 或 /admin/login。
          </p>
        </section>
      </main>
    </div>
  );
}

function AdminApp() {
  const { currentPath, navigate } = useAdminRouter();
  const activePage = getPageKey(currentPath);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [currentSiteId, setCurrentSiteId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get('siteId');
    return siteId ? Number(siteId) : null;
  });
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsFormInstance] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState<'settings' | 'site' | 'media' | 'review' | 'purchase' | 'sku' | 'payment' | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>({ name: '', slug: '', templateSiteId: undefined });
  const [mediaDraft, setMediaDraft] = useState<MediaDraft>({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: 1, enabled: true });
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({ name: '', content: '', images: '', featuredOnHome: false, homeOrder: 0, enabled: true });
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>({ content: '', enabled: true, sortOrder: 0 });
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [mediaStatusFilter, setMediaStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [mediaSectionFilter, setMediaSectionFilter] = useState<'all' | MediaSection>('all');
  const [reviewQuery, setReviewQuery] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState<number[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<number[]>([]);
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [skuDraft, setSkuDraft] = useState<SkuDraft>(emptySkuDraft);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderQuery, setOrderQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState('all');
  const [deletedStatusFilter, setDeletedStatusFilter] = useState('active');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [switchingSiteIds, setSwitchingSiteIds] = useState<Set<number>>(new Set());
  const { Title, Text } = Typography;
  const { message, modal } = AntApp.useApp();
  const { Header, Sider, Content } = Layout;

  const buildOrderParams = () => {
    const params = new URLSearchParams();
    params.set('pageSize', '50');
    if (orderQuery.trim()) params.set('query', orderQuery.trim());
    if (paymentStatusFilter !== 'all') params.set('paymentStatus', paymentStatusFilter);
    if (fulfillmentStatusFilter !== 'all') params.set('fulfillmentStatus', fulfillmentStatusFilter);
    if (deletedStatusFilter !== 'active') params.set('deletedStatus', deletedStatusFilter);
    if (currentSiteId) params.set('siteId', String(currentSiteId));
    return params;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [data, skuData, orderData, payData] = await Promise.all([fetchAdminBootstrap(currentSiteId ?? undefined), fetchAdminSkus(currentSiteId ?? undefined), fetchAdminOrders(buildOrderParams()), fetchPaymentSettings(currentSiteId ?? undefined)]);
      setBootstrap(data);
      
      // 初始化时设置默认站点
      if (currentSiteId === null && data.sites.length > 0) {
        const defaultSite = data.sites.find(s => s.isActive) ?? data.sites[0];
        updateSiteId(defaultSite.id);
      }
      
      setSettings(data.settings);
      
      setSkus(skuData);
      setOrders(orderData.items);
      setOrderTotal(orderData.total);
      setPaymentSettings(payData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminMe().then(async (ok) => {
      setAuthed(ok);
      if (ok) await refresh();
    });
  }, []);

  // 当切换站点时刷新数据
  useEffect(() => {
    if (authed && currentSiteId !== null) {
      void refresh();
    }
  }, [currentSiteId]);

  const updateSiteId = (siteId: number) => {
    setCurrentSiteId(siteId);
    const params = new URLSearchParams(window.location.search);
    params.set('siteId', String(siteId));
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  const closeDrawer = () => {
    setDrawer(null);
    setUploadFile(null);
  };
  const openSettings = () => setDrawer('settings');
  const openSite = (site?: Site) => {
    setSiteDraft(site ? { id: site.id, name: site.name, slug: site.slug } : { name: '', slug: '', templateSiteId: bootstrap?.activeSiteId });
    setDrawer('site');
  };
  const openMedia = (item?: MediaAsset, section: MediaSection = 'hero') => {
    const defaultOrder = section === 'hero' ? (bootstrap?.heroImages.length ?? 0) + 1 : (bootstrap?.detailImages.length ?? 0) + 1;
    setMediaDraft(item ? { id: item.id, section: item.section, sourceType: item.sourceType, source: item.source, alt: item.alt, sortOrder: item.sortOrder, enabled: item.enabled } : { section, sourceType: 'url', source: '', alt: '', sortOrder: defaultOrder, enabled: true });
    setDrawer('media');
  };
  const openReview = (item?: Review) => {
    setReviewDraft(item ? { id: item.id, name: item.name, content: item.content, images: item.images.join('\n'), featuredOnHome: item.featuredOnHome, homeOrder: item.homeOrder, enabled: item.enabled } : { name: '', content: '', images: '', featuredOnHome: true, homeOrder: (bootstrap?.allReviews.length ?? 0) + 1, enabled: true });
    setDrawer('review');
  };
  const openPurchase = (item?: FloatingPurchase) => {
    setPurchaseDraft(item ? { id: item.id, content: item.content, enabled: item.enabled, sortOrder: item.sortOrder } : { content: '', enabled: true, sortOrder: (bootstrap?.floatingPurchases.length ?? 0) + 1 });
    setDrawer('purchase');
  };
  const openSku = (item?: ProductSku) => {
    setSkuDraft(item ? { skuCode: item.skuCode, name: item.name, subtitle: item.subtitle, price: item.price, originalPrice: item.originalPrice, saleLabel: item.saleLabel, highlight: item.highlight ?? '', enabled: item.enabled, sortOrder: item.sortOrder, id: item.id } : { ...emptySkuDraft, sortOrder: skus.length + 1 });
    setDrawer('sku');
  };
  const openPaymentSettings = () => setDrawer('payment');

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await loginAdmin(password);
      setAuthed(true);
      await refresh();
      message.success('登录成功');
    } catch {
      setAuthed(false);
      message.error('密码错误');
    }
  };
  const handleLogout = async () => {
    await logoutAdmin();
    setAuthed(false);
    setBootstrap(null);
  };
  const handleSettingsSave = async (values: Partial<SiteSettings> & { guarantee?: string | string[]; reviewTags?: string | string[] }) => {
    if (!settings) return;
    const lines = (value: string | string[] | undefined, fallback: string[]) => Array.isArray(value) ? value : String(value ?? '').split('\n').map((item) => item.trim()).filter(Boolean) || fallback;
    try {
      await saveSiteSettings(currentSiteId, {
        ...settings,
        ...values,
        guarantee: lines(values.guarantee, settings.guarantee),
        reviewTags: lines(values.reviewTags, settings.reviewTags),
      });
      closeDrawer();
      await refresh();
      message.success('站点配置已保存');
    } catch (error) {
      console.error('保存站点配置失败:', error);
      message.error('保存失败，请稍后重试');
    }
  };
  const handleSiteSave = async () => {
    try {
      if (siteDraft.id) {
        await updateSite(siteDraft.id, { name: siteDraft.name, slug: siteDraft.slug });
        message.success('站点信息已保存');
      } else {
        await createSite(siteDraft);
        message.success('站点已创建，内容已从模板复制');
      }
      closeDrawer();
      await refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '站点保存失败，请检查名称或标识是否重复');
    }
  };
  const handleActivateSite = async (site: Site) => {
    // 防止重复点击
    if (switchingSiteIds.has(site.id)) {
      return;
    }
    
    // 标记该站点正在切换中
    setSwitchingSiteIds(prev => new Set([...prev, site.id]));
    
    try {
      await activateSite(site.id);
      await refresh();
      message.success(`站点${site.isActive ? '已停用' : '已启用'}`);
    } catch {
      message.error('操作失败');
    } finally {
      // 操作完成后移除标记
      setSwitchingSiteIds(prev => {
        const next = new Set(prev);
        next.delete(site.id);
        return next;
      });
    }
  };
  const handleUploadSelected = async (file: File) => {
    try {
      const result = await uploadAsset(file);
      if (drawer === 'review') {
        setReviewDraft((draft) => ({ ...draft, images: draft.images ? `${draft.images}\n${result.source}` : result.source }));
      } else if (drawer === 'settings') {
        // 同时写入 Form 字段（提交时以 Form 值为准）与本地 settings（用于预览）
        settingsFormInstance.setFieldValue('customerServiceQrCode', result.resolvedUrl);
        setSettings((prev) => prev ? { ...prev, customerServiceQrCode: result.resolvedUrl } : null);
      } else {
        setMediaDraft((draft) => ({ ...draft, source: result.source, sourceType: 'upload' }));
      }
      setUploadFile(null);
      message.success('图片上传成功，链接已填入');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片上传失败');
    }
  };

  const handleMediaSave = async () => {
    try {
      const source = mediaDraft.source;
      if (!source.trim()) {
        message.warning('请上传图片或填写图片地址');
        return;
      }
      const payload = { ...mediaDraft, source, siteId: currentSiteId };
      if (mediaDraft.section === 'hero' && !mediaDraft.id && (bootstrap?.heroImages.length ?? 0) >= 15) {
        message.warning('首页轮播图最多 15 张');
        return;
      }
      if (mediaDraft.id) await updateMediaAsset(mediaDraft.id, payload); else await createMediaAsset(payload);
      closeDrawer();
      await refresh();
      message.success(mediaDraft.id ? '图片已保存' : '图片已添加');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片保存失败');
    }
  };
  const handleReviewSave = async () => {
    try {
      const images = reviewDraft.images.split('\n').map((item) => item.trim()).filter(Boolean);
      const payload = { ...reviewDraft, images, siteId: currentSiteId };
      if (reviewDraft.id) await updateReview(reviewDraft.id, payload); else await createReview(payload);
      closeDrawer();
      await refresh();
      message.success(reviewDraft.id ? '评价已保存' : '评价已添加');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '评价保存失败');
    }
  };
  const handlePurchaseSave = async () => {
    try {
      if (purchaseDraft.id) await updateFloatingPurchase(purchaseDraft.id, { ...purchaseDraft, siteId: currentSiteId }); else await createFloatingPurchase({ ...purchaseDraft, siteId: currentSiteId });
      closeDrawer();
      await refresh();
      message.success(purchaseDraft.id ? '浮层文案已保存' : '浮层文案已添加');
    } catch {
      message.error('浮层文案保存失败');
    }
  };
  const handleSkuSave = async () => {
    try {
      if (skuDraft.id) await updateSku(skuDraft.id, skuDraft); else await createSku(skuDraft);
      closeDrawer();
      await refresh();
      message.success(skuDraft.id ? '规格已保存' : '规格已新增');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '规格保存失败');
    }
  };
  const handlePaymentSettingsSave = async (values: any) => {
    if (!paymentSettings) return;
    try {
      await savePaymentSettings({
        gatewayUrl: values.gatewayUrl,
        merchantId: values.merchantId,
        merchantSecret: values.merchantSecret,
        enabledChannels: values.enabledChannels ?? [],
        notifyUrl: values.notifyUrl,
        returnUrl: values.returnUrl,
      });
      closeDrawer();
      await refresh();
      message.success('支付配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '支付配置保存失败');
    }
  };
  const handleShipOrder = async (order: Order) => {
    const logisticsCompany = window.prompt('物流公司', order.logisticsCompany ?? '');
    if (!logisticsCompany) return;
    const logisticsNo = window.prompt('物流单号', order.logisticsNo ?? '');
    if (!logisticsNo) return;
    try {
      await shipOrder(order.id, { logisticsCompany, logisticsNo });
      await refresh();
      message.success('已发货并完成');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发货失败');
    }
  };
  const handleRefundOrder = async (order: Order) => {
    const refundNote = window.prompt(`请输入订单 ${order.orderNo} 的退款备注`);
    if (!refundNote) return;
    try {
      await markOrderRefunded(order.id, refundNote);
      await refresh();
      message.success('已标记退款');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '退款标记失败');
    }
  };
  const handleSoftDeleteOrder = async (order: Order) => {
    const deletionReason = window.prompt(`删除订单 ${order.orderNo} 需要填写原因`);
    if (!deletionReason) return;
    try {
      await softDeleteOrder(order.id, deletionReason);
      await refresh();
      message.success('订单已软删除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };
  const handleExportOrders = async (params: { startDate?: string; endDate?: string; columns: string[] }) => {
    try {
      const urlParams = buildOrderParams();
      
      // 添加时间范围
      if (params.startDate) {
        urlParams.set('startAt', params.startDate);
      }
      if (params.endDate) {
        urlParams.set('endAt', params.endDate);
      }
      
      // 添加导出字段
      if (params.columns.length > 0) {
        urlParams.set('columns', params.columns.join(','));
      }
      
      const blob = await exportOrders(urlParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      throw error;
    }
  };
  const clearBatchSelections = () => {
    setSelectedReviewIds([]);
    setSelectedMediaIds([]);
    setSelectedPurchaseIds([]);
  };

  const handleDelete = async (title: string, action: () => Promise<void>) => {
    try {
      await action();
      await refresh();
      message.success(`${title}已删除`);
    } catch {
      message.error(`${title}删除失败`);
    }
  };

  const confirmDelete = (title: string, action: () => Promise<void>) => {
    console.log(`[admin delete] ${title} clicked`);
    modal.confirm({
      title: `确定删除${title}吗？`,
      content: '删除后无法恢复，请确认当前操作。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        console.log(`[admin delete] ${title} confirmed`);
        await handleDelete(title, action);
      },
    });
  };

  const confirmBulkAction = (title: string, content: string, action: () => Promise<void>, successText: string) => {
    modal.confirm({
      title,
      content,
      okText: '确认执行',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await action();
        await refresh();
        clearBatchSelections();
        message.success(successText);
      },
    });
  };

  const renderDeleteButton = (title: string, action: () => Promise<void>, disabled = false) => (
    <Button type="link" danger onClick={() => confirmDelete(title, action)} disabled={disabled}>
      删除
    </Button>
  );

  const renderBatchToolbar = (label: string, count: number, onDelete: () => void, onEnable: () => void, onDisable: () => void) => (
    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
      <Text type="secondary">{count ? `已选择 ${count} 项` : `勾选${label}后可批量操作`}</Text>
      <Space>
        <Button danger disabled={!count} onClick={onDelete}>
          批量删除
        </Button>
        <Button disabled={!count} onClick={onEnable}>
          批量启用
        </Button>
        <Button disabled={!count} onClick={onDisable}>
          批量禁用
        </Button>
      </Space>
    </Space>
  );

  const isDesktop = useIsDesktop();
  const allMediaAssets = (bootstrap?.heroImages ?? []).concat(bootstrap?.detailImages ?? []);
  const mediaAssets = allMediaAssets.filter((item) => {
    const statusMatch = mediaStatusFilter === 'all' || (mediaStatusFilter === 'enabled' ? item.enabled : !item.enabled);
    const sectionMatch = mediaSectionFilter === 'all' || item.section === mediaSectionFilter;
    return statusMatch && sectionMatch;
  });
  const reviews = (bootstrap?.allReviews ?? []).filter((item) => {
    const statusMatch = reviewStatusFilter === 'all' || (reviewStatusFilter === 'enabled' ? item.enabled : !item.enabled);
    const query = reviewQuery.trim().toLowerCase();
    return statusMatch && (!query || item.name.toLowerCase().includes(query) || item.content.toLowerCase().includes(query));
  });
  const navItems = [
    { key: 'dashboard', icon: <AppstoreOutlined />, label: '控制台' },
    { key: 'orders', icon: <FormOutlined />, label: '订单管理' },
    { key: 'skus', icon: <TagsOutlined />, label: '商品规格' },
    { key: 'payment', icon: <SettingOutlined />, label: '支付配置' },
    { key: 'settings', icon: <SettingOutlined />, label: '站点管理' },
    { key: 'media', icon: <FileImageOutlined />, label: '图片管理' },
    { key: 'reviews', icon: <FormOutlined />, label: '评价管理' },
    { key: 'purchases', icon: <TagsOutlined />, label: '浮层文案管理' },
  ];

  if (!isDesktop) return <AdminBlocked />;
  if (authed === null) return <div className="admin-loading"><Spin size="large" /></div>;
  if (!authed) return <div className="admin-login-page"><Card className="admin-login-card"><Text type="secondary">多站点后台</Text><Title level={2}>后台登录</Title><Text type="secondary">后台仅支持桌面端访问，请使用电脑浏览器继续。</Text><form onSubmit={handleLogin}><label>密码<Input.Password value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入后台密码" /></label><Button htmlType="submit" type="primary" block>登录</Button></form></Card></div>;

  const settingsInitialValues = settings ? { ...settings, guarantee: settings.guarantee.join('\n'), reviewTags: settings.reviewTags.join('\n'), paymentSuccessMessage: settings.paymentSuccessMessage || '添加客服领取服用说明', customerServiceUrl: settings.customerServiceUrl || '', customerServiceQrCode: settings.customerServiceQrCode || '' } : undefined;
  const settingsForm = settings ? <Form form={settingsFormInstance} layout="vertical" initialValues={settingsInitialValues} onFinish={handleSettingsSave}><Alert type="info" message="价格管理已迁移至 SKU 管理页面" description="请在 SKU 管理中修改商品价格" showIcon style={{ marginBottom: 16 }} /><Row gutter={20}><Col span={24}><Form.Item name="shopName" label="店铺名"><Input /></Form.Item></Col><Col span={12}><Form.Item name="title" label="标题"><Input /></Form.Item></Col><Col span={12}><Form.Item name="subtitle" label="副标题"><Input /></Form.Item></Col><Col span={24}><Form.Item name="productDescription" label="描述"><Input.TextArea rows={3} /></Form.Item></Col><Col span={24}><Form.Item name="marqueeText" label="滚动文案"><Input /></Form.Item></Col><Col span={12}><Form.Item name="shippingNote" label="邮费说明"><Input /></Form.Item></Col><Col span={12}><Form.Item name="shippingTime" label="发货时间"><Input /></Form.Item></Col><Col span={24}><Form.Item name="guarantee" label="保障文案，每行一个"><Input.TextArea rows={3} /></Form.Item></Col><Col span={24}><Form.Item name="reviewTags" label="评价标签，每行一个"><Input.TextArea rows={2} /></Form.Item></Col><Col span={24}><Form.Item name="reminder" label="提示语"><Input /></Form.Item></Col><Col span={24}><Form.Item name="paymentSuccessMessage" label="支付成功引导文案"><Input placeholder="添加客服领取服用说明" /></Form.Item></Col><Col span={24}><Form.Item name="customerServiceQrCode" label="客服二维码图片" extra="上传客服微信二维码（建议尺寸 400x400）"><Input placeholder="图片 URL" /><Upload beforeUpload={(file) => { void handleUploadSelected(file); return false; }} maxCount={1} style={{ marginTop: '8px' }}><Button icon={<UploadOutlined />}>上传二维码</Button></Upload>{settings.customerServiceQrCode && <div style={{ marginTop: '12px' }}><img src={settings.customerServiceQrCode} alt="客服二维码预览" style={{ width: '120px', height: '120px', border: '1px solid #e5e7eb', borderRadius: '8px' }} /></div>}</Form.Item></Col><Col span={24}><Form.Item name="customerServiceUrl" label="客服微信链接" extra="支持微信直链，与二维码至少填写一个"><Input placeholder="weixin://dl/business/?t=xxxxx" /></Form.Item></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">保存配置</Button></Space></Form> : null;
  const siteForm = <Form layout="vertical" onFinish={handleSiteSave}><Form.Item label="站点名称" required><Input value={siteDraft.name} onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} placeholder="例如 华东商城" /></Form.Item><Form.Item label="站点标识" required><Input value={siteDraft.slug} onChange={(event) => setSiteDraft({ ...siteDraft, slug: event.target.value })} placeholder="例如 east-store" /></Form.Item>{siteDraft.id ? null : <Form.Item label="复制模板"><Select value={siteDraft.templateSiteId} onChange={(templateSiteId) => setSiteDraft({ ...siteDraft, templateSiteId })} options={(bootstrap?.sites ?? []).map((site) => ({ value: site.id, label: site.name }))} /></Form.Item>}<Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{siteDraft.id ? '保存站点' : '创建站点'}</Button></Space></Form>;
  const mediaForm = <Form layout="vertical" onFinish={handleMediaSave}><Row gutter={20}><Col span={12}><Form.Item label="区域"><Select value={mediaDraft.section} onChange={(section) => setMediaDraft({ ...mediaDraft, section })} options={[{ value: 'hero', label: '首页轮播' }, { value: 'detail', label: '详情图片' }]} /></Form.Item></Col><Col span={12}><Form.Item label="来源类型"><Select value={mediaDraft.sourceType} onChange={(sourceType) => setMediaDraft({ ...mediaDraft, sourceType })} options={[{ value: 'url', label: 'URL' }, { value: 'upload', label: '上传' }]} /></Form.Item></Col><Col span={24}><Form.Item label="图片地址"><Input value={mediaDraft.source} onChange={(event) => setMediaDraft({ ...mediaDraft, source: event.target.value })} placeholder="https://... 或 /img/..." /></Form.Item></Col><Col span={24}><Form.Item label="上传文件"><Upload beforeUpload={(file) => { void handleUploadSelected(file); return false; }} maxCount={1}><Button icon={<UploadOutlined />}>选择文件</Button></Upload></Form.Item></Col><Col span={12}><Form.Item label="替代文本"><Input value={mediaDraft.alt} onChange={(event) => setMediaDraft({ ...mediaDraft, alt: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="排序"><Input type="number" value={mediaDraft.sortOrder} onChange={(event) => setMediaDraft({ ...mediaDraft, sortOrder: Number(event.target.value) })} /></Form.Item></Col><Col span={24}><Space><Switch checked={mediaDraft.enabled} onChange={(enabled) => setMediaDraft({ ...mediaDraft, enabled })} />启用</Space></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{mediaDraft.id ? '保存修改' : '新增图片'}</Button></Space></Form>;
  const reviewForm = <Form layout="vertical" onFinish={handleReviewSave}><Form.Item label="用户名"><Input value={reviewDraft.name} onChange={(event) => setReviewDraft({ ...reviewDraft, name: event.target.value })} /></Form.Item><Form.Item label="内容"><Input.TextArea rows={4} value={reviewDraft.content} onChange={(event) => setReviewDraft({ ...reviewDraft, content: event.target.value })} /></Form.Item><Form.Item label="图片地址，每行一个"><Input.TextArea rows={3} value={reviewDraft.images} onChange={(event) => setReviewDraft({ ...reviewDraft, images: event.target.value })} /></Form.Item><Form.Item label="上传评价图片"><Upload beforeUpload={(file) => { void handleUploadSelected(file); return false; }} maxCount={1}><Button icon={<UploadOutlined />}>选择文件</Button></Upload></Form.Item><Row gutter={20}><Col span={12}><Form.Item label="排序"><Input type="number" value={reviewDraft.homeOrder} onChange={(event) => setReviewDraft({ ...reviewDraft, homeOrder: Number(event.target.value) })} /></Form.Item></Col><Col span={12}><Form.Item label="首页展示"><Switch checked={reviewDraft.featuredOnHome} onChange={(featuredOnHome) => setReviewDraft({ ...reviewDraft, featuredOnHome })} /></Form.Item></Col><Col span={12}><Form.Item label="启用"><Switch checked={reviewDraft.enabled} onChange={(enabled) => setReviewDraft({ ...reviewDraft, enabled })} /></Form.Item></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{reviewDraft.id ? '保存修改' : '新增评价'}</Button></Space></Form>;
  const purchaseForm = <Form layout="vertical" onFinish={handlePurchaseSave}><Form.Item label="文案"><Input value={purchaseDraft.content} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, content: event.target.value })} /></Form.Item><Form.Item label="排序"><Input type="number" value={purchaseDraft.sortOrder} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, sortOrder: Number(event.target.value) })} /></Form.Item><Form.Item label="启用"><Switch checked={purchaseDraft.enabled} onChange={(enabled) => setPurchaseDraft({ ...purchaseDraft, enabled })} /></Form.Item><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{purchaseDraft.id ? '保存修改' : '新增文案'}</Button></Space></Form>;
  const skuForm = <Form layout="vertical" onFinish={handleSkuSave}><Row gutter={20}><Col span={12}><Form.Item label="规格编码" required><Input value={skuDraft.skuCode} onChange={(event) => setSkuDraft({ ...skuDraft, skuCode: event.target.value })} placeholder="single" /></Form.Item></Col><Col span={12}><Form.Item label="规格名称" required><Input value={skuDraft.name} onChange={(event) => setSkuDraft({ ...skuDraft, name: event.target.value })} /></Form.Item></Col><Col span={24}><Form.Item label="副标题"><Input value={skuDraft.subtitle} onChange={(event) => setSkuDraft({ ...skuDraft, subtitle: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="售价"><Input value={skuDraft.price} onChange={(event) => setSkuDraft({ ...skuDraft, price: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="原价"><Input value={skuDraft.originalPrice} onChange={(event) => setSkuDraft({ ...skuDraft, originalPrice: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="价格标签"><Input value={skuDraft.saleLabel} onChange={(event) => setSkuDraft({ ...skuDraft, saleLabel: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="高亮"><Input value={skuDraft.highlight} onChange={(event) => setSkuDraft({ ...skuDraft, highlight: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="排序"><Input type="number" value={skuDraft.sortOrder} onChange={(event) => setSkuDraft({ ...skuDraft, sortOrder: Number(event.target.value) })} /></Form.Item></Col><Col span={12}><Form.Item label="启用"><Switch checked={skuDraft.enabled} onChange={(enabled) => setSkuDraft({ ...skuDraft, enabled })} /></Form.Item></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{skuDraft.id ? '保存规格' : '新增规格'}</Button></Space></Form>;
  const paymentForm = paymentSettings ? <Form layout="vertical" initialValues={{ ...paymentSettings, merchantSecret: '' }} onFinish={handlePaymentSettingsSave}><Form.Item name="gatewayUrl" label="网关地址" required><Input /></Form.Item><Form.Item name="merchantId" label="商户号" required><Input /></Form.Item><Form.Item name="merchantSecret" label={`商户密钥（当前 ${paymentSettings.secretMasked || '未设置'}）`}><Input.Password placeholder="留空则不修改" /></Form.Item><Form.Item name="enabledChannels" label="启用渠道"><Checkbox.Group options={[{ label: '支付宝', value: 'alipay' }, { label: '微信', value: 'wxpay' }]} /></Form.Item><Form.Item name="notifyUrl" label="回调地址" required><Input /></Form.Item><Form.Item name="returnUrl" label="返回地址" required extra="建议填写相对路径（如 /payment/return）。系统会自动使用用户下单时访问的域名与端口拼接完整地址，避免开发环境端口不一致；若填写绝对地址，也只会取其路径部分"><Input placeholder="/payment/return" /></Form.Item><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">保存支付配置</Button></Space></Form> : null;
  const skuColumns: ColumnsType<ProductSku> = [
    { title: '编码', dataIndex: 'skuCode' },
    { title: '规格', dataIndex: 'name' },
    { title: '售价', dataIndex: 'price', render: (value: string) => `¥${value}` },
    { title: '原价', dataIndex: 'originalPrice', render: (value: string) => `¥${value}` },
    { title: '排序', dataIndex: 'sortOrder' },
    { title: '状态', dataIndex: 'enabled', render: (enabled: boolean) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '停用'}</Tag> },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, item: ProductSku) => (
        <Space>
          <Button type="link" onClick={() => openSku(item)}>编辑</Button>
          {item.enabled ? (
            <Button
              type="link"
              onClick={async () => {
                await disableSku(item.id);
                await refresh();
                message.success('规格已停用');
              }}
            >
              停用
            </Button>
          ) : (
            <Button
              type="link"
              onClick={async () => {
                await enableSku(item.id);
                await refresh();
                message.success('规格已启用');
              }}
            >
              启用
            </Button>
          )}
          <Button
            type="link"
            danger
            onClick={() =>
              confirmDelete('规格', async () => {
                await deleteSku(item.id);
              })
            }
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];
  const orderColumns: ColumnsType<Order> = [{ title: '订单号', dataIndex: 'orderNo' }, { title: '姓名', dataIndex: 'recipientName' }, { title: '手机号', dataIndex: 'phone' }, { title: '规格', dataIndex: 'skuName' }, { title: '数量', dataIndex: 'quantity' }, { title: '金额', dataIndex: 'totalAmount', render: (value: string) => `¥${value}` }, { title: '支付', dataIndex: 'paymentStatus', render: (value: string) => <Tag color={value === 'PAID' ? 'green' : value === 'REFUNDED' ? 'purple' : 'orange'}>{formatPaymentStatus(value)}</Tag> }, { title: '履约', dataIndex: 'fulfillmentStatus', render: (value: string) => <Tag color={value === 'SHIPPED' ? 'blue' : 'default'}>{formatFulfillmentStatus(value)}</Tag> }, { title: '物流', render: (_: unknown, item: Order) => item.logisticsNo ? `${item.logisticsCompany ?? ''} ${item.logisticsNo}` : '-' }, { title: '创建时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') }, { title: '操作', key: 'action', render: (_: unknown, item: Order) => <Space><Button type="link" onClick={() => modal.info({ title: item.orderNo, width: 720, content: <Descriptions column={1} bordered size="small"><Descriptions.Item label="商品">{item.productName}</Descriptions.Item><Descriptions.Item label="规格">{item.skuName}</Descriptions.Item><Descriptions.Item label="收货人">{item.recipientName}</Descriptions.Item><Descriptions.Item label="手机号">{item.phone}</Descriptions.Item><Descriptions.Item label="地址">{item.address}</Descriptions.Item><Descriptions.Item label="金额">¥{item.totalAmount}</Descriptions.Item><Descriptions.Item label="物流">{item.logisticsNo ? `${item.logisticsCompany ?? ''} ${item.logisticsNo}` : '-'}</Descriptions.Item><Descriptions.Item label="退款备注">{item.refundNote ?? '-'}</Descriptions.Item></Descriptions> })}>详情</Button><Button type="link" onClick={() => void handleShipOrder(item)} disabled={item.fulfillmentStatus === 'SHIPPED' || Boolean(item.deletedAt)}>发货并完成</Button><Button type="link" onClick={() => void handleRefundOrder(item)} disabled={Boolean(item.refundedAt) || Boolean(item.deletedAt)}>标记退款</Button><Button type="link" danger onClick={() => void handleSoftDeleteOrder(item)} disabled={Boolean(item.deletedAt)}>删除</Button></Space> }];
  const siteColumns: ColumnsType<Site> = [{ title: '站点', dataIndex: 'name' }, { title: '标识', dataIndex: 'slug' }, { title: '创建时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }, { title: '状态', dataIndex: 'isActive', render: (isActive: boolean, site: Site) => <Switch size="small" checked={isActive} loading={switchingSiteIds.has(site.id)} onChange={async () => { await handleActivateSite(site); }} /> }, { title: '操作', key: 'action', render: (_: unknown, site: Site) => <Space><Button type="link" icon={<EditOutlined />} onClick={() => openSite(site)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('站点', async () => { await deleteSite(site.id); })}>删除</Button></Space> }];
  const reviewColumns: ColumnsType<Review> = [{ title: '用户', dataIndex: 'name', key: 'name', render: (name: string) => <Space><Tag color="blue">{name.slice(0, 1)}</Tag>{name}</Space> }, { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true }, { title: '图片', dataIndex: 'images', key: 'images', render: (images: string[]) => images[0] ? <img className="admin-table-thumb" src={images[0]} alt="评价图片" /> : <Text type="secondary">无图片</Text> }, { title: '首页展示', dataIndex: 'featuredOnHome', render: (value: boolean, item: Review) => <Switch size="small" checked={value} onChange={async (featuredOnHome) => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome, homeOrder: item.homeOrder, enabled: item.enabled, siteId: currentSiteId }); await refresh(); message.success('评价状态已更新'); }} /> }, { title: '排序', dataIndex: 'homeOrder' }, { title: '状态', dataIndex: 'enabled', render: (enabled: boolean, item: Review) => <Switch size="small" checked={enabled} onChange={async (nextEnabled) => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome: item.featuredOnHome, homeOrder: item.homeOrder, enabled: nextEnabled, siteId: currentSiteId }); await refresh(); message.success('评价状态已更新'); }} /> }, { title: '操作', key: 'action', render: (_: unknown, item: Review) => <Space><Button type="link" icon={<EditOutlined />} onClick={() => openReview(item)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('评价', async () => { await deleteReview(item.id, currentSiteId); })}>删除</Button></Space> }];
  const mediaColumns: ColumnsType<MediaAsset> = [{ title: '预览', dataIndex: 'resolvedUrl', render: (url: string, item: MediaAsset) => url ? <img className="admin-table-thumb" src={url} alt={item.alt} /> : <Text type="secondary">无图片</Text> }, { title: '区域', dataIndex: 'section', render: (section: string) => section === 'hero' ? '首页轮播' : '详情图片' }, { title: '地址', dataIndex: 'resolvedUrl', ellipsis: true }, { title: '排序', dataIndex: 'sortOrder' }, { title: '状态', dataIndex: 'enabled', render: (enabled: boolean) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '禁用'}</Tag> }, { title: '操作', key: 'action', render: (_: unknown, item: MediaAsset) => <Space><Button type="link" onClick={() => openMedia(item)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('图片', async () => { await deleteMediaAsset(item.id, currentSiteId); })}>删除</Button></Space> }];
  const purchaseColumns: ColumnsType<FloatingPurchase> = [{ title: '文案', dataIndex: 'content' }, { title: '排序', dataIndex: 'sortOrder' }, { title: '状态', dataIndex: 'enabled', render: (enabled: boolean) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '禁用'}</Tag> }, { title: '操作', key: 'action', render: (_: unknown, item: FloatingPurchase) => <Space><Button type="link" onClick={() => openPurchase(item)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('浮层文案', async () => { await deleteFloatingPurchase(item.id, currentSiteId); })}>删除</Button></Space> }];
  const selectedReviewItems = reviews.filter((item) => selectedReviewIds.includes(item.id));
  const selectedMediaItems = mediaAssets.filter((item) => selectedMediaIds.includes(item.id));
  const selectedPurchaseItems = (bootstrap?.floatingPurchases ?? []).filter((item) => selectedPurchaseIds.includes(item.id));

  const reviewUpdatePayload = (item: Review, enabled: boolean) => ({
    name: item.name,
    content: item.content,
    images: item.images,
    featuredOnHome: item.featuredOnHome,
    homeOrder: item.homeOrder,
    enabled,
    siteId: currentSiteId,
  });

  const mediaUpdatePayload = (item: MediaAsset, enabled: boolean) => ({
    section: item.section,
    sourceType: item.sourceType,
    source: item.source,
    alt: item.alt,
    sortOrder: item.sortOrder,
    enabled,
    siteId: currentSiteId,
  });

  const purchaseUpdatePayload = (item: FloatingPurchase, enabled: boolean) => ({
    content: item.content,
    enabled,
    sortOrder: item.sortOrder,
    siteId: currentSiteId,
  });

  const handleBatchReviewDelete = () => confirmBulkAction('批量删除评价', `已选择 ${selectedReviewIds.length} 项，确认删除吗？`, async () => { await Promise.all(selectedReviewItems.map((item) => deleteReview(item.id, currentSiteId))); }, '评价已删除');
  const handleBatchReviewEnable = () => confirmBulkAction('批量启用评价', `已选择 ${selectedReviewIds.length} 项，确认启用吗？`, async () => { await Promise.all(selectedReviewItems.map((item) => updateReview(item.id, reviewUpdatePayload(item, true)))); }, '评价已启用');
  const handleBatchReviewDisable = () => confirmBulkAction('批量禁用评价', `已选择 ${selectedReviewIds.length} 项，确认禁用吗？`, async () => { await Promise.all(selectedReviewItems.map((item) => updateReview(item.id, reviewUpdatePayload(item, false)))); }, '评价已禁用');

  const handleBatchMediaDelete = () => confirmBulkAction('批量删除图片', `已选择 ${selectedMediaIds.length} 项，确认删除吗？`, async () => { await Promise.all(selectedMediaItems.map((item) => deleteMediaAsset(item.id, currentSiteId))); }, '图片已删除');
  const handleBatchMediaEnable = () => confirmBulkAction('批量启用图片', `已选择 ${selectedMediaIds.length} 项，确认启用吗？`, async () => { await Promise.all(selectedMediaItems.map((item) => updateMediaAsset(item.id, mediaUpdatePayload(item, true)))); }, '图片已启用');
  const handleBatchMediaDisable = () => confirmBulkAction('批量禁用图片', `已选择 ${selectedMediaIds.length} 项，确认禁用吗？`, async () => { await Promise.all(selectedMediaItems.map((item) => updateMediaAsset(item.id, mediaUpdatePayload(item, false)))); }, '图片已禁用');

  const handleBatchPurchaseDelete = () => confirmBulkAction('批量删除文案', `已选择 ${selectedPurchaseIds.length} 项，确认删除吗？`, async () => { await Promise.all(selectedPurchaseItems.map((item) => deleteFloatingPurchase(item.id, currentSiteId))); }, '浮层文案已删除');
  const handleBatchPurchaseEnable = () => confirmBulkAction('批量启用文案', `已选择 ${selectedPurchaseIds.length} 项，确认启用吗？`, async () => { await Promise.all(selectedPurchaseItems.map((item) => updateFloatingPurchase(item.id, purchaseUpdatePayload(item, true)))); }, '浮层文案已启用');
  const handleBatchPurchaseDisable = () => confirmBulkAction('批量禁用文案', `已选择 ${selectedPurchaseIds.length} 项，确认禁用吗？`, async () => { await Promise.all(selectedPurchaseItems.map((item) => updateFloatingPurchase(item.id, purchaseUpdatePayload(item, false)))); }, '浮层文案已禁用');
  const reviewTable = <Table rowKey="id" rowSelection={{ selectedRowKeys: selectedReviewIds, onChange: (keys) => setSelectedReviewIds(keys as number[]) }} title={() => renderBatchToolbar('评价', selectedReviewIds.length, handleBatchReviewDelete, handleBatchReviewEnable, handleBatchReviewDisable)} columns={reviewColumns} dataSource={reviews} loading={loading} pagination={{ pageSize: 8, showSizeChanger: true }} locale={{ emptyText: <Empty description="暂无评价" /> }} />;
  const mediaTable = <Table rowKey="id" rowSelection={{ selectedRowKeys: selectedMediaIds, onChange: (keys) => setSelectedMediaIds(keys as number[]) }} title={() => renderBatchToolbar('图片', selectedMediaIds.length, handleBatchMediaDelete, handleBatchMediaEnable, handleBatchMediaDisable)} columns={mediaColumns} dataSource={mediaAssets} loading={loading} pagination={{ pageSize: 8, showSizeChanger: true }} />;
  const purchaseTable = <Table rowKey="id" rowSelection={{ selectedRowKeys: selectedPurchaseIds, onChange: (keys) => setSelectedPurchaseIds(keys as number[]) }} title={() => renderBatchToolbar('文案', selectedPurchaseIds.length, handleBatchPurchaseDelete, handleBatchPurchaseEnable, handleBatchPurchaseDisable)} columns={purchaseColumns} dataSource={bootstrap?.floatingPurchases ?? []} loading={loading} pagination={{ pageSize: 8 }} />;
  const content = activePage === 'dashboard' ? (
    <>
      <Title level={2}>欢迎回来</Title>
      <Text type="secondary">当前站点：{bootstrap?.site.name}</Text>
      <Row gutter={[20, 20]} className="admin-stat-row">
        <Col xs={24} lg={8}>
          <Card>
            <Statistic title="图片总数" value={allMediaAssets.length} prefix={<FileImageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <Statistic title="评价总数" value={bootstrap?.allReviews.length ?? 0} prefix={<FormOutlined />} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <Statistic title="活跃浮层" value={(bootstrap?.floatingPurchases ?? []).filter((item) => item.enabled).length} prefix={<TagsOutlined />} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[20, 20]} className="admin-quick-row">
        <Col xs={24} lg={12}>
          <Card hoverable onClick={openSettings}>
            <Descriptions column={1} title="站点配置">
              <Descriptions.Item label="店铺">{settings?.shopName}</Descriptions.Item>
              <Descriptions.Item label="当前售价">¥{bootstrap?.skus?.find(s => s.enabled)?.price ?? '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card hoverable onClick={() => navigate(ADMIN_ROUTES.SETTINGS)}>
            <Descriptions column={1} title="站点管理">
              <Descriptions.Item label="站点数量">{bootstrap?.sites.length ?? 0} 个</Descriptions.Item>
              <Descriptions.Item label="当前标识">{bootstrap?.site.slug}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </>
  ) : activePage === 'orders' ? (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>订单管理</Title>
          <Text type="secondary">按订单号、手机号、支付、履约和删除状态筛选订单。</Text>
        </div>
        <Space>
          <Button onClick={() => void refresh()}>刷新</Button>
          <Button type="primary" onClick={() => setExportModalVisible(true)}>导出 XLSX</Button>
        </Space>
      </div>
      <Card className="admin-filter-card">
        <Space wrap>
          <Input.Search value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} onSearch={() => void refresh()} placeholder="订单号 / 手机号 / 姓名" allowClear />
          <Select value={paymentStatusFilter} onChange={setPaymentStatusFilter} options={[{ value: 'all', label: '全部支付' }, { value: 'PAYING', label: '支付中' }, { value: 'PAID', label: '已支付' }, { value: 'REFUNDED', label: '已退款' }]} />
          <Select value={fulfillmentStatusFilter} onChange={setFulfillmentStatusFilter} options={[{ value: 'all', label: '全部履约' }, { value: 'WAIT_SHIP', label: '待发货' }, { value: 'SHIPPED', label: '已发货' }]} />
          <Select value={deletedStatusFilter} onChange={setDeletedStatusFilter} options={[{ value: 'active', label: '未删除' }, { value: 'deleted', label: '已删除' }, { value: 'all', label: '全部订单' }]} />
          <Button onClick={() => void refresh()}>应用筛选</Button>
        </Space>
      </Card>
      <Card className="admin-content-card" title={`共 ${orderTotal} 笔订单`}>
        <Table rowKey="id" columns={orderColumns} dataSource={orders} loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 1300 }} />
      </Card>
    </>
  ) : activePage === 'skus' ? (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>商品规格</Title>
          <Text type="secondary">规格作为 SKU 管理，订单会保存下单时的价格和名称快照。</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openSku()}>新增规格</Button>
      </div>
      <Card className="admin-content-card">
        <Table rowKey="id" columns={skuColumns} dataSource={skus} loading={loading} pagination={false} />
      </Card>
    </>
  ) : activePage === 'payment' ? (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>支付配置</Title>
          <Text type="secondary">仅管理易支付网关、商户号、渠道和回调地址；数据库连接由部署环境提供。</Text>
        </div>
        <Button type="primary" onClick={openPaymentSettings}>编辑支付配置</Button>
      </div>
      <Alert
        type="info"
        message="全局配置说明"
        description="支付配置是全局唯一的，所有站点共享同一份支付配置，不会根据站点切换而改变。"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Card className="admin-content-card">
        <Descriptions column={1}>
          <Descriptions.Item label="网关地址">{paymentSettings?.gatewayUrl}</Descriptions.Item>
          <Descriptions.Item label="商户号">{paymentSettings?.merchantId}</Descriptions.Item>
          <Descriptions.Item label="商户密钥">{paymentSettings?.secretMasked || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="启用渠道">{paymentSettings?.enabledChannels?.join(', ') || '未启用'}</Descriptions.Item>
          <Descriptions.Item label="回调地址">{paymentSettings?.notifyUrl}</Descriptions.Item>
          <Descriptions.Item label="返回地址">{paymentSettings?.returnUrl}</Descriptions.Item>
        </Descriptions>
      </Card>
    </>
  ) : activePage === 'settings' ? (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>站点管理中心</Title>
          <Text type="secondary">创建站点、复制模板、切换当前站点，并维护当前站点配置。</Text>
        </div>
        <Space>
          <Button onClick={openSettings}>编辑当前配置</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openSite()}>
            新建站点
          </Button>
        </Space>
      </div>
      <Card className="admin-content-card" title="当前站点配置">
        <Descriptions column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="站点名称">{bootstrap?.site.name}</Descriptions.Item>
          <Descriptions.Item label="站点标识">{bootstrap?.site.slug}</Descriptions.Item>
          <Descriptions.Item label="店铺名">{settings?.shopName}</Descriptions.Item>
          <Descriptions.Item label="发货时间">{settings?.shippingTime}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card className="admin-content-card">
        <Table rowKey="id" columns={siteColumns} dataSource={bootstrap?.sites ?? []} loading={loading} pagination={false} />
      </Card>
    </>
  ) : activePage === 'media' ? (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>图片管理</Title>
          <Text type="secondary">首页轮播和详情图片按区域独立管理。</Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => openMedia(undefined, 'detail')}>
            添加详情图
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openMedia(undefined, 'hero')}>
            添加轮播图
          </Button>
        </Space>
      </div>
      <Card className="admin-filter-card">
        <Space wrap>
          <Select
            aria-label="图片状态筛选"
            value={mediaStatusFilter}
            onChange={(value) => {
              setMediaStatusFilter(value);
              setSelectedMediaIds([]);
            }}
            options={[{ value: 'all', label: '全部状态' }, { value: 'enabled', label: '已启用' }, { value: 'disabled', label: '已禁用' }]}
          />
          <Select
            aria-label="图片类型筛选"
            value={mediaSectionFilter}
            onChange={(value) => {
              setMediaSectionFilter(value);
              setSelectedMediaIds([]);
            }}
            options={[{ value: 'all', label: '全部图片' }, { value: 'hero', label: '轮播图' }, { value: 'detail', label: '详情图' }]}
          />
        </Space>
      </Card>
      <Card className="admin-content-card">
        {mediaTable}
      </Card>
    </>
  ) : activePage === 'reviews' ? (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>评价管理</Title>
          <Text type="secondary">管理当前站点的评价信息。</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openReview()}>
          添加评价
        </Button>
      </div>
      <Card className="admin-filter-card">
        <Space wrap>
          <Select value={reviewStatusFilter} onChange={setReviewStatusFilter} options={[{ value: 'all', label: '全部状态' }, { value: 'enabled', label: '启用' }, { value: 'disabled', label: '禁用' }]} />
          <Input.Search value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} placeholder="输入用户名或评价内容" allowClear />
        </Space>
      </Card>
      <Card className="admin-content-card">
        {reviewTable}
      </Card>
    </>
  ) : (
    <>
      <div className="admin-page-heading">
        <div>
          <Title level={2}>浮层文案管理</Title>
          <Text type="secondary">管理当前站点的浮层购买提示与滚动文案。</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openPurchase()}>
          添加文案
        </Button>
      </div>
      <Card className="admin-content-card">
        {purchaseTable}
      </Card>
    </>
  );
  const drawerTitle = drawer === 'settings' ? '编辑站点配置' : drawer === 'site' ? (siteDraft.id ? '编辑站点' : '新建站点') : drawer === 'media' ? '编辑图片资源' : drawer === 'review' ? '编辑评价' : drawer === 'sku' ? (skuDraft.id ? '编辑规格' : '新增规格') : drawer === 'payment' ? '支付配置' : '编辑浮层文案';
  const drawerContent = drawer === 'settings' ? settingsForm : drawer === 'site' ? siteForm : drawer === 'media' ? mediaForm : drawer === 'review' ? reviewForm : drawer === 'sku' ? skuForm : drawer === 'payment' ? paymentForm : purchaseForm;
  return (
    <>
      <Layout className="antd-admin-layout">
        <Sider theme="light" width={260} breakpoint="lg" collapsedWidth={80}>
          <div className="antd-admin-brand">
            <div className="antd-admin-logo">
              <TagsOutlined />
            </div>
            <div>
              <strong>管理系统</strong>
              <span>多站点后台</span>
            </div>
          </div>
          <Menu mode="inline" selectedKeys={[activePage]} items={navItems} onClick={({ key }) => navigate(`/${key}`)} />
          <div className="antd-admin-account">
            <Tag color="blue">A</Tag>
            <div>
              <strong>管理员</strong>
              <span>{bootstrap?.site.name ?? 'System Admin'}</span>
            </div>
          </div>
        </Sider>
        <Layout>
          <Header className="antd-admin-header">
            <Space>
              <Title level={4}>管理中心</Title>
              {bootstrap && currentSiteId ? (
                <Select
                  className="admin-site-switch"
                  value={currentSiteId}
                  onChange={(id) => updateSiteId(id)}
                  options={bootstrap.sites.map((site) => ({ value: site.id, label: site.name }))}
                />
              ) : null}
            </Space>
            <Space>
              <Button type="text" icon={<BellOutlined />} aria-label="通知" />
              <Button type="text" icon={<QuestionCircleOutlined />} aria-label="帮助" />
              <Button type="link" icon={<LogoutOutlined />} onClick={handleLogout}>
                退出登录
              </Button>
            </Space>
          </Header>
          <Content className="antd-admin-content">{loading && !bootstrap ? <Spin size="large" /> : content}</Content>
        </Layout>
        <Drawer title={drawerTitle} open={Boolean(drawer)} onClose={closeDrawer} width={drawer === 'settings' || drawer === 'payment' ? 720 : 560} destroyOnClose>
          {drawerContent}
        </Drawer>
      </Layout>
      <OrderExportModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        onExport={handleExportOrders}
      />
    </>
  );
}

export function App() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) {
    return <ConfigProvider theme={{ token: { colorPrimary: '#168bff', borderRadius: 6 } }}><AntApp><AdminApp /></AntApp></ConfigProvider>;
  }

  if (pathname === '/payment/return') {
    return <PaymentSuccess />;
  }

  return <PublicApp />;
}
