import { useEffect, useState } from 'react';
import { Result, Typography, Card, Spin } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { fetchPaymentSuccessConfig } from './api';

const { Title, Paragraph } = Typography;

export default function PaymentSuccess() {
  const [config, setConfig] = useState<{ message: string; qrCodeUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentSuccessConfig()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const message = config?.message || '添加客服领取服用说明';
  const qrCodeUrl = config?.qrCodeUrl || '';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <Card style={{ maxWidth: '500px', width: '100%', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: '72px' }} />}
          title={<Title level={2} style={{ marginTop: '16px', marginBottom: '8px' }}>购买成功！</Title>}
          subTitle={<Paragraph style={{ fontSize: '16px', color: '#666', marginBottom: '32px' }}>感谢您的购买，订单已提交成功</Paragraph>}
        />
        
        <div style={{ textAlign: 'center', padding: '0 24px 24px' }}>
          <Title level={4} style={{ marginBottom: '20px' }}>{message}</Title>
          
          {qrCodeUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <img 
                src={qrCodeUrl} 
                alt="企业微信二维码" 
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  border: '2px solid #f0f0f0', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }} 
              />
            </div>
          )}
          
          <Paragraph style={{ marginTop: '16px', color: '#999', fontSize: '14px' }}>
            长按二维码保存图片，在微信中扫一扫添加客服
          </Paragraph>
        </div>
      </Card>
    </div>
  );
}
