import { useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { ChevronRight, PhoneCall, ScanLine, ShieldCheck, Store } from 'lucide-react';
import { BundleSelector } from './components/BundleSelector';
import { Carousel } from './components/Carousel';
import { DetailGallery } from './components/DetailGallery';
import { Header } from './components/Header';
import { InfoList } from './components/InfoList';
import { OrderFormSection } from './components/OrderFormSection';
import { ReviewSection } from './components/ReviewSection';
import { SectionShell } from './components/SectionShell';
import { StickyActionBar } from './components/StickyActionBar';
import { product } from './data/product';

const defaultBundleId = product.bundles[1]?.id ?? product.bundles[0].id;

export function App() {
  const [selectedBundleId, setSelectedBundleId] = useState(defaultBundleId);
  const [order, setOrder] = useState({ name: '', phone: '', address: '' });
  const [queryPhone, setQueryPhone] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const orderRef = useRef<HTMLElement | null>(null);
  const supportRef = useRef<HTMLElement | null>(null);
  const detailsRef = useRef<HTMLElement | null>(null);

  const selectedBundle = useMemo(
    () => product.bundles.find((bundle) => bundle.id === selectedBundleId) ?? product.bundles[0],
    [selectedBundleId],
  );

  const jumpTo = (ref: RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage('已创建待支付订单草稿，实际支付金额由后端根据当前模板计算。');
  };

  const handleQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(queryPhone ? `已查询手机号 ${queryPhone} 的订单记录。` : '请输入手机号后再查询。');
  };

  return (
    <div className="page-shell">
      <Header shopName={product.shopName} onJumpToOrder={() => jumpTo(orderRef)} />

      <main className="page-main">
        <Carousel images={product.heroImages} />

        <section className="hero-copy">
          <div className="hero-copy__chips">
            <span className="badge badge--success">官方模板</span>
            <span className="badge badge--muted">{product.serviceNote}</span>
          </div>
          <h1 className="hero-copy__title">{product.title}</h1>
          <p className="hero-copy__subtitle">{product.subtitle}</p>
          <p className="hero-copy__highlight">{product.highlight}</p>
          <div className="hero-copy__stats">
            <span>
              <ShieldCheck size={14} />
              <em>正品保证</em>
            </span>
            <span>
              <Store size={14} />
              <em>单品商城</em>
            </span>
            <span>
              <PhoneCall size={14} />
              <em>支付后客服引导</em>
            </span>
          </div>
        </section>

        <section className="price-band">
          <div>
            <p className="price-band__label">券后价</p>
            <strong className="price-band__price">¥{selectedBundle.price.toFixed(0)}</strong>
          </div>
          <div className="price-band__detail">
            <span>原价 ¥{selectedBundle.originalPrice.toFixed(0)}</span>
            <span>{selectedBundle.saleLabel}</span>
          </div>
        </section>

        <SectionShell title="选择套餐" subtitle="同一商品模板可切换多个套餐，价格由后端统一计算。">
          <BundleSelector bundles={product.bundles} value={selectedBundle.id} onChange={setSelectedBundleId} />
        </SectionShell>

        <SectionShell title="商品说明" subtitle="把重复出现的说明、保障和发货信息收拢成结构化内容。">
          <InfoList items={product.specs} />
          <div className="chip-row">
            {product.guarantee.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </SectionShell>

        <SectionShell title="精选评价" subtitle="参考页中的标签和图片评论改成可复用评价区块。">
          <ReviewSection reviews={product.reviews} />
        </SectionShell>

        <SectionShell
          id="details"
          title="商品详情"
          subtitle="详情图按后台配置顺序连续展示，形成纵向长图。"
          action={
            <button type="button" className="text-link" onClick={() => jumpTo(detailsRef)}>
              查看长图 <ChevronRight size={16} />
            </button>
          }
        >
          <div ref={detailsRef}>
            <DetailGallery images={product.detailImages} />
          </div>
        </SectionShell>

        <SectionShell title="常见问题" subtitle="支付、发货和客服入口的说明集中在这里。">
          <div className="faq-list">
            {product.faqs.map((faq) => (
              <article className="faq-item" key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </SectionShell>

        <SectionShell id="order" title="填写收货信息" subtitle="前端只收集信息，订单金额和支付状态以后端校验为准。">
          <div ref={orderRef}>
            <OrderFormSection
              value={order}
              onChange={(field, value) => setOrder((current) => ({ ...current, [field]: value }))}
              selectedBundleName={selectedBundle.name}
              selectedPrice={selectedBundle.price}
              onSubmit={handleSubmit}
              submitLabel="创建待支付订单"
            />
          </div>
        </SectionShell>

        <SectionShell title="手机号查询订单" subtitle="对齐设计文档中的订单查询入口。">
          <form className="query-form" onSubmit={handleQuery}>
            <label className="field">
              <span>收货人手机号</span>
              <input value={queryPhone} onChange={(event) => setQueryPhone(event.target.value)} inputMode="tel" placeholder="请输入手机号" />
            </label>
            <button type="submit" className="button button--secondary">
              查询订单
            </button>
          </form>
        </SectionShell>

        <SectionShell id="support" title="客服引导" subtitle="支付成功后可直接进入客服微信引导页。">
          <div ref={supportRef} className="support-panel">
            <div className="support-panel__card">
              <ScanLine size={20} />
              <div>
                <h3>客服二维码</h3>
                <p>后台可切换二维码或 HTTPS 客服链接。</p>
              </div>
            </div>
            <div className="support-panel__card">
              <PhoneCall size={20} />
              <div>
                <h3>售后说明</h3>
                <p>支付后自动进入客服引导，便于订单跟踪和售后接入。</p>
              </div>
            </div>
          </div>
        </SectionShell>

        {statusMessage ? <p className="status-banner">{statusMessage}</p> : null}
      </main>

      <StickyActionBar
        onJumpToOrder={() => jumpTo(orderRef)}
        onJumpToSupport={() => jumpTo(supportRef)}
        onJumpToDetails={() => jumpTo(detailsRef)}
      />
    </div>
  );
}
