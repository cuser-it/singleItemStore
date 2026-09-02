import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  defaultBootstrap,
  type FloatingPurchase,
  type MediaAsset,
  type MediaSection,
  type ProductVariant,
  type PublicBootstrap,
  type Review,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from '../shared/site';
import {
  createFloatingPurchase,
  createMediaAsset,
  createReview,
  deleteFloatingPurchase,
  deleteMediaAsset,
  deleteReview,
  fetchAdminBootstrap,
  fetchAdminMe,
  fetchPublicBootstrap,
  loginAdmin,
  logoutAdmin,
  saveSiteSettings,
  updateFloatingPurchase,
  updateMediaAsset,
  updateReview,
  uploadAsset,
} from './api';

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return pathname;
}

function navigate(pathname: string) {
  window.history.pushState({}, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function clampQty(value: number) {
  return Math.max(1, value);
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

function Stepper({ value, onDecrease, onIncrease, className = 'stepper' }: { value: number; onDecrease: () => void; onIncrease: () => void; className?: string }) {
  return (
    <div className={className}>
      <button type="button" onClick={onDecrease} aria-label="减少数量">
        -
      </button>
      <span>{value}</span>
      <button type="button" onClick={onIncrease} aria-label="增加数量">
        +
      </button>
    </div>
  );
}

function PriceBanner({ sku }: { sku: ProductVariant }) {
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
            {sku.saleLabel}
          </text>
          <text x="19" y="79" fontSize="22" fontWeight="700">
            ¥{sku.price.toFixed(1)}
          </text>
        </g>
        <g fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <rect x="120" y="18" width="114" height="29" rx="15" fill="#FF3A68" />
          <text x="177" y="38" fill="#FFFFFF" fontSize="16" fontWeight="700" textAnchor="middle">
            {sku.highlight ?? '50000+已售'}
          </text>
          <rect x="120" y="53" width="130" height="34" rx="17" fill="#FFFFFF" />
          <text x="185" y="76" fill="#FF315F" fontSize="16" fontWeight="700" textAnchor="middle">
            划线¥{sku.originalPrice.toFixed(1)}
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
  return settings.title || defaultBootstrap.settings.title;
}

function PublicApp() {
  const [bootstrap, setBootstrap] = useState<PublicBootstrap>(defaultBootstrap);
  const [slide, setSlide] = useState(0);
  const [selectedSkuId, setSelectedSkuId] = useState(defaultBootstrap.settings.productVariants[0]?.id ?? 'single');
  const [quantity, setQuantity] = useState(1);
  const [checkoutPayment, setCheckoutPayment] = useState<'wechat' | 'alipay'>('wechat');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [purchaseIndex, setPurchaseIndex] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPublicBootstrap().then((data) => {
      if (active) {
        setBootstrap(data);
        setSelectedSkuId(data.settings.productVariants[0]?.id ?? selectedSkuId);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!bootstrap.heroImages.length) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % bootstrap.heroImages.length), 2500);
    return () => window.clearInterval(timer);
  }, [bootstrap.heroImages.length]);

  useEffect(() => {
    if (!bootstrap.floatingPurchases.length) return;
    const timer = window.setInterval(() => setPurchaseIndex((current) => (current + 1) % bootstrap.floatingPurchases.length), 2100);
    return () => window.clearInterval(timer);
  }, [bootstrap.floatingPurchases.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle('body-locked', reviewOpen || checkoutOpen);
    return () => document.body.classList.remove('body-locked');
  }, [reviewOpen, checkoutOpen]);

  const settings = bootstrap.settings;
  const selectedSku = useMemo(
    () => settings.productVariants.find((sku) => sku.id === selectedSkuId) ?? settings.productVariants[0] ?? defaultBootstrap.settings.productVariants[0],
    [selectedSkuId, settings.productVariants],
  );

  const total = selectedSku.price * quantity;
  const reviewTags = settings.reviewTags.length ? settings.reviewTags : defaultBootstrap.settings.reviewTags;
  const heroImages = bootstrap.heroImages.length ? bootstrap.heroImages : defaultBootstrap.heroImages;
  const detailImages = bootstrap.detailImages.length ? bootstrap.detailImages : defaultBootstrap.detailImages;
  const reviews = bootstrap.reviews.length ? bootstrap.reviews : defaultBootstrap.reviews;
  const allReviews = bootstrap.allReviews.length ? bootstrap.allReviews : defaultBootstrap.allReviews;
  const floatingPurchases = bootstrap.floatingPurchases.length ? bootstrap.floatingPurchases : defaultBootstrap.floatingPurchases;
  const latestItems = floatingPurchases.slice(0, 8);
  const floatingItem = latestItems[purchaseIndex % latestItems.length] ?? latestItems[0];

  const showToast = (message = '已为演示页面保留下单样式，未提交任何接口') => setToast(message);

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

        <section className="card pad">
          <div className="shop-line">
            <span>
              <span className="official">商城官方自营</span>
              {settings.reminder}
            </span>
            <span>{settings.soldText}</span>
          </div>
          <h1 className="title">{titleText(settings)}</h1>
          <div className="muted">{settings.subtitle}</div>
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
            <b>宝贝评价({allReviews.length})</b>
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
              <div className="reviewer">{review.name}</div>
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
                <li key={`${item.id}-${index}`}>{item.content}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <div className="purchase-feed" aria-live="polite">
        <p className="purchase-item active">
          <img src={floatingItem?.resolvedUrl ?? '/assets/hero-1.jpg'} alt="" />
          <span>{floatingItem?.content ?? settings.marqueeText}</span>
        </p>
      </div>

      <Sheet open={reviewOpen} title="商品评论" onClose={() => setReviewOpen(false)}>
        <div className="review-sheet-body">
          <div className="review-title-container">宝贝评价({allReviews.length})</div>
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
                <div className="reviewer-row">
                  <div>
                    <div className="reviewer-name">{review.name}</div>
                    <div className="reviewer-sub" />
                  </div>
                </div>
                <div className="context-text">{review.content}</div>
                <div className="sheet-review-image-row">
                  {review.images[0] ? <img src={review.images[0]} alt={`${review.name}图片评论`} /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={checkoutOpen} title="确认订单" onClose={() => setCheckoutOpen(false)}>
        <div className="checkout-sheet-body">
          <div className="checkout-summary">
            <div className="checkout-summary-top">
              <div>
                <div className="checkout-summary-label">当前商品</div>
                <div className="checkout-summary-name">{selectedSku.name}</div>
              </div>
              <div className="checkout-summary-price">¥{total.toFixed(1)}</div>
            </div>
          </div>
          <div className="checkout-body">
            <div className="field-title">规格</div>
            <div className="checkout-specs">
              {settings.productVariants.map((sku) => (
                <button key={sku.id} className={sku.id === selectedSkuId ? 'checkout-spec active' : 'checkout-spec'} type="button" onClick={() => setSelectedSkuId(sku.id)}>
                  {sku.name}
                </button>
              ))}
            </div>
            <div className="checkout-row">
              <label>数 量</label>
              <Stepper value={quantity} onDecrease={() => setQuantity((current) => clampQty(current - 1))} onIncrease={() => setQuantity((current) => current + 1)} className="checkout-stepper" />
            </div>
            <div className="checkout-row">
              <label>总 价</label>
              <div className="checkout-total">¥{total.toFixed(1)}</div>
            </div>
            <div className="checkout-row">
              <label htmlFor="checkoutName">姓 名</label>
              <input id="checkoutName" name="checkoutName" placeholder="请填写姓名" />
            </div>
            <div className="checkout-row">
              <label htmlFor="checkoutPhone">手机号码</label>
              <input id="checkoutPhone" name="checkoutPhone" inputMode="tel" maxLength={11} placeholder="请填写手机号码" />
            </div>
            <div className="checkout-row">
              <label htmlFor="checkoutAddress">收货地址</label>
              <textarea id="checkoutAddress" name="checkoutAddress" placeholder="请填写收货地址" />
            </div>
            <div className="field-title">支付方式</div>
            <div className="checkout-payments">
              <button className={checkoutPayment === 'wechat' ? 'checkout-pay active' : 'checkout-pay'} type="button" onClick={() => setCheckoutPayment('wechat')}>
                微信支付
              </button>
              <button className={checkoutPayment === 'alipay' ? 'checkout-pay active' : 'checkout-pay'} type="button" onClick={() => setCheckoutPayment('alipay')}>
                支付宝支付
              </button>
            </div>
          </div>
        </div>
        <div className="checkout-actions">
          <button
            className="checkout-submit"
            type="button"
            onClick={() => {
              showToast(checkoutPayment === 'alipay' ? '已选择支付宝支付，订单已进入演示提交流程' : '已选择微信支付，订单已进入演示提交流程');
              setCheckoutOpen(false);
            }}
          >
            提交订单
          </button>
        </div>
      </Sheet>

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

function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mediaDraft, setMediaDraft] = useState<MediaDraft>({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: 1, enabled: true });
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({ name: '', content: '', images: '', featuredOnHome: false, homeOrder: 0, enabled: true });
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>({ content: '', enabled: true, sortOrder: 0 });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const refresh = async () => {
    const data = await fetchAdminBootstrap();
    setBootstrap(data);
    setSettings(data.settings);
  };

  useEffect(() => {
    fetchAdminMe().then(async (ok) => {
      setAuthed(ok);
      if (ok) {
        await refresh();
      }
    });
  }, []);

  const resetDrafts = () => {
    setMediaDraft({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: 1, enabled: true });
    setReviewDraft({ name: '', content: '', images: '', featuredOnHome: false, homeOrder: 0, enabled: true });
    setPurchaseDraft({ content: '', enabled: true, sortOrder: 0 });
    setUploadFile(null);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await loginAdmin(password);
      setStatus('登录成功');
      setAuthed(true);
      await refresh();
    } catch {
      setStatus('密码错误');
    }
  };

  const handleSettingsSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const saved = await saveSiteSettings(settings);
    setSettings(saved);
    setStatus('站点配置已更新');
    await refresh();
  };

  const handleMediaSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const source = mediaDraft.sourceType === 'upload' && uploadFile ? (await uploadAsset(uploadFile)).source : mediaDraft.source;
    if (!source.trim()) return;
    const payload = { ...mediaDraft, source };
    if (mediaDraft.id) {
      await updateMediaAsset(mediaDraft.id, payload);
    } else {
      await createMediaAsset(payload);
    }
    setStatus('媒体已保存');
    resetDrafts();
    await refresh();
  };

  const handleReviewSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...reviewDraft, images: reviewDraft.images.split('\n').map((item) => item.trim()).filter(Boolean) };
    if (reviewDraft.id) {
      await updateReview(reviewDraft.id, payload);
    } else {
      await createReview(payload);
    }
    setStatus('评价已保存');
    resetDrafts();
    await refresh();
  };

  const handlePurchaseSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...purchaseDraft };
    if (purchaseDraft.id) {
      await updateFloatingPurchase(purchaseDraft.id, payload);
    } else {
      await createFloatingPurchase(payload);
    }
    setStatus('浮层文案已保存');
    resetDrafts();
    await refresh();
  };

  const handleDeleteMedia = async (id: number) => {
    await deleteMediaAsset(id);
    await refresh();
  };

  const handleDeleteReview = async (id: number) => {
    await deleteReview(id);
    await refresh();
  };

  const handleDeletePurchase = async (id: number) => {
    await deleteFloatingPurchase(id);
    await refresh();
  };

  if (authed === null) {
    return <div className="store-page admin-page"><main className="admin-shell"><section className="card pad">加载中...</section></main></div>;
  }

  if (!authed) {
    return (
      <div className="store-page admin-page">
        <main className="admin-shell">
          <section className="card pad">
            <h1 className="title">后台登录</h1>
            <form className="admin-form" onSubmit={handleLogin}>
              <label>
                密码
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入后台密码" />
              </label>
              <button type="submit" className="checkout-submit">登录</button>
            </form>
            {status ? <div className="muted">{status}</div> : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="store-page admin-page">
      <main className="admin-shell">
        <section className="card pad admin-topbar">
          <div>
            <h1 className="title">后台管理</h1>
            <div className="muted">{status || '可以编辑站点配置、图片、评价和浮层文案'}</div>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" className="buy-now" onClick={() => navigate('/')}>
              返回前台
            </button>
            <button
              type="button"
              className="checkout-submit"
              onClick={async () => {
                await logoutAdmin();
                setAuthed(false);
                setBootstrap(null);
                setStatus('');
              }}
            >
              退出登录
            </button>
          </div>
        </section>

        <section className="card pad admin-section">
          <h2 className="admin-section-title">站点配置</h2>
          {settings ? (
            <form className="admin-form admin-form-grid" onSubmit={handleSettingsSave}>
              <label>
                商品标题
                <input value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} />
              </label>
              <label>
                店铺名称
                <input value={settings.shopName} onChange={(event) => setSettings({ ...settings, shopName: event.target.value })} />
              </label>
              <label>
                副标题
                <input value={settings.subtitle} onChange={(event) => setSettings({ ...settings, subtitle: event.target.value })} />
              </label>
              <label>
                价格文案
                <input value={settings.highlight} onChange={(event) => setSettings({ ...settings, highlight: event.target.value })} />
              </label>
              <label>
                价格
                <input type="number" value={settings.salePrice} onChange={(event) => setSettings({ ...settings, salePrice: Number(event.target.value) })} />
              </label>
              <label>
                划线价
                <input type="number" value={settings.originalPrice} onChange={(event) => setSettings({ ...settings, originalPrice: Number(event.target.value) })} />
              </label>
              <label>
                产品描述
                <input value={settings.productDescription} onChange={(event) => setSettings({ ...settings, productDescription: event.target.value })} />
              </label>
              <label>
                邮费说明
                <input value={settings.shippingNote} onChange={(event) => setSettings({ ...settings, shippingNote: event.target.value })} />
              </label>
              <label>
                温馨提示
                <input value={settings.reminder} onChange={(event) => setSettings({ ...settings, reminder: event.target.value })} />
              </label>
              <label>
                发货时间
                <input value={settings.shippingTime} onChange={(event) => setSettings({ ...settings, shippingTime: event.target.value })} />
              </label>
              <label className="admin-wide">
                首页滚动文案
                <input value={settings.marqueeText} onChange={(event) => setSettings({ ...settings, marqueeText: event.target.value })} />
              </label>
              <label className="admin-wide">
                卖点标签，每行一个
                <textarea value={settings.reviewTags.join('\n')} onChange={(event) => setSettings({ ...settings, reviewTags: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} />
              </label>
              <button type="submit" className="checkout-submit admin-submit">保存站点配置</button>
            </form>
          ) : null}
        </section>

        <section className="card pad admin-section">
          <h2 className="admin-section-title">图片管理</h2>
          <form className="admin-form admin-form-grid" onSubmit={handleMediaSave}>
            <label>
              区域
              <select value={mediaDraft.section} onChange={(event) => setMediaDraft({ ...mediaDraft, section: event.target.value === 'detail' ? 'detail' : 'hero' })}>
                <option value="hero">hero</option>
                <option value="detail">detail</option>
              </select>
            </label>
            <label>
              来源类型
              <select value={mediaDraft.sourceType} onChange={(event) => setMediaDraft({ ...mediaDraft, sourceType: event.target.value === 'upload' ? 'upload' : 'url' })}>
                <option value="url">url</option>
                <option value="upload">upload</option>
              </select>
            </label>
            <label>
              图片地址
              <input value={mediaDraft.source} onChange={(event) => setMediaDraft({ ...mediaDraft, source: event.target.value })} placeholder="https://... 或 /img/..." />
            </label>
            <label>
              上传文件
              <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              替代文本
              <input value={mediaDraft.alt} onChange={(event) => setMediaDraft({ ...mediaDraft, alt: event.target.value })} />
            </label>
            <label>
              排序
              <input type="number" value={mediaDraft.sortOrder} onChange={(event) => setMediaDraft({ ...mediaDraft, sortOrder: Number(event.target.value) })} />
            </label>
            <label>
              启用
              <input type="checkbox" checked={mediaDraft.enabled} onChange={(event) => setMediaDraft({ ...mediaDraft, enabled: event.target.checked })} />
            </label>
            <button type="submit" className="checkout-submit admin-submit">{mediaDraft.id ? '更新图片' : '新增图片'}</button>
            <button type="button" className="buy-now admin-reset" onClick={() => { setMediaDraft({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: 1, enabled: true }); setUploadFile(null); }}>
              清空
            </button>
          </form>
          <div className="admin-list">
            {(bootstrap?.heroImages ?? []).concat(bootstrap?.detailImages ?? []).map((item) => (
              <div className="admin-list-row" key={item.id}>
                <div>
                  <strong>{item.section}</strong> {item.alt}
                  <div className="muted">{item.resolvedUrl}</div>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => setMediaDraft({ id: item.id, section: item.section, sourceType: item.sourceType, source: item.source, alt: item.alt, sortOrder: item.sortOrder, enabled: item.enabled })}>
                    编辑
                  </button>
                  <button type="button" onClick={() => handleDeleteMedia(item.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card pad admin-section">
          <h2 className="admin-section-title">评价管理</h2>
          <form className="admin-form admin-form-grid" onSubmit={handleReviewSave}>
            <label>
              用户名
              <input value={reviewDraft.name} onChange={(event) => setReviewDraft({ ...reviewDraft, name: event.target.value })} />
            </label>
            <label>
              置顶顺序
              <input type="number" value={reviewDraft.homeOrder} onChange={(event) => setReviewDraft({ ...reviewDraft, homeOrder: Number(event.target.value) })} />
            </label>
            <label className="admin-wide">
              评价内容
              <textarea value={reviewDraft.content} onChange={(event) => setReviewDraft({ ...reviewDraft, content: event.target.value })} />
            </label>
            <label className="admin-wide">
              图片地址，每行一个
              <textarea value={reviewDraft.images} onChange={(event) => setReviewDraft({ ...reviewDraft, images: event.target.value })} />
            </label>
            <label>
              首页展示
              <input type="checkbox" checked={reviewDraft.featuredOnHome} onChange={(event) => setReviewDraft({ ...reviewDraft, featuredOnHome: event.target.checked })} />
            </label>
            <label>
              启用
              <input type="checkbox" checked={reviewDraft.enabled} onChange={(event) => setReviewDraft({ ...reviewDraft, enabled: event.target.checked })} />
            </label>
            <button type="submit" className="checkout-submit admin-submit">{reviewDraft.id ? '更新评价' : '新增评价'}</button>
          </form>
          <div className="admin-list">
            {(bootstrap?.allReviews ?? []).map((item) => (
              <div className="admin-list-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{item.content}</div>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => setReviewDraft({ id: item.id, name: item.name, content: item.content, images: item.images.join('\n'), featuredOnHome: item.featuredOnHome, homeOrder: item.homeOrder, enabled: item.enabled })}>
                    编辑
                  </button>
                  <button type="button" onClick={() => handleDeleteReview(item.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card pad admin-section">
          <h2 className="admin-section-title">浮层文案管理</h2>
          <form className="admin-form admin-form-grid" onSubmit={handlePurchaseSave}>
            <label className="admin-wide">
              文案
              <input value={purchaseDraft.content} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, content: event.target.value })} />
            </label>
            <label>
              排序
              <input type="number" value={purchaseDraft.sortOrder} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, sortOrder: Number(event.target.value) })} />
            </label>
            <label>
              启用
              <input type="checkbox" checked={purchaseDraft.enabled} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, enabled: event.target.checked })} />
            </label>
            <button type="submit" className="checkout-submit admin-submit">{purchaseDraft.id ? '更新文案' : '新增文案'}</button>
          </form>
          <div className="admin-list">
            {(bootstrap?.floatingPurchases ?? []).map((item) => (
              <div className="admin-list-row" key={item.id}>
                <div>
                  <strong>{item.content}</strong>
                </div>
                <div className="admin-row-actions">
                  <button type="button" onClick={() => setPurchaseDraft({ id: item.id, content: item.content, enabled: item.enabled, sortOrder: item.sortOrder })}>
                    编辑
                  </button>
                  <button type="button" onClick={() => handleDeletePurchase(item.id)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export function App() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) {
    return <AdminApp />;
  }

  return <PublicApp />;
}
