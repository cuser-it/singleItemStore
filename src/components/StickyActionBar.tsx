import { MessageCircle, ReceiptText, ShoppingBag } from 'lucide-react';

type StickyActionBarProps = {
  onJumpToOrder: () => void;
  onJumpToSupport: () => void;
  onJumpToDetails: () => void;
};

export function StickyActionBar({ onJumpToOrder, onJumpToSupport, onJumpToDetails }: StickyActionBarProps) {
  return (
    <div className="sticky-bar" role="navigation" aria-label="底部操作栏">
      <button type="button" className="sticky-bar__ghost" onClick={onJumpToSupport}>
        <MessageCircle size={16} />
        <span>客服</span>
      </button>
      <button type="button" className="sticky-bar__ghost" onClick={onJumpToDetails}>
        <ReceiptText size={16} />
        <span>详情</span>
      </button>
      <button type="button" className="sticky-bar__primary" onClick={onJumpToOrder}>
        <ShoppingBag size={16} />
        <span>立即购买</span>
      </button>
    </div>
  );
}
