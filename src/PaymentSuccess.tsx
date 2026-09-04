import { useEffect, useState } from 'react';
import { Button, Modal, Skeleton } from 'antd';
import { CheckCircleFilled, HomeOutlined, WechatOutlined } from '@ant-design/icons';
import { fetchPaymentSuccessConfig } from './api';
import CustomerServiceModal, { resolveCustomerServiceMode } from './components/CustomerServiceModal';
import { navigateHome } from './navigation';

type PaymentSuccessConfig = { message: string; customerServiceUrl: string; customerServiceQrCode?: string };

export const DEFAULT_SUCCESS_MESSAGE = '添加客服领取服用说明';

export default function PaymentSuccess() {
  const [config, setConfig] = useState<PaymentSuccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  // 用户是否已经点击过「添加客服」（打开过客服弹窗或点击了跳转链接）
  const [contacted, setContacted] = useState(false);

  const orderNo = new URLSearchParams(window.location.search).get('orderNo');

  useEffect(() => {
    let active = true;
    fetchPaymentSuccessConfig(orderNo)
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch(() => {
        if (active) setConfig({ message: DEFAULT_SUCCESS_MESSAGE, customerServiceUrl: '' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderNo]);

  const mode = resolveCustomerServiceMode(config?.customerServiceQrCode, config?.customerServiceUrl);
  const hasCustomerService = mode !== 'none';
  const message = config?.message || DEFAULT_SUCCESS_MESSAGE;

  const openCustomerService = () => {
    setContacted(true);
    setReminderOpen(false);
    setServiceOpen(true);
  };

  const handleBackHome = () => {
    // 未添加客服就想返回：先做一次二次提醒，不直接放行
    if (hasCustomerService && !contacted) {
      setReminderOpen(true);
      return;
    }
    navigateHome();
  };

  return (
    <div className="ps-page">
      <main className="ps-card" aria-busy={loading}>
        {loading ? (
          <div className="ps-loading">
            <Skeleton.Avatar active size={72} shape="circle" />
            <Skeleton active paragraph={{ rows: 2 }} />
            <Skeleton.Button active block style={{ height: 48, marginTop: 12 }} />
            <Skeleton.Button active block style={{ height: 48 }} />
          </div>
        ) : (
          <>
            <div className="ps-hero">
              <CheckCircleFilled className="ps-hero__icon" aria-hidden="true" />
              <h1 className="ps-hero__title">支付成功</h1>
              <p className="ps-hero__sub">感谢您的购买，我们会尽快为您安排发货</p>
            </div>

            {orderNo ? (
              <section className="ps-order" aria-label="订单信息">
                <div className="ps-order__row">
                  <span>订单号</span>
                  <b data-testid="ps-order-no">{orderNo}</b>
                </div>
                <p className="ps-order__hint">凭订单号 + 收货手机号可在首页底部查询订单</p>
              </section>
            ) : null}

            {hasCustomerService ? (
              <section className="ps-guide" aria-label="客服引导">
                <span className="ps-guide__badge">
                  <WechatOutlined /> 重要提醒
                </span>
                <p className="ps-guide__text">{message}</p>
              </section>
            ) : null}
          </>
        )}
      </main>

      {!loading ? (
        <footer className="ps-actions">
          {hasCustomerService ? (
            <Button type="primary" size="large" block icon={<WechatOutlined />} className="ps-btn ps-btn--primary" onClick={openCustomerService}>
              添加客服微信
            </Button>
          ) : null}
          <Button size="large" block icon={<HomeOutlined />} className={hasCustomerService ? 'ps-btn ps-btn--ghost' : 'ps-btn ps-btn--primary'} type={hasCustomerService ? 'default' : 'primary'} onClick={handleBackHome}>
            返回首页
          </Button>
        </footer>
      ) : null}

      <Modal
        open={reminderOpen}
        centered
        closable={false}
        maskClosable={false}
        width="min(340px, calc(100vw - 32px))"
        className="ps-reminder"
        footer={null}
        onCancel={() => setReminderOpen(false)}
      >
        <div className="ps-reminder__body" role="alertdialog" aria-label="添加客服提醒">
          <div className="ps-reminder__icon">
            <WechatOutlined />
          </div>
          <h3>还没有添加客服微信</h3>
          <p>为了顺利发货、查询物流以及获取售后服务，强烈建议您先添加客服微信。</p>
          <Button type="primary" size="large" block className="ps-btn ps-btn--primary" icon={<WechatOutlined />} onClick={openCustomerService}>
            立即添加客服
          </Button>
          <Button type="text" size="large" block className="ps-btn ps-btn--text" onClick={() => { setReminderOpen(false); navigateHome(); }}>
            暂不添加，返回首页
          </Button>
        </div>
      </Modal>

      <CustomerServiceModal
        visible={serviceOpen}
        onClose={() => setServiceOpen(false)}
        qrCodeUrl={config?.customerServiceQrCode}
        serviceLink={config?.customerServiceUrl}
        onContact={() => setContacted(true)}
      />
    </div>
  );
}
