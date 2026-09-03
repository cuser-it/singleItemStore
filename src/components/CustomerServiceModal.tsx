import { Modal, Button, Space } from 'antd';
import { WechatOutlined } from '@ant-design/icons';

interface CustomerServiceModalProps {
  visible: boolean;
  onClose: () => void;
  qrCodeUrl?: string;
  serviceLink?: string;
}

export default function CustomerServiceModal({ visible, qrCodeUrl, serviceLink, onClose }: CustomerServiceModalProps) {
  const handleOpenLink = () => {
    if (serviceLink) {
      window.open(serviceLink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      width={400}
      styles={{
        body: { textAlign: 'center', padding: '32px 24px' }
      }}
    >
      {qrCodeUrl && (
        <div style={{ marginBottom: '24px' }}>
          <img
            src={qrCodeUrl}
            alt="客服二维码"
            style={{
              width: '240px',
              height: '240px',
              border: '2px solid #f0f0f0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
          <p style={{ marginTop: '16px', color: '#666', fontSize: '14px' }}>
            长按识别二维码添加客服
          </p>
        </div>
      )}

      {serviceLink && (
        <Button
          type="primary"
          icon={<WechatOutlined />}
          size="large"
          onClick={handleOpenLink}
          block
          style={{
            background: '#07c160',
            borderColor: '#07c160',
            height: '48px',
            fontSize: '16px',
            borderRadius: '24px',
            marginBottom: '12px'
          }}
        >
          {qrCodeUrl ? '二维码无法识别？点击此处添加' : '点击添加客服微信'}
        </Button>
      )}
    </Modal>
  );
}
