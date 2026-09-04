import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ProductSku } from '../../shared/order';
import { CheckoutSheet, calcCheckoutTotal, clampCheckoutQuantity, validateRecipient, CHECKOUT_MAX_QUANTITY } from './CheckoutSheet';

function sku(partial: Partial<ProductSku> & Pick<ProductSku, 'id' | 'skuCode' | 'name' | 'price'>): ProductSku {
  return {
    siteId: 1,
    subtitle: '',
    originalPrice: '299.00',
    saleLabel: '券后价',
    enabled: true,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const skus: ProductSku[] = [
  sku({ id: 1, skuCode: 'single', name: '单盒体验装', subtitle: '先试用再决定', price: '99.00' }),
  sku({ id: 2, skuCode: 'double', name: '两盒优惠装', subtitle: '更划算', price: '178.00' }),
  sku({ id: 3, skuCode: 'odd', name: '特价装', price: '19.90' }),
];

describe('checkout price helpers', () => {
  it('calculates total from backend sku price × quantity without float drift', () => {
    expect(calcCheckoutTotal(skus[0], 1)).toBe(99);
    expect(calcCheckoutTotal(skus[0], 3)).toBe(297);
    expect(calcCheckoutTotal(skus[2], 3)).toBe(59.7); // 19.9 * 3 = 59.699999 in raw float math
    expect(calcCheckoutTotal(skus[1], 2)).toBe(356);
  });

  it('returns 0 when no sku is available and clamps quantity', () => {
    expect(calcCheckoutTotal(undefined, 5)).toBe(0);
    expect(calcCheckoutTotal(skus[0], 0)).toBe(99); // clamped to 1
    expect(calcCheckoutTotal(skus[0], 1000)).toBe(99 * CHECKOUT_MAX_QUANTITY);
  });

  it('clamps quantity into [1, max]', () => {
    expect(clampCheckoutQuantity(0)).toBe(1);
    expect(clampCheckoutQuantity(-3)).toBe(1);
    expect(clampCheckoutQuantity(2.7)).toBe(2);
    expect(clampCheckoutQuantity(500)).toBe(CHECKOUT_MAX_QUANTITY);
    expect(clampCheckoutQuantity(Number.NaN)).toBe(1);
  });

  it('validates recipient fields', () => {
    expect(validateRecipient({ recipientName: '', phone: '', address: '' })).toEqual({
      recipientName: expect.any(String),
      phone: expect.any(String),
      address: expect.any(String),
    });
    expect(validateRecipient({ recipientName: '张三', phone: '12345678901', address: '北京市朝阳区测试路 1 号' })).toEqual({ phone: expect.any(String) });
    expect(validateRecipient({ recipientName: '张三', phone: '13800138000', address: '北京市朝阳区测试路 1 号' })).toEqual({});
  });
});

function Harness({ onSubmit, submitting = false }: { onSubmit: (recipient: { recipientName: string; phone: string; address: string }) => Promise<void> | void; submitting?: boolean }) {
  const [selected, setSelected] = useState('single');
  const [quantity, setQuantity] = useState(1);
  const [channel, setChannel] = useState<'wxpay' | 'alipay'>('wxpay');
  return (
    <CheckoutSheet
      open
      onClose={() => {}}
      title="测试商品标题"
      shopName="测试商城"
      heroImage={{ url: 'https://example.com/hero-1.jpg', alt: '首图' }}
      skus={skus}
      selectedSkuCode={selected}
      onSelectSku={setSelected}
      quantity={quantity}
      onQuantityChange={setQuantity}
      guarantee={['商城官方自营 · 正品保障', '下单后短信通知物流', '支付成功后进入客服引导']}
      serviceNote="免费包邮 · 18:00 前下单当日发出"
      shippingNote="全国包邮"
      shippingTime="48 小时内发货"
      paymentChannel={channel}
      onPaymentChannelChange={setChannel}
      onSubmit={onSubmit}
      submitting={submitting}
    />
  );
}

describe('CheckoutSheet three-step flow', () => {
  it('step 1 shows title, first hero image, prominent guarantee badge, compact specs without prices, and total', () => {
    render(<Harness onSubmit={() => {}} />);

    expect(screen.getByRole('heading', { name: '测试商品标题' })).toBeInTheDocument();
    const img = screen.getByAltText('首图') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/hero-1.jpg');
    expect(screen.getByLabelText('正品保障')).toHaveTextContent('商城官方自营 · 正品保障');

    // 规格 chip 只显示名称，不显示价格
    const specs = screen.getByLabelText('选择规格');
    expect(within(specs).getByRole('button', { name: '单盒体验装' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(specs).queryByText(/¥/)).toBeNull();

    // 不再展示产品描述
    expect(screen.queryByText('产品描述')).toBeNull();

    // 底部合计 = 后台 SKU 单价 × 数量
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('¥99.00');
    expect(screen.getByRole('button', { name: '下一步：填写收货信息' })).toBeInTheDocument();
    // 第一步不出现收货表单与支付方式
    expect(screen.queryByLabelText('收货人')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('recalculates total when sku or quantity changes', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => {}} />);

    await user.click(screen.getByRole('button', { name: '增加数量' }));
    await user.click(screen.getByRole('button', { name: '增加数量' }));
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('¥297.00');

    await user.click(screen.getByRole('button', { name: '两盒优惠装' }));
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('¥534.00');
    expect(screen.getByText('已选：两盒优惠装')).toBeInTheDocument();

    // 直接输入数量会被约束到最大值
    fireEvent.change(screen.getByLabelText('购买数量输入'), { target: { value: '500' } });
    expect(screen.getByTestId('checkout-total')).toHaveTextContent(`¥${(178 * CHECKOUT_MAX_QUANTITY).toFixed(2)}`);
    expect(screen.getByText(`共 ${CHECKOUT_MAX_QUANTITY} 件，合计`)).toBeInTheDocument();
  });

  it('blocks step 2 → 3 until recipient info is valid, then submits with recipient and keeps total from sku', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: '增加数量' }));
    await user.click(screen.getByRole('button', { name: '下一步：填写收货信息' }));

    expect(screen.getByLabelText(/收货人/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '下一步：选择支付方式' }));
    expect(screen.getByText('请填写收货人姓名')).toBeInTheDocument();
    expect(screen.getByText('请填写正确的 11 位手机号码')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();

    await user.type(screen.getByLabelText(/收货人/), '张三');
    await user.type(screen.getByLabelText(/手机号码/), '138abc00138000');
    await user.type(screen.getByLabelText(/收货地址/), '北京市朝阳区测试路 1 号');
    expect((screen.getByLabelText(/手机号码/) as HTMLInputElement).value).toBe('13800138000');
    await user.click(screen.getByRole('button', { name: '下一步：选择支付方式' }));

    // 第三步：订单信息 + 收货信息 + 支付方式
    const radios = screen.getByRole('radiogroup', { name: '支付方式' });
    expect(within(radios).getByRole('radio', { name: /微信支付/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(radios).getByRole('radio', { name: /支付宝/ }));
    expect(within(radios).getByRole('radio', { name: /支付宝/ })).toHaveAttribute('aria-checked', 'true');

    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('13800138000')).toBeInTheDocument();
    expect(screen.getByText('应付合计').nextElementSibling).toHaveTextContent('¥198.00');
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('¥198.00');

    await user.click(screen.getByRole('button', { name: '立即支付 ¥198.00' }));
    expect(onSubmit).toHaveBeenCalledWith({ recipientName: '张三', phone: '13800138000', address: '北京市朝阳区测试路 1 号' });
  });

  it('back button returns to previous step and 修改 jumps to the right step', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => {}} />);

    expect(screen.queryByRole('button', { name: '返回上一步' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '下一步：填写收货信息' }));
    await user.click(screen.getByRole('button', { name: '返回上一步' }));
    expect(screen.getByRole('button', { name: '下一步：填写收货信息' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一步：填写收货信息' }));
    await user.click(screen.getByRole('button', { name: '修改' }));
    expect(screen.getByLabelText('选择规格')).toBeInTheDocument();
  });

  it('disables pay button while submitting', async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={() => {}} submitting />);
    await user.click(screen.getByRole('button', { name: '下一步：填写收货信息' }));
    await user.type(screen.getByLabelText(/收货人/), '张三');
    await user.type(screen.getByLabelText(/手机号码/), '13800138000');
    await user.type(screen.getByLabelText(/收货地址/), '北京市朝阳区测试路 1 号');
    await user.click(screen.getByRole('button', { name: '下一步：选择支付方式' }));
    expect(screen.getByRole('button', { name: '正在创建订单…' })).toBeDisabled();
  });
});
