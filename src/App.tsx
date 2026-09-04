import { lazy, Suspense, useEffect, useState } from 'react';
import { CheckoutSheet, clampCheckoutQuantity, type CheckoutRecipient } from './components/CheckoutSheet';
import { usePathname } from './hooks/usePathname';
import type { PublicBootstrap, SiteSettings } from '../shared/site';
import type { Order } from '../shared/order';
const PaymentSuccess = lazy(() => import('./PaymentSuccess'));
import { fetchPublicBootstrap, createOrder, queryPublicOrder } from './api';

// 懒加载管理后台，避免前台页面加载 Ant Design
const AdminApp = lazy(() => import('./AdminApp').then(m => ({ default: m.AdminAppShell })));

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

function getRandomAvatar(seed: string | number) {
  const value = String(seed);
  const palette = ['#f97316', '#0ea5e9', '#22c55e', '#e11d48'];
  const color = palette[value.charCodeAt(0) % palette.length];
  const initial = value.slice(-1).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="white">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
        <div className="admin-loading" role="alert">
          <strong>前台加载失败</strong>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="store-page">
        <div className="admin-loading" aria-label="页面加载中">加载中...</div>
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
            {heroImages.map((image, index) => (
              <div className="slide" key={image.id}>
                <img src={image.resolvedUrl} alt={image.alt} draggable={false} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} />
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

      {reviewOpen && (
        <Sheet open title="商品评论" onClose={() => setReviewOpen(false)}>
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
                    <button type="button" onClick={() => handleReviewLike(review.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: '#f5f5f5', border: 'none', borderRadius: '12px', fontSize: '12px', color: '#666', cursor: 'pointer' }}>
                      <span>👍</span>
                      <span>{reviewLikes?.[review.id] ?? 0}</span>
                    </button>
                  </div>
                  <div className="context-text">{review.content}</div>
                  <div className="sheet-review-image-row">
                    {review.images[0] ? <img src={review.images[0]} alt={`${review.name}图片评论`} loading="lazy" /> : null}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#999' }}>
              仅展示最近10条评论
            </div>
          </div>
        </Sheet>
      )}

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
export function App() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="admin-loading">后台加载中...</div>}>
        <AdminApp />
      </Suspense>
    );
  }

  if (pathname === '/payment/return') {
    return <PaymentSuccess />;
  }

  return <DRu />;
}
