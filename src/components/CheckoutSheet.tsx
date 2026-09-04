import { useEffect, useState } from 'react';
import type { PaymentChannel, ProductSku } from '../../shared/order';

export type CheckoutStep = 'product' | 'address' | 'payment';

export const CHECKOUT_MAX_QUANTITY = 99;
export const CHECKOUT_PHONE_PATTERN = /^1[3-9]\d{9}$/;

const STEPS: Array<{ key: CheckoutStep; label: string }> = [
  { key: 'product', label: '确认商品' },
  { key: 'address', label: '收货信息' },
  { key: 'payment', label: '选择支付' },
];

export type CheckoutRecipient = {
  recipientName: string;
  phone: string;
  address: string;
};

export type CheckoutRecipientErrors = Partial<Record<keyof CheckoutRecipient, string>>;

/**
 * 购买数量约束：1 ~ CHECKOUT_MAX_QUANTITY 之间的整数。
 */
export function clampCheckoutQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(CHECKOUT_MAX_QUANTITY, Math.max(1, Math.floor(value)));
}

/**
 * 前端展示用的合计金额（单位：元）。
 * 只依赖后台返回的 SKU 价格 × 用户选择的数量；使用“分”做整数运算避免浮点误差。
 * 真实成交金额由后台 createOrder 重新计算并在支付回调中校验，前端无法篡改。
 */
export function calcCheckoutTotal(sku: Pick<ProductSku, 'price'> | undefined | null, quantity: number) {
  if (!sku) return 0;
  const unitCents = Math.round(Number(sku.price) * 100);
  if (!Number.isFinite(unitCents)) return 0;
  return (unitCents * clampCheckoutQuantity(quantity)) / 100;
}

export function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

export function validateRecipient(recipient: CheckoutRecipient): CheckoutRecipientErrors {
  const errors: CheckoutRecipientErrors = {};
  if (!recipient.recipientName.trim()) errors.recipientName = '请填写收货人姓名';
  if (!CHECKOUT_PHONE_PATTERN.test(recipient.phone.trim())) errors.phone = '请填写正确的 11 位手机号码';
  if (recipient.address.trim().length < 5) errors.address = '请填写详细的收货地址（省市区 + 街道门牌）';
  return errors;
}

function Stepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="co-stepper" role="group" aria-label="购买数量">
      <button type="button" onClick={() => onChange(clampCheckoutQuantity(value - 1))} disabled={value <= 1} aria-label="减少数量">
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={CHECKOUT_MAX_QUANTITY}
        value={value}
        aria-label="购买数量输入"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (event.target.value === '') return;
          onChange(clampCheckoutQuantity(next));
        }}
      />
      <button type="button" onClick={() => onChange(clampCheckoutQuantity(value + 1))} disabled={value >= CHECKOUT_MAX_QUANTITY} aria-label="增加数量">
        +
      </button>
    </div>
  );
}

function StepIndicator({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  return (
    <ol className="co-steps" aria-label="下单进度">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'todo';
        return (
          <li key={step.key} className={`co-step co-step--${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="co-step__dot">{state === 'done' ? '✓' : index + 1}</span>
            <span className="co-step__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export type CheckoutSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  shopName: string;
  heroImage?: { url: string; alt?: string } | null;
  skus: ProductSku[];
  selectedSkuCode: string;
  onSelectSku: (skuCode: string) => void;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  guarantee: string[];
  serviceNote: string;
  shippingNote: string;
  shippingTime: string;
  paymentChannel: PaymentChannel;
  onPaymentChannelChange: (channel: PaymentChannel) => void;
  onSubmit: (recipient: CheckoutRecipient) => Promise<void> | void;
  submitting?: boolean;
};

const PAYMENT_OPTIONS: Array<{ key: PaymentChannel; label: string; hint: string; className: string }> = [
  { key: 'wxpay', label: '微信支付', hint: '推荐使用微信扫码支付', className: 'co-pay--wx' },
  { key: 'alipay', label: '支付宝', hint: '支持花呗、余额、银行卡', className: 'co-pay--ali' },
];

const emptyRecipient: CheckoutRecipient = { recipientName: '', phone: '', address: '' };

export function CheckoutSheet(props: CheckoutSheetProps) {
  const {
    open,
    onClose,
    title,
    shopName,
    heroImage,
    skus,
    selectedSkuCode,
    onSelectSku,
    quantity,
    onQuantityChange,
    guarantee,
    serviceNote,
    shippingNote,
    shippingTime,
    paymentChannel,
    onPaymentChannelChange,
    onSubmit,
    submitting = false,
  } = props;

  const [step, setStep] = useState<CheckoutStep>('product');
  const [recipient, setRecipient] = useState<CheckoutRecipient>(emptyRecipient);
  const [errors, setErrors] = useState<CheckoutRecipientErrors>({});

  // 每次重新打开时回到第一步；收货信息保留，方便用户误关后继续
  useEffect(() => {
    if (open) {
      setStep('product');
      setErrors({});
    }
  }, [open]);

  const selectedSku = skus.find((sku) => sku.skuCode === selectedSkuCode) ?? skus[0];
  const total = calcCheckoutTotal(selectedSku, quantity);
  const unitPrice = selectedSku ? Number(selectedSku.price) : 0;
  const primaryGuarantee = guarantee[0] ?? '商城官方自营';
  const otherGuarantees = guarantee.slice(1);

  const updateRecipient = (field: keyof CheckoutRecipient, value: string) => {
    setRecipient((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const goAddress = () => {
    if (!selectedSku) return;
    setStep('address');
  };

  const goPayment = () => {
    const nextErrors = validateRecipient(recipient);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setStep('payment');
  };

  const handlePay = async () => {
    if (submitting) return;
    const nextErrors = validateRecipient(recipient);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStep('address');
      return;
    }
    await onSubmit({
      recipientName: recipient.recipientName.trim(),
      phone: recipient.phone.trim(),
      address: recipient.address.trim(),
    });
  };

  const stepIndex = STEPS.findIndex((item) => item.key === step);
  const goBack = () => {
    if (stepIndex <= 0) return;
    setStep(STEPS[stepIndex - 1].key);
  };

  const productSummary = selectedSku ? (
    <div className="co-mini-product">
      {heroImage?.url ? <img src={heroImage.url} alt={heroImage.alt || title} /> : <div className="co-mini-product__placeholder" aria-hidden="true" />}
      <div className="co-mini-product__body">
        <div className="co-mini-product__title">{title}</div>
        <div className="co-mini-product__meta">
          <span>规格：{selectedSku.name}</span>
          <span>数量：×{quantity}</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button className={open ? 'sheet-mask sheet-mask--show' : 'sheet-mask'} type="button" hidden={!open} onClick={onClose} aria-label="关闭确认订单" />
      <aside className={open ? 'sheet sheet--open co-sheet' : 'sheet co-sheet'} aria-hidden={!open} aria-label="确认订单" data-step={step}>
        <header className="sheet__header co-header">
          {stepIndex > 0 ? (
            <button className="co-back" type="button" onClick={goBack} aria-label="返回上一步">
              ‹
            </button>
          ) : null}
          <div className="sheet__title">确认订单</div>
          <button className="sheet__close" type="button" onClick={onClose} aria-label="关闭确认订单">
            ×
          </button>
        </header>

        <StepIndicator current={step} />

        <div className="co-body">
          {step === 'product' && selectedSku ? (
            <>
              <section className="co-card co-product">
                <div className="co-product__media">
                  {heroImage?.url ? <img src={heroImage.url} alt={heroImage.alt || title} draggable={false} /> : <div className="co-product__placeholder" aria-hidden="true" />}
                </div>
                <div className="co-product__body">
                  <div className="co-product__shop">{shopName}</div>
                  <h3 className="co-product__title">{title}</h3>
                  <div className="co-official-badge" aria-label="正品保障">
                    <span className="co-official-badge__icon" aria-hidden="true">
                      ✓
                    </span>
                    {primaryGuarantee}
                  </div>
                  {serviceNote ? <p className="co-product__note">{serviceNote}</p> : null}
                </div>
              </section>

              <section className="co-card co-block" aria-label="选择规格">
                <div className="co-block__head">
                  <b>规格</b>
                  <span className="co-block__selected">已选：{selectedSku.name}</span>
                </div>
                <div className="co-spec-chips">
                  {skus.map((sku) => (
                    <button
                      key={sku.id}
                      type="button"
                      className={sku.skuCode === selectedSku.skuCode ? 'co-chip co-chip--active' : 'co-chip'}
                      aria-pressed={sku.skuCode === selectedSku.skuCode}
                      onClick={() => onSelectSku(sku.skuCode)}
                    >
                      {sku.name}
                    </button>
                  ))}
                </div>
                {selectedSku.subtitle ? <p className="co-spec-subtitle">{selectedSku.subtitle}</p> : null}
              </section>

              <section className="co-card co-block co-qty" aria-label="购买数量">
                <div className="co-qty__text">
                  <b>购买数量</b>
                  <small>最多可购买 {CHECKOUT_MAX_QUANTITY} 件</small>
                </div>
                <Stepper value={quantity} onChange={onQuantityChange} />
              </section>

              {otherGuarantees.length ? (
                <section className="co-card co-guarantee-list" aria-label="服务保障">
                  {otherGuarantees.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </section>
              ) : null}
            </>
          ) : null}

          {step === 'product' && !selectedSku ? <div className="co-empty">当前商品暂无可售规格</div> : null}

          {step === 'address' ? (
            <>
              <section className="co-card co-block co-form" aria-label="收货信息">
                <div className="co-block__head">
                  <b>收货信息</b>
                  <span className="co-block__selected">用于配送与短信通知</span>
                </div>
                <label className={errors.recipientName ? 'co-field co-field--error' : 'co-field'} htmlFor="checkoutName">
                  <span className="co-field__label">收货人</span>
                  <input id="checkoutName" name="recipientName" autoComplete="name" placeholder="请填写收货人姓名" value={recipient.recipientName} onChange={(event) => updateRecipient('recipientName', event.target.value)} />
                  {errors.recipientName ? <em className="co-field__error">{errors.recipientName}</em> : null}
                </label>
                <label className={errors.phone ? 'co-field co-field--error' : 'co-field'} htmlFor="checkoutPhone">
                  <span className="co-field__label">手机号码</span>
                  <input id="checkoutPhone" name="phone" inputMode="tel" autoComplete="tel" maxLength={11} placeholder="请填写 11 位手机号码" value={recipient.phone} onChange={(event) => updateRecipient('phone', event.target.value.replace(/\D/g, ''))} />
                  {errors.phone ? <em className="co-field__error">{errors.phone}</em> : null}
                </label>
                <label className={errors.address ? 'co-field co-field--error' : 'co-field'} htmlFor="checkoutAddress">
                  <span className="co-field__label">收货地址</span>
                  <textarea id="checkoutAddress" name="address" autoComplete="street-address" placeholder="省 / 市 / 区 + 街道门牌号" value={recipient.address} onChange={(event) => updateRecipient('address', event.target.value)} />
                  {errors.address ? <em className="co-field__error">{errors.address}</em> : null}
                </label>
              </section>

              <section className="co-card co-block" aria-label="商品信息">
                <div className="co-block__head">
                  <b>商品信息</b>
                  <button type="button" className="co-link" onClick={() => setStep('product')}>
                    修改
                  </button>
                </div>
                {productSummary}
              </section>

              <section className="co-card co-guarantee-list" aria-label="配送说明">
                <span>{shippingNote}</span>
                <span>{shippingTime}</span>
              </section>
            </>
          ) : null}

          {step === 'payment' && selectedSku ? (
            <>
              <section className="co-card co-block" aria-label="订单信息">
                <div className="co-block__head">
                  <b>订单信息</b>
                  <button type="button" className="co-link" onClick={() => setStep('product')}>
                    修改
                  </button>
                </div>
                {productSummary}
                <dl className="co-price-lines">
                  <div>
                    <dt>商品单价</dt>
                    <dd>{formatMoney(unitPrice)}</dd>
                  </div>
                  <div>
                    <dt>购买数量</dt>
                    <dd>×{quantity}</dd>
                  </div>
                  <div>
                    <dt>运费</dt>
                    <dd>{shippingNote || '包邮'}</dd>
                  </div>
                  <div className="co-price-lines__total">
                    <dt>应付合计</dt>
                    <dd>{formatMoney(total)}</dd>
                  </div>
                </dl>
              </section>

              <section className="co-card co-block" aria-label="收货信息确认">
                <div className="co-block__head">
                  <b>收货信息</b>
                  <button type="button" className="co-link" onClick={() => setStep('address')}>
                    修改
                  </button>
                </div>
                <div className="co-recipient">
                  <div className="co-recipient__line">
                    <b>{recipient.recipientName}</b>
                    <span>{recipient.phone}</span>
                  </div>
                  <p>{recipient.address}</p>
                </div>
              </section>

              <section className="co-card co-block" aria-label="支付方式">
                <div className="co-block__head">
                  <b>支付方式</b>
                </div>
                <div className="co-pay-list" role="radiogroup" aria-label="支付方式">
                  {PAYMENT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="radio"
                      aria-checked={paymentChannel === option.key}
                      className={`co-pay ${option.className}${paymentChannel === option.key ? ' co-pay--active' : ''}`}
                      onClick={() => onPaymentChannelChange(option.key)}
                    >
                      <span className="co-pay__icon" aria-hidden="true" />
                      <span className="co-pay__text">
                        <b>{option.label}</b>
                        <small>{option.hint}</small>
                      </span>
                      <span className="co-pay__radio" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <footer className="co-footer">
          <div className="co-footer__total">
            <small>共 {quantity} 件，合计</small>
            <strong data-testid="checkout-total">{formatMoney(total)}</strong>
          </div>
          {step === 'product' ? (
            <button className="co-primary" type="button" onClick={goAddress} disabled={!selectedSku}>
              下一步：填写收货信息
            </button>
          ) : null}
          {step === 'address' ? (
            <button className="co-primary" type="button" onClick={goPayment}>
              下一步：选择支付方式
            </button>
          ) : null}
          {step === 'payment' ? (
            <button className="co-primary" type="button" onClick={() => void handlePay()} disabled={submitting}>
              {submitting ? '正在创建订单…' : `立即支付 ${formatMoney(total)}`}
            </button>
          ) : null}
        </footer>
      </aside>
    </>
  );
}

export default CheckoutSheet;
