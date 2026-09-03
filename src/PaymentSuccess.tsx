import { useEffect, useState } from 'react';
import { Result, Typography, Card, Button, Skeleton, Space } from 'antd';
import { CheckCircleOutlined, HomeOutlined, WechatOutlined } from '@ant-design/icons';
import { fetchPaymentSuccessConfig } from './api';

const { Title, Paragraph } = Typography;

export default function PaymentSuccess() {
  const [config, setConfig] = useState<{ message: string; customerServiceUrl: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('');
  const [isWeixinLink, setIsWeixinLink] = useState(false);

  useEffect(() => {
    fetchPaymentSuccessConfig()
      .then(async (data) => {
        setConfig(data);
        
        if (data.customerServiceUrl) {
          // 判断是微信直链还是图片URL
          if (data.customerServiceUrl.startsWith('weixin://')) {
            // 微信直链，生成二维码
            setIsWeixinLink(true);
            try {
              const QRCode = (await import('qrcode')).default;
              const qrDataUrl = await QRCode.toDataURL(data.customerServiceUrl, {
                width: 200,
                margin: 2,
                color: {
                  dark: '#000000',
                  light: '#FFFFFF'
                }
              });
              setQrCodeBase64(qrDataUrl);
            } catch (error) {
              console.error('生成二维码失败:', error);
            }
          } else if (data.customerServiceUrl.startsWith('http://') || data.customerServiceUrl.startsWith('https://')) {
            // 图片URL，转换为base64
            try {
              const response = await fetch(data.customerServiceUrl);
              const blob = await response.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                setQrCodeBase64(reader.result as string);
              };
              reader.readAsDataURL(blob);
            } catch (error) {
              console.error('图片转换base64失败:', error);
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleOpenWeixin = () => {
    if (config?.customerServiceUrl) {
      window.location.href = config.customerServiceUrl;
    }
  };

  const handleBackHome = () => {
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Card style={{ maxWidth: '500px', width: '100%', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <Skeleton.Avatar active size={72} shape="circle" style={{ marginBottom: '24px' }} />
            <Skeleton active paragraph={{ rows: 2 }} />
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
              <Skeleton.Image active style={{ width: '200px', height: '200px' }} />
            </div>
            <Skeleton active paragraph={{ rows: 1 }} style={{ marginTop: '24px' }} />
          </div>
        </Card>
      </div>
    );
  }

  const message = config?.message || '添加客服领取服用说明';

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
          
          {qrCodeBase64 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px' }}>
              <img 
                src={qrCodeBase64} 
                alt="客服二维码" 
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  border: '2px solid #f0f0f0', 
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }} 
              />
              
              {isWeixinLink && (
                <Button 
                  type="primary" 
                  icon={<WechatOutlined />} 
                  size="large"
                  onClick={handleOpenWeixin}
                  style={{ 
                    marginTop: '20px',
                    background: '#07c160',
                    borderColor: '#07c160',
                    height: '48px',
                    fontSize: '16px',
                    borderRadius: '24px',
                    paddingLeft: '32px',
                    paddingRight: '32px'
                  }}
                >
                  打开微信添加客服
                </Button>
              )}
            </div>
          )}
          
          <Paragraph style={{ marginTop: '24px', color: '#999', fontSize: '14px' }}>
            {isWeixinLink ? '点击上方按钮或扫描二维码添加客服' : '长按二维码保存图片，在微信中扫一扫添加客服'}
          </Paragraph>
          
          <Space style={{ marginTop: '32px' }}>
            <Button 
              icon={<HomeOutlined />} 
              size="large"
              onClick={handleBackHome}
              style={{ borderRadius: '8px' }}
            >
              返回首页
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
