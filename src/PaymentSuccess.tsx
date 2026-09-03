import { useEffect, useState } from 'react';
import { Result, Typography, Card, Button, Skeleton, Space, Modal } from 'antd';
import { CheckCircleOutlined, HomeOutlined, WechatOutlined } from '@ant-design/icons';
import { fetchPaymentSuccessConfig } from './api';
import CustomerServiceModal from './components/CustomerServiceModal';

const { Title, Paragraph, Text } = Typography;

export default function PaymentSuccess() {
  const [config, setConfig] = useState<{ message: string; customerServiceUrl: string; customerServiceQrCode?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerServiceModalVisible, setCustomerServiceModalVisible] = useState(false);
  const [returnInterceptCount, setReturnInterceptCount] = useState(0);

  useEffect(() => {
    fetchPaymentSuccessConfig()
      .then((data) => {
        setConfig(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (returnInterceptCount < 1 && (config?.customerServiceUrl || config?.customerServiceQrCode)) {
        e.preventDefault();
        e.returnValue = '请先添加客服微信';
        return '请先添加客服微信';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [returnInterceptCount, config]);

  const handleOpenCustomerService = () => {
    setCustomerServiceModalVisible(true);
  };

  const handleBackHome = () => {
    if (returnInterceptCount < 1 && (config?.customerServiceUrl || config?.customerServiceQrCode)) {
      Modal.confirm({
        title: '请先添加客服微信',
        content: '为了后续发货和售后服务，建议您先添加客服微信',
        okText: '立即添加',
        cancelText: '我已添加，返回首页',
        icon: <WechatOutlined style={{ color: '#07c160' }} />,
        onOk: () => {
          setCustomerServiceModalVisible(true);
        },
        onCancel: () => {
          setReturnInterceptCount(2);
          window.location.href = '/';
        }
      });
      setReturnInterceptCount(1);
    } else {
      window.location.href = '/';
    }
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
  const hasCustomerService = config?.customerServiceUrl || config?.customerServiceQrCode;
  const orderNo = new URLSearchParams(window.location.search).get('orderNo');

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <Card style={{ maxWidth: '500px', width: '100%', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: '72px' }} />}
          title={<Title level={2} style={{ marginTop: '16px', marginBottom: '8px' }}>购买成功！</Title>}
          subTitle={<Paragraph style={{ fontSize: '16px', color: '#666', marginBottom: '32px' }}>感谢您的购买，订单已提交成功</Paragraph>}
        />
        
        <div style={{ textAlign: 'center', padding: '0 24px 24px' }}>
          {orderNo && (
            <div style={{ marginBottom: '24px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
              <Text strong style={{ fontSize: '16px' }}>订单号：</Text>
              <Text style={{ fontSize: '18px', color: '#1890ff' }}>{orderNo}</Text>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>凭订单号 + 手机号可在首页查询订单</Text>
              </div>
            </div>
          )}

          {hasCustomerService && (
            <>
              <Title level={4} style={{ marginBottom: '20px' }}>{message}</Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<WechatOutlined />}
                  size="large"
                  onClick={handleOpenCustomerService}
                  block
                  style={{
                    background: '#07c160',
                    borderColor: '#07c160',
                    height: '48px',
                    fontSize: '16px',
                    borderRadius: '24px'
                  }}
                >
                  添加客服微信
                </Button>
                <Button
                  icon={<HomeOutlined />}
                  size="large"
                  onClick={handleBackHome}
                  block
                  style={{ borderRadius: '24px', height: '48px' }}
                >
                  返回首页
                </Button>
              </Space>
            </>
          )}

          {!hasCustomerService && (
            <Button
              icon={<HomeOutlined />}
              size="large"
              onClick={() => window.location.href = '/'}
              block
              type="primary"
              style={{ borderRadius: '24px', height: '48px', marginTop: '16px' }}
            >
              返回首页
            </Button>
          )}
        </div>
      </Card>

      <CustomerServiceModal
        visible={customerServiceModalVisible}
        onClose={() => setCustomerServiceModalVisible(false)}
        qrCodeUrl={config?.customerServiceQrCode}
        serviceLink={config?.customerServiceUrl}
      />
    </div>
  );
}
