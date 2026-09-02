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
  Modal,
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
} from 'antd';
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
  type ProductVariant,
  type PublicBootstrap,
  type Review,
  type Site,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from '../shared/site';
import {
  activateSite,
  createFloatingPurchase,
  createMediaAsset,
  createReview,
  createSite,
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
  updateSite,
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
  return settings.title || settings.shopName;
}

function PublicApp() {
  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [loadError, setLoadError] = useState('');
  const [slide, setSlide] = useState(0);
  const [selectedSkuId, setSelectedSkuId] = useState('single');
  const [quantity, setQuantity] = useState(1);
  const [checkoutPayment, setCheckoutPayment] = useState<'wechat' | 'alipay'>('wechat');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [purchaseIndex, setPurchaseIndex] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPublicBootstrap()
      .then((data) => {
        if (!active) return;
        setBootstrap(data);
        setSelectedSkuId(data.settings.productVariants[0]?.id ?? 'single');
        setLoadError('');
      })
      .catch(() => {
        if (active) setLoadError('前台数据加载失败，请刷新后重试');
      });
    return () => {
      active = false;
    };
  }, []);

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
  const firstVariant = settings.productVariants[0];
  const selectedSku = (() => {
    if (!firstVariant) {
      return {
        id: 'single',
        name: settings.title || settings.shopName,
        subtitle: settings.subtitle,
        price: settings.salePrice,
        originalPrice: settings.originalPrice,
        saleLabel: '券后价',
      } as ProductVariant;
    }

    if (selectedSkuId === firstVariant.id) {
      return {
        ...firstVariant,
        price: settings.salePrice,
        originalPrice: settings.originalPrice,
      };
    }

    return settings.productVariants.find((item) => item.id === selectedSkuId) ?? firstVariant;
  })();

  const total = selectedSku.price * quantity;
  const reviewTags = settings.reviewTags;
  const heroImages = bootstrap.heroImages;
  const detailImages = bootstrap.detailImages;
  const reviews = bootstrap.reviews;
  const allReviews = bootstrap.allReviews;
  const floatingPurchases = bootstrap.floatingPurchases;
  const latestItems = floatingPurchases.slice(0, 8);
  const floatingItem = latestItems[purchaseIndex % latestItems.length] ?? null;

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
          <img src={floatingItem?.resolvedUrl ?? floatingPurchases[0]?.resolvedUrl ?? ''} alt="" />
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

type SiteDraft = {
  id?: number;
  name: string;
  slug: string;
  templateSiteId?: number;
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
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState<'settings' | 'site' | 'media' | 'review' | 'purchase' | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>({ name: '', slug: '', templateSiteId: undefined });
  const [mediaDraft, setMediaDraft] = useState<MediaDraft>({ section: 'hero', sourceType: 'url', source: '', alt: '', sortOrder: 1, enabled: true });
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({ name: '', content: '', images: '', featuredOnHome: false, homeOrder: 0, enabled: true });
  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft>({ content: '', enabled: true, sortOrder: 0 });
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [reviewQuery, setReviewQuery] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { Title, Text } = Typography;
  const { message } = AntApp.useApp();
  const { Header, Sider, Content } = Layout;

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBootstrap();
      setBootstrap(data);
      setSettings(data.settings);
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
      await saveSiteSettings({
        ...settings,
        ...values,
        guarantee: lines(values.guarantee, settings.guarantee),
        reviewTags: lines(values.reviewTags, settings.reviewTags),
      });
      closeDrawer();
      await refresh();
      message.success('站点配置已保存');
    } catch {
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
    } catch {
      message.error('站点保存失败，请检查名称或标识是否重复');
    }
  };
  const handleActivateSite = async (site: Site) => {
    if (site.isActive) return;
    try {
      await activateSite(site.id);
      await refresh();
      message.success(`已切换到${site.name}`);
    } catch {
      message.error('切换站点失败');
    }
  };
  const handleMediaSave = async () => {
    try {
      const source = mediaDraft.sourceType === 'upload' && uploadFile ? (await uploadAsset(uploadFile)).source : mediaDraft.source;
      if (!source.trim()) {
        message.warning('请上传图片或填写图片地址');
        return;
      }
      const payload = { ...mediaDraft, source };
      if (mediaDraft.section === 'hero' && !mediaDraft.id && (bootstrap?.heroImages.length ?? 0) >= 15) {
        message.warning('首页轮播图最多 15 张');
        return;
      }
      if (mediaDraft.id) await updateMediaAsset(mediaDraft.id, payload); else await createMediaAsset(payload);
      closeDrawer();
      await refresh();
      message.success(mediaDraft.id ? '图片已保存' : '图片已添加');
    } catch {
      message.error('图片保存失败');
    }
  };
  const handleReviewSave = async () => {
    try {
      const uploaded = drawer === 'review' && uploadFile ? (await uploadAsset(uploadFile)).source : '';
      const images = reviewDraft.images.split('\n').map((item) => item.trim()).filter(Boolean);
      const payload = { ...reviewDraft, images: uploaded ? [uploaded, ...images] : images };
      if (reviewDraft.id) await updateReview(reviewDraft.id, payload); else await createReview(payload);
      closeDrawer();
      await refresh();
      message.success(reviewDraft.id ? '评价已保存' : '评价已添加');
    } catch {
      message.error('评价保存失败');
    }
  };
  const handlePurchaseSave = async () => {
    try {
      if (purchaseDraft.id) await updateFloatingPurchase(purchaseDraft.id, purchaseDraft); else await createFloatingPurchase(purchaseDraft);
      closeDrawer();
      await refresh();
      message.success(purchaseDraft.id ? '浮层文案已保存' : '浮层文案已添加');
    } catch {
      message.error('浮层文案保存失败');
    }
  };
  const confirmDelete = (title: string, action: () => Promise<void>) => {
    Modal.confirm({
      title: `确定删除${title}吗？`,
      content: '删除后无法恢复，请确认当前操作。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await action();
          await refresh();
          message.success(`${title}已删除`);
        } catch {
          message.error(`${title}删除失败`);
        }
      },
    });
  };

  const isDesktop = useIsDesktop();
  const mediaAssets = (bootstrap?.heroImages ?? []).concat(bootstrap?.detailImages ?? []);
  const reviews = (bootstrap?.allReviews ?? []).filter((item) => {
    const statusMatch = reviewStatusFilter === 'all' || (reviewStatusFilter === 'enabled' ? item.enabled : !item.enabled);
    const query = reviewQuery.trim().toLowerCase();
    return statusMatch && (!query || item.name.toLowerCase().includes(query) || item.content.toLowerCase().includes(query));
  });
  const navItems = [
    { key: 'dashboard', icon: <AppstoreOutlined />, label: '控制台' },
    { key: 'settings', icon: <SettingOutlined />, label: '站点管理' },
    { key: 'media', icon: <FileImageOutlined />, label: '图片管理' },
    { key: 'reviews', icon: <FormOutlined />, label: '评价管理' },
    { key: 'purchases', icon: <TagsOutlined />, label: '浮层文案管理' },
  ];

  if (!isDesktop) return <AdminBlocked />;
  if (authed === null) return <div className="admin-loading"><Spin size="large" /></div>;
  if (!authed) return <div className="admin-login-page"><Card className="admin-login-card"><Text type="secondary">多站点后台</Text><Title level={2}>后台登录</Title><Text type="secondary">后台仅支持桌面端访问，请使用电脑浏览器继续。</Text><form onSubmit={handleLogin}><label>密码<Input.Password value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入后台密码" /></label><Button htmlType="submit" type="primary" block>登录</Button></form></Card></div>;

  const settingsInitialValues = settings ? { ...settings, guarantee: settings.guarantee.join('\n'), reviewTags: settings.reviewTags.join('\n') } : undefined;
  const settingsForm = settings ? <Form layout="vertical" initialValues={settingsInitialValues} onFinish={handleSettingsSave}><Row gutter={20}><Col span={24}><Form.Item name="shopName" label="店铺名"><Input /></Form.Item></Col><Col span={12}><Form.Item name="title" label="标题"><Input /></Form.Item></Col><Col span={12}><Form.Item name="subtitle" label="副标题"><Input /></Form.Item></Col><Col span={24}><Form.Item name="productDescription" label="描述"><Input.TextArea rows={3} /></Form.Item></Col><Col span={24}><Form.Item name="marqueeText" label="滚动文案"><Input /></Form.Item></Col><Col span={12}><Form.Item name="salePrice" label="价格 (¥)"><Input type="number" /></Form.Item></Col><Col span={12}><Form.Item name="originalPrice" label="原价 (¥)"><Input type="number" /></Form.Item></Col><Col span={12}><Form.Item name="shippingNote" label="邮费说明"><Input /></Form.Item></Col><Col span={12}><Form.Item name="shippingTime" label="发货时间"><Input /></Form.Item></Col><Col span={24}><Form.Item name="guarantee" label="保障文案，每行一个"><Input.TextArea rows={3} /></Form.Item></Col><Col span={24}><Form.Item name="reviewTags" label="评价标签，每行一个"><Input.TextArea rows={2} /></Form.Item></Col><Col span={24}><Form.Item name="reminder" label="提示语"><Input /></Form.Item></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">保存配置</Button></Space></Form> : null;
  const siteForm = <Form layout="vertical" onFinish={handleSiteSave}><Form.Item label="站点名称" required><Input value={siteDraft.name} onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} placeholder="例如 华东商城" /></Form.Item><Form.Item label="站点标识" required><Input value={siteDraft.slug} onChange={(event) => setSiteDraft({ ...siteDraft, slug: event.target.value })} placeholder="例如 east-store" /></Form.Item>{siteDraft.id ? null : <Form.Item label="复制模板"><Select value={siteDraft.templateSiteId} onChange={(templateSiteId) => setSiteDraft({ ...siteDraft, templateSiteId })} options={(bootstrap?.sites ?? []).map((site) => ({ value: site.id, label: site.name }))} /></Form.Item>}<Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{siteDraft.id ? '保存站点' : '创建站点'}</Button></Space></Form>;
  const mediaForm = <Form layout="vertical" onFinish={handleMediaSave}><Row gutter={20}><Col span={12}><Form.Item label="区域"><Select value={mediaDraft.section} onChange={(section) => setMediaDraft({ ...mediaDraft, section })} options={[{ value: 'hero', label: '首页轮播' }, { value: 'detail', label: '详情图片' }]} /></Form.Item></Col><Col span={12}><Form.Item label="来源类型"><Select value={mediaDraft.sourceType} onChange={(sourceType) => setMediaDraft({ ...mediaDraft, sourceType })} options={[{ value: 'url', label: 'URL' }, { value: 'upload', label: '上传' }]} /></Form.Item></Col><Col span={24}><Form.Item label="图片地址"><Input value={mediaDraft.source} onChange={(event) => setMediaDraft({ ...mediaDraft, source: event.target.value })} placeholder="https://... 或 /img/..." /></Form.Item></Col><Col span={24}><Form.Item label="上传文件"><Upload beforeUpload={(file) => { setUploadFile(file); return false; }} maxCount={1}><Button icon={<UploadOutlined />}>选择文件</Button></Upload></Form.Item></Col><Col span={12}><Form.Item label="替代文本"><Input value={mediaDraft.alt} onChange={(event) => setMediaDraft({ ...mediaDraft, alt: event.target.value })} /></Form.Item></Col><Col span={12}><Form.Item label="排序"><Input type="number" value={mediaDraft.sortOrder} onChange={(event) => setMediaDraft({ ...mediaDraft, sortOrder: Number(event.target.value) })} /></Form.Item></Col><Col span={24}><Space><Switch checked={mediaDraft.enabled} onChange={(enabled) => setMediaDraft({ ...mediaDraft, enabled })} />启用</Space></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{mediaDraft.id ? '保存修改' : '新增图片'}</Button></Space></Form>;
  const reviewForm = <Form layout="vertical" onFinish={handleReviewSave}><Form.Item label="用户名"><Input value={reviewDraft.name} onChange={(event) => setReviewDraft({ ...reviewDraft, name: event.target.value })} /></Form.Item><Form.Item label="内容"><Input.TextArea rows={4} value={reviewDraft.content} onChange={(event) => setReviewDraft({ ...reviewDraft, content: event.target.value })} /></Form.Item><Form.Item label="图片地址，每行一个"><Input.TextArea rows={3} value={reviewDraft.images} onChange={(event) => setReviewDraft({ ...reviewDraft, images: event.target.value })} /></Form.Item><Form.Item label="上传评价图片"><Upload beforeUpload={(file) => { setUploadFile(file); return false; }} maxCount={1}><Button icon={<UploadOutlined />}>选择文件</Button></Upload></Form.Item><Row gutter={20}><Col span={12}><Form.Item label="排序"><Input type="number" value={reviewDraft.homeOrder} onChange={(event) => setReviewDraft({ ...reviewDraft, homeOrder: Number(event.target.value) })} /></Form.Item></Col><Col span={12}><Form.Item label="首页展示"><Switch checked={reviewDraft.featuredOnHome} onChange={(featuredOnHome) => setReviewDraft({ ...reviewDraft, featuredOnHome })} /></Form.Item></Col><Col span={12}><Form.Item label="启用"><Switch checked={reviewDraft.enabled} onChange={(enabled) => setReviewDraft({ ...reviewDraft, enabled })} /></Form.Item></Col></Row><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{reviewDraft.id ? '保存修改' : '新增评价'}</Button></Space></Form>;
  const purchaseForm = <Form layout="vertical" onFinish={handlePurchaseSave}><Form.Item label="文案"><Input value={purchaseDraft.content} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, content: event.target.value })} /></Form.Item><Form.Item label="排序"><Input type="number" value={purchaseDraft.sortOrder} onChange={(event) => setPurchaseDraft({ ...purchaseDraft, sortOrder: Number(event.target.value) })} /></Form.Item><Form.Item label="启用"><Switch checked={purchaseDraft.enabled} onChange={(enabled) => setPurchaseDraft({ ...purchaseDraft, enabled })} /></Form.Item><Space><Button onClick={closeDrawer}>取消</Button><Button type="primary" htmlType="submit">{purchaseDraft.id ? '保存修改' : '新增文案'}</Button></Space></Form>;
  const siteColumns: ColumnsType<Site> = [{ title: '站点', dataIndex: 'name', render: (name: string, site: Site) => <Space><Tag color={site.isActive ? 'green' : 'default'}>{site.isActive ? '当前' : '站点'}</Tag>{name}</Space> }, { title: '标识', dataIndex: 'slug' }, { title: '创建时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() }, { title: '操作', key: 'action', render: (_: unknown, site: Site) => <Space><Button type="link" onClick={() => handleActivateSite(site)} disabled={site.isActive}>切换</Button><Button type="link" icon={<EditOutlined />} onClick={() => openSite(site)}>编辑</Button></Space> }];
  const reviewColumns: ColumnsType<Review> = [{ title: '用户', dataIndex: 'name', key: 'name', render: (name: string) => <Space><Tag color="blue">{name.slice(0, 1)}</Tag>{name}</Space> }, { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true }, { title: '图片', dataIndex: 'images', key: 'images', render: (images: string[]) => images[0] ? <img className="admin-table-thumb" src={images[0]} alt="评价图片" /> : <Text type="secondary">无图片</Text> }, { title: '首页展示', dataIndex: 'featuredOnHome', render: (value: boolean, item: Review) => <Switch size="small" checked={value} onChange={async (featuredOnHome) => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome, homeOrder: item.homeOrder, enabled: item.enabled }); await refresh(); message.success('评价状态已更新'); }} /> }, { title: '排序', dataIndex: 'homeOrder' }, { title: '状态', dataIndex: 'enabled', render: (enabled: boolean, item: Review) => <Switch size="small" checked={enabled} onChange={async (nextEnabled) => { await updateReview(item.id, { name: item.name, content: item.content, images: item.images, featuredOnHome: item.featuredOnHome, homeOrder: item.homeOrder, enabled: nextEnabled }); await refresh(); message.success('评价状态已更新'); }} /> }, { title: '操作', key: 'action', render: (_: unknown, item: Review) => <Space><Button type="link" icon={<EditOutlined />} onClick={() => openReview(item)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('评价', async () => { await deleteReview(item.id); })}>删除</Button></Space> }];
  const mediaColumns: ColumnsType<MediaAsset> = [{ title: '预览', dataIndex: 'resolvedUrl', render: (url: string, item: MediaAsset) => url ? <img className="admin-table-thumb" src={url} alt={item.alt} /> : <Text type="secondary">无图片</Text> }, { title: '区域', dataIndex: 'section', render: (section: string) => section === 'hero' ? '首页轮播' : '详情图片' }, { title: '地址', dataIndex: 'resolvedUrl', ellipsis: true }, { title: '排序', dataIndex: 'sortOrder' }, { title: '状态', dataIndex: 'enabled', render: (enabled: boolean) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '禁用'}</Tag> }, { title: '操作', key: 'action', render: (_: unknown, item: MediaAsset) => <Space><Button type="link" onClick={() => openMedia(item)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('图片', async () => { await deleteMediaAsset(item.id); })}>删除</Button></Space> }];
  const purchaseColumns: ColumnsType<FloatingPurchase> = [{ title: '文案', dataIndex: 'content' }, { title: '排序', dataIndex: 'sortOrder' }, { title: '状态', dataIndex: 'enabled', render: (enabled: boolean) => <Tag color={enabled ? 'success' : 'default'}>{enabled ? '启用' : '禁用'}</Tag> }, { title: '操作', key: 'action', render: (_: unknown, item: FloatingPurchase) => <Space><Button type="link" onClick={() => openPurchase(item)}>编辑</Button><Button type="link" danger onClick={() => confirmDelete('浮层文案', async () => { await deleteFloatingPurchase(item.id); })}>删除</Button></Space> }];
  const content = activePage === 'dashboard' ? <><Title level={2}>欢迎回来</Title><Text type="secondary">当前站点：{bootstrap?.site.name}</Text><Row gutter={[20, 20]} className="admin-stat-row"><Col xs={24} lg={8}><Card><Statistic title="图片总数" value={mediaAssets.length} prefix={<FileImageOutlined />} /></Card></Col><Col xs={24} lg={8}><Card><Statistic title="评价总数" value={bootstrap?.allReviews.length ?? 0} prefix={<FormOutlined />} /></Card></Col><Col xs={24} lg={8}><Card><Statistic title="活跃浮层" value={(bootstrap?.floatingPurchases ?? []).filter((item) => item.enabled).length} prefix={<TagsOutlined />} /></Card></Col></Row><Row gutter={[20, 20]} className="admin-quick-row"><Col xs={24} lg={12}><Card hoverable onClick={openSettings}><Descriptions column={1} title="站点配置"><Descriptions.Item label="店铺">{settings?.shopName}</Descriptions.Item><Descriptions.Item label="当前售价">¥{settings?.salePrice}</Descriptions.Item></Descriptions></Card></Col><Col xs={24} lg={12}><Card hoverable onClick={() => setActivePage('settings')}><Descriptions column={1} title="站点管理"><Descriptions.Item label="站点数量">{bootstrap?.sites.length ?? 0} 个</Descriptions.Item><Descriptions.Item label="当前标识">{bootstrap?.site.slug}</Descriptions.Item></Descriptions></Card></Col></Row></> : activePage === 'settings' ? <><div className="admin-page-heading"><div><Title level={2}>站点管理中心</Title><Text type="secondary">创建站点、复制模板、切换当前站点，并维护当前站点配置。</Text></div><Space><Button onClick={openSettings}>编辑当前配置</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => openSite()}>新建站点</Button></Space></div><Card className="admin-content-card" title="当前站点配置"><Descriptions column={{ xs: 1, sm: 2 }}><Descriptions.Item label="站点名称">{bootstrap?.site.name}</Descriptions.Item><Descriptions.Item label="站点标识">{bootstrap?.site.slug}</Descriptions.Item><Descriptions.Item label="店铺名">{settings?.shopName}</Descriptions.Item><Descriptions.Item label="售价">¥{settings?.salePrice}</Descriptions.Item><Descriptions.Item label="原价">¥{settings?.originalPrice}</Descriptions.Item><Descriptions.Item label="发货时间">{settings?.shippingTime}</Descriptions.Item></Descriptions></Card><Card className="admin-content-card"><Table rowKey="id" columns={siteColumns} dataSource={bootstrap?.sites ?? []} loading={loading} pagination={false} /></Card></> : activePage === 'media' ? <><div className="admin-page-heading"><div><Title level={2}>图片管理</Title><Text type="secondary">首页轮播和详情图片按区域独立管理。</Text></div><Space><Button icon={<PlusOutlined />} onClick={() => openMedia(undefined, 'detail')}>添加详情图</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => openMedia(undefined, 'hero')}>添加轮播图</Button></Space></div><Card className="admin-content-card"><Table rowKey="id" columns={mediaColumns} dataSource={mediaAssets} loading={loading} pagination={{ pageSize: 8, showSizeChanger: true }} /></Card></> : activePage === 'reviews' ? <><div className="admin-page-heading"><div><Title level={2}>评价管理</Title><Text type="secondary">管理当前站点的评价信息。</Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => openReview()}>添加评价</Button></div><Card className="admin-filter-card"><Space wrap><Select value={reviewStatusFilter} onChange={setReviewStatusFilter} options={[{ value: 'all', label: '全部状态' }, { value: 'enabled', label: '启用' }, { value: 'disabled', label: '禁用' }]} /><Input.Search value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} placeholder="输入用户名或评价内容" allowClear /></Space></Card><Card className="admin-content-card"><Table rowKey="id" columns={reviewColumns} dataSource={reviews} loading={loading} pagination={{ pageSize: 8, showSizeChanger: true }} locale={{ emptyText: <Empty description="暂无评价" /> }} /></Card></> : <><div className="admin-page-heading"><div><Title level={2}>浮层文案管理</Title><Text type="secondary">管理当前站点的浮层购买提示与滚动文案。</Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => openPurchase()}>添加文案</Button></div><Card className="admin-content-card"><Table rowKey="id" columns={purchaseColumns} dataSource={bootstrap?.floatingPurchases ?? []} loading={loading} pagination={{ pageSize: 8 }} /></Card></>;
  return <Layout className="antd-admin-layout"><Sider theme="light" width={260} breakpoint="lg" collapsedWidth={80}><div className="antd-admin-brand"><div className="antd-admin-logo"><TagsOutlined /></div><div><strong>管理系统</strong><span>多站点后台</span></div></div><Menu mode="inline" selectedKeys={[activePage]} items={navItems} onClick={({ key }) => setActivePage(key)} /><div className="antd-admin-account"><Tag color="blue">A</Tag><div><strong>管理员</strong><span>{bootstrap?.site.name ?? 'System Admin'}</span></div></div></Sider><Layout><Header className="antd-admin-header"><Space><Title level={4}>管理中心</Title>{bootstrap ? <Select className="admin-site-switch" value={bootstrap.activeSiteId} onChange={(id) => { const site = bootstrap.sites.find((item) => item.id === id); if (site) void handleActivateSite(site); }} options={bootstrap.sites.map((site) => ({ value: site.id, label: site.name }))} /> : null}</Space><Space><Button type="text" icon={<BellOutlined />} aria-label="通知" /><Button type="text" icon={<QuestionCircleOutlined />} aria-label="帮助" /><Button type="link" icon={<LogoutOutlined />} onClick={handleLogout}>退出登录</Button></Space></Header><Content className="antd-admin-content">{loading && !bootstrap ? <Spin size="large" /> : content}</Content></Layout><Drawer title={drawer === 'settings' ? '编辑站点配置' : drawer === 'site' ? (siteDraft.id ? '编辑站点' : '新建站点') : drawer === 'media' ? '编辑图片资源' : drawer === 'review' ? '编辑评价' : '编辑浮层文案'} open={Boolean(drawer)} onClose={closeDrawer} width={drawer === 'settings' ? 720 : 560} destroyOnClose>{drawer === 'settings' ? settingsForm : drawer === 'site' ? siteForm : drawer === 'media' ? mediaForm : drawer === 'review' ? reviewForm : purchaseForm}</Drawer></Layout>;
}

export function App() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) {
    return <ConfigProvider theme={{ token: { colorPrimary: '#168bff', borderRadius: 6 } }}><AntApp><AdminApp /></AntApp></ConfigProvider>;
  }

  return <PublicApp />;
}
