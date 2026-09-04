import { Modal, Button, Image, Skeleton } from 'antd';
import { WechatOutlined } from '@ant-design/icons';

export type CustomerServiceMode = 'qr-and-link' | 'qr-only' | 'link-only' | 'none';

/**
 * 根据后台配置决定添加客服页的布局：
 * - qr-and-link：上方二维码，下方「无法扫码？点击添加」按钮（带超链接）
 * - qr-only：上方二维码，下方文字提示「长按图片识别二维码」
 * - link-only：不显示二维码占位，直接显示「点击添加客服微信」按钮
 * - none：没有任何客服配置
 */
export function resolveCustomerServiceMode(qrCodeUrl?: string, serviceLink?: string): CustomerServiceMode {
  const hasQr = Boolean(qrCodeUrl?.trim());
  const hasLink = Boolean(serviceLink?.trim());
  if (hasQr && hasLink) return 'qr-and-link';
  if (hasQr) return 'qr-only';
  if (hasLink) return 'link-only';
  return 'none';
}

interface CustomerServiceModalProps {
  visible: boolean;
  onClose: () => void;
  qrCodeUrl?: string;
  serviceLink?: string;
  /** 用户点击了跳转链接（视为已尝试添加客服） */
  onContact?: () => void;
}

const QR_SIZE = 220;

export default function CustomerServiceModal({ visible, qrCodeUrl, serviceLink, onClose, onContact }: CustomerServiceModalProps) {
  const mode = resolveCustomerServiceMode(qrCodeUrl, serviceLink);
  const link = serviceLink?.trim();

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width="min(360px, calc(100vw - 32px))"
      title={<span className="cs-modal__title">添加微信客服</span>}
      className="cs-modal"
      styles={{ body: { textAlign: 'center', padding: '8px 4px 4px' } }}
    >
      {(mode === 'qr-and-link' || mode === 'qr-only') && (
        <div className="cs-modal__qr" data-testid="cs-qr">
          <Image
            src={qrCodeUrl}
            alt="客服二维码"
            width={QR_SIZE}
            height={QR_SIZE}
            preview={false}
            placeholder={<Skeleton.Image active style={{ width: QR_SIZE, height: QR_SIZE }} />}
            fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><rect width='100%' height='100%' fill='%23f2f3f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='%23999'>二维码加载失败</text></svg>"
            style={{ borderRadius: 10, border: '1px solid #eef0f3' }}
          />
        </div>
      )}

      {mode === 'qr-only' && (
        <p className="cs-modal__hint" data-testid="cs-longpress-hint">
          长按图片识别二维码，添加我们的微信客服
        </p>
      )}

      {(mode === 'qr-and-link' || mode === 'link-only') && link && (
        <Button
          type="primary"
          icon={<WechatOutlined />}
          size="large"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onContact}
          block
          className="cs-modal__button"
          style={{ background: '#07c160', borderColor: '#07c160', height: 48, fontSize: 16, borderRadius: 24 }}
        >
          {mode === 'qr-and-link' ? '无法扫码？点击直接添加' : '点击添加客服微信'}
        </Button>
      )}

      {mode === 'qr-and-link' && (
        <p className="cs-modal__hint cs-modal__hint--sub">也可以长按上方图片识别二维码</p>
      )}

      {mode === 'none' && <p className="cs-modal__hint">客服信息暂未配置，请稍后再试</p>}
    </Modal>
  );
}
