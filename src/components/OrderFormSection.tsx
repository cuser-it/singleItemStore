import type { FormEvent } from 'react';

type OrderFormSectionProps = {
  value: {
    name: string;
    phone: string;
    address: string;
  };
  onChange: (field: 'name' | 'phone' | 'address', value: string) => void;
  selectedBundleName: string;
  selectedPrice: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
};

export function OrderFormSection({ value, onChange, selectedBundleName, selectedPrice, onSubmit, submitLabel }: OrderFormSectionProps) {
  return (
    <form className="order-form" onSubmit={onSubmit}>
      <div className="order-form__summary">
        <div>
          <p className="order-form__eyebrow">当前选择</p>
          <h3 className="order-form__title">{selectedBundleName}</h3>
        </div>
        <strong className="order-form__price">¥{selectedPrice.toFixed(0)}</strong>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>收货人姓名</span>
          <input value={value.name} onChange={(event) => onChange('name', event.target.value)} placeholder="请输入姓名" autoComplete="name" />
        </label>
        <label className="field">
          <span>收货人手机号</span>
          <input value={value.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="请输入手机号" inputMode="tel" autoComplete="tel" />
        </label>
      </div>

      <label className="field">
        <span>收货地址</span>
        <textarea value={value.address} onChange={(event) => onChange('address', event.target.value)} placeholder="省、市、区、详细地址" rows={3} />
      </label>

      <p className="form-note">提交后将由后端按照当前模板和套餐计算最终金额，前端仅负责收集信息。</p>

      <button type="submit" className="button button--primary button--block">
        {submitLabel}
      </button>
    </form>
  );
}
