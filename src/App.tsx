import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bell, HelpCircle, Image, LayoutDashboard, Layers, LogOut, MessageSquare, Plus, Search, Settings, ShoppingBag, SlidersHorizontal } from 'lucide-react';
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
  const selectedSku = useMemo(() => {
    const sku = settings.productVariants.find((item) => item.id === selectedSkuId) ?? settings.productVariants[0] ?? defaultBootstrap.settings.productVariants[0];
    const primarySkuId = settings.productVariants[0]?.id ?? sku.id;

    if (sku.id !== primarySkuId) {
      return sku;
    }

    return {
      ...sku,
      price: settings.salePrice,
      originalPrice: settings.originalPrice,
    };
  }, [selectedSkuId, settings.productVariants, settings.salePrice, settings.originalPrice]);

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
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [mediaDraft, setMediaDraft] = useState<MediaDraft>({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: 1, enabled: true });
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({ name: '', content: '', images: '', featuredOnHome: false, homeOrder: 0, enabled: true });
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>({ content: '', enabled: true, sortOrder: 0 });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [activePage, setActivePage] = useState<'dashboard' | 'site-settings' | 'media-assets' | 'reviews' | 'floating-purchases'>('dashboard');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [reviewQuery, setReviewQuery] = useState('');

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

  const handleLogout = async () => {
    await logoutAdmin();
    setAuthed(false);
    setBootstrap(null);
    setStatus('');
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

  const isDesktop = useIsDesktop();
  const mediaAssets = (bootstrap?.heroImages ?? []).concat(bootstrap?.detailImages ?? []);
  const allReviews = bootstrap?.allReviews ?? [];
  const enabledReviews = allReviews.filter((item) => item.enabled);
  const filteredReviews = allReviews.filter((item) => {
    const matchStatus = reviewStatusFilter === 'all' || (reviewStatusFilter === 'enabled' ? item.enabled : !item.enabled);
    const keyword = reviewQuery.trim().toLowerCase();
    const matchQuery = !keyword || item.name.toLowerCase().includes(keyword) || item.content.toLowerCase().includes(keyword);
    return matchStatus && matchQuery;
  });
  const adminSections = [
    { id: 'dashboard', label: '控制台', icon: LayoutDashboard },
    { id: 'site-settings', label: '站点配置', icon: Settings },
    { id: 'media-assets', label: '图片管理', icon: Image },
    { id: 'reviews', label: '评价管理', icon: MessageSquare },
    { id: 'floating-purchases', label: '浮层文案管理', icon: Layers },
  ] as const;

  if (!isDesktop) {
    return <AdminBlocked />;
  }

  if (authed === null) {
    return (
      <div className="store-page admin-page">
        <main className="admin-auth-shell">
          <section className="admin-auth-card">
            <div className="admin-auth-kicker">后台管理</div>
            <div className="title">加载中...</div>
          </section>
        </main>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="store-page admin-page">
        <main className="admin-auth-shell">
          <section className="admin-auth-card admin-login-panel">
            <div className="admin-auth-kicker">单店后台</div>
            <h1 className="title">后台登录</h1>
            <p className="muted">后台仅支持桌面端访问，请使用电脑浏览器继续。</p>
            <form className="admin-form admin-login-form" onSubmit={handleLogin}>
              <label>
                密码
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入后台密码" />
              </label>
              <button type="submit" className="admin-primary-button">登录</button>
            </form>
            {status ? <div className="muted">{status}</div> : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="store-page admin-page">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand-row">
            <div className="admin-brand-mark"><ShoppingBag size={22} /></div>
            <div>
              <h1>管理系统</h1>
              <p>企业级后台</p>
            </div>
          </div>
          <nav className="admin-nav" aria-label="后台导航">
            {adminSections.map((section) => {
              const Icon = section.icon;
              return (
                <button key={section.id} type="button" className={activePage === section.id ? 'admin-nav-item admin-nav-item--active' : 'admin-nav-item'} onClick={() => setActivePage(section.id)}>
                  <Icon size={22} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="admin-user-card">
            <div className="admin-avatar">管</div>
            <div>
              <strong>管理员</strong>
              <span>System Admin</span>
            </div>
          </div>
        </aside>

        <div className="admin-workspace">
          <header className="admin-header">
            <h2>管理中心</h2>
            <div className="admin-search"><Search size={18} /><input placeholder="全局搜索..." aria-label="全局搜索" /></div>
            <div className="admin-header-actions">
              <button type="button" aria-label="通知"><Bell size={22} /><i /></button>
              <button type="button" aria-label="帮助"><HelpCircle size={22} /></button>
              <div className="admin-header-user"><div className="admin-avatar admin-avatar--small">A</div><span>Admin</span></div>
              <button type="button" className="admin-logout" onClick={handleLogout}><LogOut size={16} />退出登录</button>
            </div>
          </header>

          <main className="admin-content">
            {activePage === 'dashboard' ? (
              <>
                <section className="admin-page-title">
                  <h1>欢迎回来</h1>
                  <p>这里是您今天的数据概览。</p>
                </section>
                <section className="admin-stat-grid" aria-label="后台数据概览">
                  <article className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--blue"><Image size={28} /></div>
                    <div><span>图片总数</span><strong>{mediaAssets.length.toLocaleString()}</strong><small>+{Math.max(mediaAssets.filter((item) => item.enabled).length, 0)} 已启用</small></div>
                  </article>
                  <article className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--orange"><MessageSquare size={28} /></div>
                    <div><span>评价总数</span><strong>{allReviews.length.toLocaleString()}</strong><small>+{enabledReviews.length} 已启用</small></div>
                  </article>
                  <article className="admin-stat-card">
                    <div className="admin-stat-icon admin-stat-icon--slate"><Layers size={28} /></div>
                    <div><span>活跃浮层</span><strong>{(bootstrap?.floatingPurchases ?? []).filter((item) => item.enabled).length}</strong><small>持平 较上周</small></div>
                  </article>
                </section>
                <section className="admin-quick-grid">
                  <button type="button" className="admin-quick-card" onClick={() => setActivePage('site-settings')}>
                    <Settings size={24} /><span><strong>站点配置</strong><small>管理系统全局设置，包括基础信息与核心参数。</small></span>
                  </button>
                  <button type="button" className="admin-quick-card" onClick={() => setActivePage('media-assets')}>
                    <Image size={24} /><span><strong>媒体资产</strong><small>快速上传、归档及管理全局图片资源。</small></span>
                  </button>
                </section>
              </>
            ) : null}

            {activePage === 'site-settings' ? (
              <section className="admin-page-stack">
                <div className="admin-page-title">
                  <h1>站点配置</h1>
                  <p>管理基础信息、展示内容及业务规则配置。</p>
                </div>
                <div className="admin-panel">
                  <h2>基础信息</h2>
                  {settings ? (
                    <form className="admin-form admin-form-grid" onSubmit={handleSettingsSave}>
                      <label className="admin-wide">店铺名 <input value={settings.shopName} onChange={(event) => setSettings({ ...settings, shopName: event.target.value })} /></label>
                      <label>标题 <input value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} /></label>
                      <label>副标题 <input value={settings.subtitle} onChange={(event) => setSettings({ ...settings, subtitle: event.target.value })} /></label>
                      <label className="admin-wide">描述 <textarea value={settings.productDescription} onChange={(event) => setSettings({ ...settings, productDescription: event.target.value })} /></label>
                      <label className="admin-wide">滚动文案 <input value={settings.marqueeText} onChange={(event) => setSettings({ ...settings, marqueeText: event.target.value })} /></label>
                      <h2 className="admin-wide">业务规则</h2>
                      <label>价格 (¥) <input type="number" value={settings.salePrice} onChange={(event) => setSettings({ ...settings, salePrice: Number(event.target.value) })} /></label>
                      <label>原价 (¥) <input type="number" value={settings.originalPrice} onChange={(event) => setSettings({ ...settings, originalPrice: Number(event.target.value) })} /></label>
                      <label>邮费 (¥) <input value={settings.shippingNote} onChange={(event) => setSettings({ ...settings, shippingNote: event.target.value })} /></label>
                      <label>发货时间 <select value={settings.shippingTime} onChange={(event) => setSettings({ ...settings, shippingTime: event.target.value })}><option>24小时内发货</option><option>48小时内发货</option><option>72小时内发货</option></select></label>
                      <h2 className="admin-wide">附加信息</h2>
                      <label className="admin-wide">标签 <textarea value={settings.reviewTags.join('\n')} onChange={(event) => setSettings({ ...settings, reviewTags: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label>
                      <label className="admin-wide">提示语 (Tips) <input value={settings.reminder} onChange={(event) => setSettings({ ...settings, reminder: event.target.value })} /></label>
                      <div className="admin-form-actions admin-wide">
                        <button type="button" className="admin-secondary-button" onClick={() => bootstrap && setSettings(bootstrap.settings)}>重置</button>
                        <button type="submit" className="admin-primary-button">修改配置</button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </section>
            ) : null}

            {activePage === 'media-assets' ? (
              <section className="admin-page-stack">
                <div className="admin-title-row"><div className="admin-page-title"><h1>图片管理</h1><p>管理首页轮播图与详情页图片资源。</p></div><button type="button" className="admin-primary-button" onClick={() => setMediaDraft({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: mediaAssets.length + 1, enabled: true })}><Plus size={18} />添加图片</button></div>
                <div className="admin-panel">
                  <form className="admin-form admin-form-grid" onSubmit={handleMediaSave}>
                    <label>区域 <select value={mediaDraft.section} onChange={(event) => setMediaDraft({ ...mediaDraft, section: event.target.value === 'detail' ? 'detail' : 'hero' })}><option value="hero">首页轮播</option><option value="detail">详情图片</option></select></label>
                    <label>来源类型 <select value={mediaDraft.sourceType} onChange={(event) => setMediaDraft({ ...mediaDraft, sourceType: event.target.value === 'upload' ? 'upload' : 'url' })}><option value="url">URL</option><option value="upload">上传</option></select></label>
                    <label>图片地址 <input value={mediaDraft.source} onChange={(event) => setMediaDraft({ ...mediaDraft, source: event.target.value })} placeholder="https://... 或 /img/..." /></label>
                    <label>上传文件 <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} /></label>
                    <label>替代文本 <input value={mediaDraft.alt} onChange={(event) => setMediaDraft({ ...mediaDraft, alt: event.target.value })} /></label>
                    <label>排序 <input type="number" value={mediaDraft.sortOrder} onChange={(event) => setMediaDraft({ ...mediaDraft, sortOrder: Number(event.target.value) })} /></label>
                    <label className="admin-check"><input type="checkbox" checked={mediaDraft.enabled} onChange={(event) => setMediaDraft({ ...mediaDraft, enabled: event.target.checked })} />启用</label>
                    <div className="admin-form-actions"><button type="submit" className="admin-primary-button">{mediaDraft.id ? '更新图片' : '新增图片'}</button><button type="button" className="admin-secondary-button" onClick={resetDrafts}>清空</button></div>
                  </form>
                </div>
                <div className="admin-table-card"><table className="admin-table"><thead><tr><th>预览</th><th>区域</th><th>图片地址</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>{mediaAssets.map((item) => (<tr key={item.id}><td>{item.resolvedUrl ? <img className="admin-thumb" src={item.resolvedUrl} alt={item.alt} /> : '无图片'}</td><td>{item.section === 'hero' ? '首页轮播' : '详情图片'}</td><td className="admin-ellipsis">{item.resolvedUrl}</td><td>{item.sortOrder}</td><td><span className={item.enabled ? 'admin-status-pill admin-status-pill--enabled' : 'admin-status-pill admin-status-pill--disabled'}>{item.enabled ? '启用' : '禁用'}</span></td><td><div className="admin-row-actions"><button type="button" onClick={() => setMediaDraft({ id: item.id, section: item.section, sourceType: item.sourceType, source: item.source, alt: item.alt, sortOrder: item.sortOrder, enabled: item.enabled })}>编辑</button><button type="button" onClick={() => handleDeleteMedia(item.id)}>删除</button></div></td></tr>))}</tbody></table></div>
              </section>
            ) : null}

            {activePage === 'reviews' ? (
              <section className="admin-page-stack">
                <div className="admin-title-row"><div className="admin-page-title"><h1>评价管理</h1><p>管理用户对产品或服务的评价信息。</p></div><button type="button" className="admin-primary-button" onClick={() => setReviewDraft({ name: '', content: '', images: '', featuredOnHome: true, homeOrder: allReviews.length + 1, enabled: true })}><Plus size={18} />添加评价</button></div>
                <div className="admin-filter-panel"><label>评价状态<select value={reviewStatusFilter} onChange={(event) => setReviewStatusFilter(event.target.value as typeof reviewStatusFilter)}><option value="all">全部状态</option><option value="enabled">启用</option><option value="disabled">禁用</option></select></label><label>用户名搜索<span className="admin-input-with-icon"><Search size={18} /><input value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} placeholder="输入用户名..." /></span></label><button type="button" className="admin-secondary-button" onClick={() => { setReviewStatusFilter('all'); setReviewQuery(''); }}>重置</button><button type="button" className="admin-primary-button"><SlidersHorizontal size={16} />查询</button></div>
                <div className="admin-panel">
                  <form className="admin-form admin-form-grid" onSubmit={handleReviewSave}>
                    <label>用户名 <input value={reviewDraft.name} onChange={(event) => setReviewDraft({ ...reviewDraft, name: event.target.value })} /></label>
                    <label>排序 <input type="number" value={reviewDraft.homeOrder} onChange={(event) => setReviewDraft({ ...reviewDraft, homeOrder: Number(event.target.value) })} /></label>
                    <label className="admin-wide">内容 <textarea value={reviewDraft.content} onChange={(event) => setReviewDraft({ ...reviewDraft, content: event.target.value })} /></label>
                    <label className="admin-wide">图片地址，每行一个 <textarea value={reviewDraft.images} onChange={(event) => setReviewDraft({ ...reviewDraft, images: event.target.value })} /></label>
                    <label className="admin-check"><input type="checkbox" checked={reviewDraft.featuredOnHome} onChange={(event) => setReviewDraft({ ...reviewDraft, featuredOnHome: event.target.checked })} />首页展示</label>
                    <label className="admin-check"><input type="checkbox" checked={reviewDraft.enabled} onChange={(event) => setReviewDraft({ ...reviewDraft, enabled: event.target.checked })} />启用</label>
                    <div className="admin-form-actions"><button type="submit" className="admin-primary-button">{reviewDraft.id ? '更新评价' : '新增评价'}</button><button type="button" className="admin-secondary-button" onClick={resetDrafts}>清空</button></div>
                  </form>
                </div>
                <div className="admin-table-card"><table className="admin-table"><thead><tr><th>用户名</th><th>内容</th><th>图片预览</th><th>首页展示</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>{filteredReviews.map((item) => (<tr key={item.id}><td><div className="admin-user-cell"><div className="admin-avatar admin-avatar--small">{item.name.slice(0, 1).toUpperCase()}</div><span>{item.name}</span></div></td><td>{item.content}</td><td>{item.images[0] ? <img className="admin-thumb" src={item.images[0]} alt={`${item.name}评价图`} /> : '无图片'}</td><td><button type="button" className={item.featuredOnHome ? 'admin-switch admin-switch--on' : 'admin-switch'} onClick={async () => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome: !item.featuredOnHome, homeOrder: item.homeOrder, enabled: item.enabled }); await refresh(); }} aria-label={`${item.name}首页展示`} /></td><td><input className="admin-order-input" type="number" value={item.homeOrder} onChange={async (event) => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome: item.featuredOnHome, homeOrder: Number(event.target.value), enabled: item.enabled }); await refresh(); }} /></td><td><button type="button" className={item.enabled ? 'admin-status-pill admin-status-pill--enabled' : 'admin-status-pill admin-status-pill--disabled'} onClick={async () => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome: item.featuredOnHome, homeOrder: item.homeOrder, enabled: !item.enabled }); await refresh(); }}>{item.enabled ? '启用' : '禁用'}</button></td><td><div className="admin-row-actions"><button type="button" onClick={() => setReviewDraft({ id: item.id, name: item.name, content: item.content, images: item.images.join('\n'), featuredOnHome: item.featuredOnHome, homeOrder: item.homeOrder, enabled: item.enabled })}>编辑</button><button type="button" onClick={() => handleDeleteReview(item.id)}>删除</button></div></td></tr>))}</tbody></table><div className="admin-pagination">共 {filteredReviews.length} 条记录，当前第 1/1 页 <span><button type="button" disabled>‹</button><button type="button" className="active">1</button><button type="button" disabled>›</button></span></div></div>
              </section>
            ) : null}

            {activePage === 'floating-purchases' ? (
              <section className="admin-page-stack">
                <div className="admin-page-title"><h1>浮层文案管理</h1><p>管理首页浮层购买提示与滚动文案。</p></div>
                <div className="admin-panel"><form className="admin-form admin-form-grid" onSubmit={handlePurchaseSave}><label className="admin-wide">文案 <input value={purchaseDraft.content} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, content: event.target.value })} /></label><label>排序 <input type="number" value={purchaseDraft.sortOrder} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, sortOrder: Number(event.target.value) })} /></label><label className="admin-check"><input type="checkbox" checked={purchaseDraft.enabled} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, enabled: event.target.checked })} />启用</label><div className="admin-form-actions"><button type="submit" className="admin-primary-button">{purchaseDraft.id ? '更新文案' : '新增文案'}</button><button type="button" className="admin-secondary-button" onClick={resetDrafts}>清空</button></div></form></div>
                <div className="admin-table-card"><table className="admin-table"><thead><tr><th>文案</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>{(bootstrap?.floatingPurchases ?? []).map((item) => (<tr key={item.id}><td>{item.content}</td><td>{item.sortOrder}</td><td><span className={item.enabled ? 'admin-status-pill admin-status-pill--enabled' : 'admin-status-pill admin-status-pill--disabled'}>{item.enabled ? '启用' : '禁用'}</span></td><td><div className="admin-row-actions"><button type="button" onClick={() => setPurchaseDraft({ id: item.id, content: item.content, enabled: item.enabled, sortOrder: item.sortOrder })}>编辑</button><button type="button" onClick={() => handleDeletePurchase(item.id)}>删除</button></div></td></tr>))}</tbody></table></div>
              </section>
            ) : null}
            {status ? <div className="admin-floating-status">{status}</div> : null}
          </main>
        </div>
      </div>
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
