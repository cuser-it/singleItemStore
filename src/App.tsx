import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

const asset = (name: string) => `/cankao-assets/${name}`;

type Sku = {
  id: string;
  label: string;
  price: number;
  market: number;
};

type Review = {
  name: string;
  text: string;
  images: string[];
};

const heroImages = [
  { src: asset('qMi7onARrm.jpg'), alt: '商品图1' },
  { src: asset('32VQNeEtUa.jpg'), alt: '商品图2' },
  { src: asset('BG36891rEQ.jpg'), alt: '商品图3' },
  { src: asset('MzTvHcaWBQ.jpg'), alt: '商品图4' },
  { src: asset('E7Dtnu5fcs.jpg'), alt: '商品图5' },
];

const skus: Sku[] = [
  { id: 'starter', label: '1盒 起步装-初拾勇气', price: 99, market: 299 },
  { id: 'steady', label: '3盒 稳定装-持续输出', price: 268, market: 699 },
  { id: 'course', label: '5盒 疗程装-永久战斗', price: 428, market: 1099 },
];

const reviews: Review[] = [
  {
    name: '悹**7',
    text: '这次在网上看到就买来试试，效果是真心好啊。这个产品用着效果挺好的，一个时还是正常水平！价格还优惠！货收到后就拆开用了，质量很好',
    images: [asset('V05Z6IvDKl.jpg_960x960'), asset('o3elPGVxCq.jpg_960x960'), asset('IBKx5j2eAe.jpg_960x960')],
  },
  {
    name: '?**6',
    text: '我是觉得这款产品买的值，起来速度很快，挺的时间长，对此也是越来越满意，反应强很多，硬度好了不少。',
    images: [asset('PclhWCdhYy.jpg_960x960'), asset('8FkJgca3fG.jpg_960x960'), asset('jj6DZZvRRp.jpg_960x960')],
  },
];

const detailImages = [
  'JNZfUCoTtL.jpg',
  'D3ht7I4x9b.jpg',
  'b69e47I6TB.jpg',
  'Jh59YtQuvb.jpg',
  'QSQ9qUZNbP.jpg',
  'vTqWUegEWJ.jpg',
  'hNZeM3twDu.jpg',
  'U5XCvuEXCq.jpg',
  'JNva6A03m7.jpg',
  'fHLw7i1eof.jpg',
  'vDJ1NB9zkJ.jpg',
  'jQrTho2pE6.jpg',
  'YOJ0NbUmHI.jpg',
  'JPx1dE1zKS.jpg',
  '1ME30P8HHX.jpg',
  'HcEGZ0R9Ge.jpg',
].map(asset);

const orderItems = [
  '王**10分钟前已购买【体验装】参茸养心益肾胶囊，今日下单1盒99元！',
  '李**6分钟前已购买【稳定装】参茸养心益肾胶囊，今日下单3盒268元！',
  '郭**5分钟前已购买【疗程装】参茸养心益肾胶囊，今日下单5盒428元！',
  '邱**8分钟前已购买【体验装】参茸养心益肾胶囊，今日下单1盒99元！',
  '吴**3分钟前已购买【稳定装】参茸养心益肾胶囊，今日下单3盒268元！',
  '谢**2分钟前已购买【疗程装】参茸养心益肾胶囊，今日下单5盒428元！',
  '洪**5分钟前已购买【体验装】参茸养心益肾胶囊，今日下单1盒99元！',
  '魏**15分钟前已购买【稳定装】参茸养心益肾胶囊，今日下单3盒268元！',
];

const floatingPurchases = ['李**6分钟前已购买', '王**10分钟前已购买', '张**2分钟前已购买'];
const reviewTags = ['效果明显', '价格便宜', '发货快', '物流快', '服务好'];

function clampQty(value: number) {
  return Math.max(1, value);
}

function PriceBanner({ sku }: { sku: Sku }) {
  return (
    <section className="price-bar" aria-label="价格横幅">
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="104" viewBox="0 0 600 104" role="img" aria-labelledby="price-title price-desc">
        <title id="price-title">价格促销栏</title>
        <desc id="price-desc">紫色和粉色梯形交叠形成深紫色三角形的价格栏</desc>
        <rect width="600" height="104" fill="#3510A8" />
        <path d="M390 2H600V102H420Z" fill="#ED008C" />
        <path d="M0 2H420L390 102H0Z" fill="#4300E8" />
        <g fill="#FFFFFF" fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <text x="19" y="40" fontSize="18" fontWeight="700">超划算价</text>
          <text x="19" y="79" fontSize="22" fontWeight="700">¥{sku.market.toFixed(1)}起</text>
        </g>
        <g fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <rect x="120" y="18" width="114" height="29" rx="15" fill="#FF3A68" />
          <text x="177" y="38" fill="#FFFFFF" fontSize="16" fontWeight="700" textAnchor="middle">50000+已售</text>
          <rect x="120" y="53" width="130" height="34" rx="17" fill="#FFFFFF" />
          <text x="185" y="76" fill="#FF315F" fontSize="16" fontWeight="700" textAnchor="middle">券后¥{sku.price.toFixed(1)}起</text>
        </g>
        <g fill="#FFFFFF" textAnchor="middle" fontFamily="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">
          <text x="486" y="42" fontSize="26" fontWeight="700">超划算</text>
          <text x="486" y="64" fontSize="15" fontWeight="700">限时折扣</text>
          <text x="486" y="84" fontSize="15" fontWeight="700">品质正品</text>
        </g>
      </svg>
    </section>
  );
}

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <button className={open ? 'sheet-mask sheet-mask--show' : 'sheet-mask'} type="button" hidden={!open} onClick={onClose} aria-label={`关闭${title}`} />
      <aside className={open ? 'sheet sheet--open' : 'sheet'} aria-hidden={!open} aria-label={title}>
        <header className="sheet__header">
          <div className="sheet__title">{title}</div>
          <button className="sheet__close" type="button" onClick={onClose} aria-label={`关闭${title}`}>x</button>
        </header>
        {children}
      </aside>
    </>
  );
}

export function App() {
  const [slide, setSlide] = useState(0);
  const [selectedSkuId, setSelectedSkuId] = useState(skus[0].id);
  const [quantity, setQuantity] = useState(1);
  const [payment, setPayment] = useState<'wechat' | 'cod'>('wechat');
  const [checkoutPayment, setCheckoutPayment] = useState<'wechat' | 'alipay'>('wechat');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [purchaseIndex, setPurchaseIndex] = useState(0);
  const buyRef = useRef<HTMLElement | null>(null);

  const selectedSku = useMemo(() => skus.find((sku) => sku.id === selectedSkuId) ?? skus[0], [selectedSkuId]);
  const total = selectedSku.price * quantity;

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % heroImages.length), 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setPurchaseIndex((current) => (current + 1) % floatingPurchases.length), 2100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle('body-locked', reviewOpen || checkoutOpen);
    return () => document.body.classList.remove('body-locked');
  }, [reviewOpen, checkoutOpen]);

  const showDemoToast = (message = '已为演示页面保留下单样式，未提交任何接口') => setToast(message);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showDemoToast();
  };

  return (
    <div className="store-page">
      <main>
        <section className="hero" aria-label="商品图片">
          <div className="slides" style={{ transform: `translateX(${-100 * slide}%)` }}>
            {heroImages.map((image) => (
              <div className="slide" key={image.src}>
                <img src={image.src} alt={image.alt} draggable={false} />
              </div>
            ))}
          </div>
          <div className="dots" aria-hidden="true">
            {heroImages.map((image, index) => (
              <button key={image.src} className={index === slide ? 'dot active' : 'dot'} type="button" onClick={() => setSlide(index)} aria-label={`切换到第${index + 1}张`} />
            ))}
          </div>
        </section>

        <PriceBanner sku={selectedSku} />

        <section className="card pad">
          <div className="shop-line"><span><span className="official">商城官方自营</span>正品保证,不仅全,而且更安全</span><span>月销18792</span></div>
          <h1 className="title">参茸 养心益肾胶囊 正品官方 勃起苦困难 阳痿早泄 OTC 国药准字</h1>
          <div className="muted">本品售出,非质量问题不退不换</div>
        </section>

        <section className="card info-card" aria-label="商品说明">
          <div className="info-row"><b>产品描述</b><span>立赠1盒男士战斗礼包，中西结合更强更科学</span></div>
          <div className="info-row"><b>邮费说明</b><span>免费包邮</span></div>
          <div className="info-row"><b>温馨提示</b><span>正品保证,不仅全,而且更安全</span></div>
          <div className="info-row"><b>发货时间</b><span>18:00前下单,承诺当日发出</span></div>
        </section>

        <section className="card" id="review-card">
          <button className="review-head" type="button" onClick={() => setReviewOpen(true)}><b>宝贝评价(12083)</b><span>查看全部 &gt;</span></button>
          <div className="tags">{reviewTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
          {reviews.map((review) => (
            <article className="review" key={review.name}>
              <div className="reviewer">{review.name}</div>
              <p>{review.text}</p>
              <div className="review-photos">
                {review.images.map((image, index) => <img src={image} alt={`${review.name}评价图${index + 1}`} key={image} loading="lazy" />)}
              </div>
            </article>
          ))}
        </section>

        <div className="section-title">产品详情</div>
        <section className="detail-images">
          {detailImages.map((image, index) => <p key={image}><img src={image} alt={`详情图${index + 1}`} loading="lazy" /></p>)}
        </section>

        <div className="section-title">用户下单</div>
        <section className="card" id="buy" ref={buyRef}>
          <div className="buy-title">健康生活</div>
          <div className="specs">
            <div className="field-title">规格</div>
            <div className="spec-list" role="radiogroup" aria-label="规格">
              {skus.map((sku) => (
                <button className={sku.id === selectedSkuId ? 'spec active' : 'spec'} key={sku.id} type="button" role="radio" aria-checked={sku.id === selectedSkuId} onClick={() => setSelectedSkuId(sku.id)}>
                  {sku.label}
                </button>
              ))}
            </div>
            <div className="amount-row"><b>数 量</b><Stepper value={quantity} onDecrease={() => setQuantity((current) => clampQty(current - 1))} onIncrease={() => setQuantity((current) => current + 1)} /></div>
            <div className="amount-row"><b>金 额</b><div className="money">¥{total.toFixed(1)}</div></div>
          </div>

          <form className="form" onSubmit={handleSubmit}>
            <div className="form-row"><label htmlFor="name">姓 名</label><input id="name" name="name" placeholder="请填写姓名" /></div>
            <div className="form-row"><label htmlFor="age">年 龄</label><input id="age" name="age" inputMode="numeric" maxLength={3} placeholder="请填写年龄（岁）" /></div>
            <div className="form-row"><label htmlFor="phone">手机号码</label><input id="phone" name="phone" inputMode="tel" maxLength={11} placeholder="请填写手机号码" /></div>
            <div className="form-row"><label>所在地区</label><div className="area-grid"><select><option>请选择省份</option><option>北京市</option><option>广东省</option><option>浙江省</option><option>四川省</option></select><select><option>请选择城市</option><option>北京市</option><option>广州市</option><option>杭州市</option><option>成都市</option></select><select><option>请选择区县</option><option>朝阳区</option><option>天河区</option><option>西湖区</option><option>锦江区</option></select></div></div>
            <div className="form-row"><label htmlFor="address">详细地址</label><input id="address" name="address" placeholder="请填写详细地址" /></div>
            <div className="form-row"><label htmlFor="message">留 言</label><textarea id="message" name="message" /></div>
            <div className="field-title">付款方式</div>
            <div className="pay-list" role="radiogroup" aria-label="付款方式">
              <button className={payment === 'wechat' ? 'pay active' : 'pay'} type="button" onClick={() => setPayment('wechat')}>微信付款</button>
              <button className={payment === 'cod' ? 'pay active' : 'pay'} type="button" onClick={() => setPayment('cod')}>货到付款</button>
            </div>
            <div className="pay-tip">{payment === 'cod' ? '温馨提示：选择货到付款在家等快递公司送货上门，先验货后付款！' : '温馨提示：全球领先的第三方支付平台，在线支付，安全可靠！'}</div>
            <button className="submit" type="submit">立即抢购，获取优惠</button>
            <div className="privacy"><span className="check">✓</span><span>订单信息将用于商家发货,勾选即代表同意 <span className="link-blue">《个人隐私保护条款》</span></span></div>
          </form>
        </section>

        <section className="card">
          <div className="buy-title">最新抢购</div>
          <div className="orders"><ul>{[...orderItems, ...orderItems.slice(0, 4)].map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>
        </section>
      </main>

      <div className="purchase-feed" aria-live="polite">
        <p className="purchase-item active"><img src={asset('0.jpg')} alt="" /><span>{floatingPurchases[purchaseIndex]}</span></p>
      </div>

      <Sheet open={reviewOpen} title="商品评论" onClose={() => setReviewOpen(false)}>
        <div className="review-sheet-body">
          <div className="review-title-container">宝贝评价(12083)</div>
          <div className="review-tag-container">{reviewTags.map((tag) => <div className="review-tag-item" key={tag}>{tag}</div>)}</div>
          <div className="review-item-container">
            {reviews.map((review) => (
              <div className="review-item-content" key={review.name}>
                <div className="reviewer-row"><div><div className="reviewer-name">{review.name}</div><div className="reviewer-sub" /></div></div>
                <div className="context-text">{review.text}</div>
                <div className="sheet-review-image-row"><img src={review.images[0]} alt={`${review.name}图片评论`} /></div>
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={checkoutOpen} title="确认订单" onClose={() => setCheckoutOpen(false)}>
        <div className="checkout-sheet-body">
          <div className="checkout-summary"><div className="checkout-summary-top"><div><div className="checkout-summary-label">当前商品</div><div className="checkout-summary-name">{selectedSku.label}</div></div><div className="checkout-summary-price">¥{total.toFixed(1)}</div></div></div>
          <div className="checkout-body">
            <div className="field-title">规格</div>
            <div className="checkout-specs">
              {skus.map((sku) => <button key={sku.id} className={sku.id === selectedSkuId ? 'checkout-spec active' : 'checkout-spec'} type="button" onClick={() => setSelectedSkuId(sku.id)}>{sku.label}</button>)}
            </div>
            <div className="checkout-row"><label>数 量</label><Stepper value={quantity} onDecrease={() => setQuantity((current) => clampQty(current - 1))} onIncrease={() => setQuantity((current) => current + 1)} className="checkout-stepper" /></div>
            <div className="checkout-row"><label>总 价</label><div className="checkout-total">¥{total.toFixed(1)}</div></div>
            <div className="checkout-row"><label htmlFor="checkoutName">姓 名</label><input id="checkoutName" name="checkoutName" placeholder="请填写姓名" /></div>
            <div className="checkout-row"><label htmlFor="checkoutPhone">手机号码</label><input id="checkoutPhone" name="checkoutPhone" inputMode="tel" maxLength={11} placeholder="请填写手机号码" /></div>
            <div className="checkout-row"><label htmlFor="checkoutAddress">收货地址</label><textarea id="checkoutAddress" name="checkoutAddress" placeholder="请填写收货地址" /></div>
            <div className="field-title">支付方式</div>
            <div className="checkout-payments">
              <button className={checkoutPayment === 'wechat' ? 'checkout-pay active' : 'checkout-pay'} type="button" onClick={() => setCheckoutPayment('wechat')}>微信支付</button>
              <button className={checkoutPayment === 'alipay' ? 'checkout-pay active' : 'checkout-pay'} type="button" onClick={() => setCheckoutPayment('alipay')}>支付宝支付</button>
            </div>
          </div>
        </div>
        <div className="checkout-actions"><button className="checkout-submit" type="button" onClick={() => { showDemoToast(checkoutPayment === 'alipay' ? '已选择支付宝支付，订单已进入演示提交流程' : '已选择微信支付，订单已进入演示提交流程'); setCheckoutOpen(false); }}>提交订单</button></div>
      </Sheet>

      <nav className="bottom-bar"><button className="buy-now" type="button" onClick={() => setCheckoutOpen(true)}>立即发货</button></nav>
      <div className={toast ? 'toast show' : 'toast'}>{toast || '已为演示页面保留下单样式，未提交任何接口'}</div>
    </div>
  );
}

function Stepper({ value, onDecrease, onIncrease, className = 'stepper' }: { value: number; onDecrease: () => void; onIncrease: () => void; className?: string }) {
  return (
    <div className={className}>
      <button type="button" onClick={onDecrease} aria-label="减少数量">-</button>
      <span>{value}</span>
      <button type="button" onClick={onIncrease} aria-label="增加数量">+</button>
    </div>
  );
}
