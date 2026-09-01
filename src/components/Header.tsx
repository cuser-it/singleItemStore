import { Search, ShieldCheck } from 'lucide-react';

type HeaderProps = {
  shopName: string;
  onJumpToOrder: () => void;
};

export function Header({ shopName, onJumpToOrder }: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="topbar__brand">{shopName}</p>
        <p className="topbar__meta">
          <ShieldCheck size={14} />
          <span>单品模板可切换 · 支持订单查询</span>
        </p>
      </div>
      <button type="button" className="topbar__button" onClick={onJumpToOrder}>
        <Search size={16} />
        <span>查询订单</span>
      </button>
    </header>
  );
}
