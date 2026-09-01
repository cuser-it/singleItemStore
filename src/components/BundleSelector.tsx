import { Check } from 'lucide-react';
import type { Bundle } from '../data/types';

type BundleSelectorProps = {
  bundles: Bundle[];
  value: string;
  onChange: (bundleId: string) => void;
};

export function BundleSelector({ bundles, value, onChange }: BundleSelectorProps) {
  return (
    <div className="bundle-grid" role="radiogroup" aria-label="套餐选择">
      {bundles.map((bundle) => {
        const active = bundle.id === value;

        return (
          <button
            key={bundle.id}
            type="button"
            className={active ? 'bundle-card bundle-card--active' : 'bundle-card'}
            onClick={() => onChange(bundle.id)}
            role="radio"
            aria-checked={active}
          >
            <div className="bundle-card__head">
              <div>
                <p className="bundle-card__name">{bundle.name}</p>
                <p className="bundle-card__sub">{bundle.subtitle}</p>
              </div>
              {active ? (
                <span className="bundle-card__check" aria-hidden="true">
                  <Check size={14} />
                </span>
              ) : null}
            </div>

            <div className="bundle-card__price-row">
              <strong className="bundle-card__price">¥{bundle.price.toFixed(0)}</strong>
              <span className="bundle-card__origin">¥{bundle.originalPrice.toFixed(0)}</span>
            </div>

            <div className="bundle-card__footer">
              <span className="badge badge--ghost">{bundle.saleLabel}</span>
              {bundle.highlight ? <span className="bundle-card__highlight">{bundle.highlight}</span> : <span />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
