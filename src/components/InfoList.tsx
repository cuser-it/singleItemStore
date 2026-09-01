import type { Spec } from '../data/types';

type InfoListProps = {
  items: Spec[];
};

export function InfoList({ items }: InfoListProps) {
  return (
    <dl className="info-list">
      {items.map((item) => (
        <div className="info-list__row" key={item.label}>
          <dt className="info-list__label">{item.label}</dt>
          <dd className="info-list__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
