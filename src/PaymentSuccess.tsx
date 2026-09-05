import { useEffect, useState } from 'react';
import { Button, Modal, Skeleton } from 'antd';
import { CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, HomeOutlined, ReloadOutlined, WechatOutlined } from '@ant-design/icons';
import { fetchPaymentSuccessConfig, fetchPublicOrderStatus } from './api';
import CustomerServiceModal, { resolveCustomerServiceMode } from './components/CustomerServiceModal';
import { navigateHome } from './navigation';

type PaymentSuccessConfig = { message: string; customerServiceUrl: string; customerServiceQrCode?: string };

export const DEFAULT_SUCCESS_MESSAGE = '添加客服领取服用说明';

/** 未支付时的轮询节奏：每 3 秒一次，最多 20 次（约 1 分钟） */
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20;

type PaymentPhase = 'checking' | 'paid' | 'pending' | 'failed';

export default function PaymentSuccess() {
  const [config, setConfig] = useState<PaymentSuccessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  // 用户是否已经点击过「添加客服」（打开过客服弹窗或点击了跳转链接）
  const [contacted, setContacted] = useState(false);

  const orderNo = new URLSearchParams(window.location.search).get('orderNo');

  // 微信内 H5 支付完成后不一定会回跳，回跳也不代表支付成功，
  // 因此这里回源轮询真实状态，而不是“落地即成功”。没有订单号时无从校验，保持原有展示。
  const [phase, setPhase] = useState<PaymentPhase>(orderNo ? 'checking' : 'paid');
  const [pollAttempt, setPollAttempt] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);

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

  useEffect(() => {
    if (!orderNo) return;
    if (phase === 'paid' || phase === 'failed') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const status = await fetchPublicOrderStatus(orderNo);
        if (!active) return;
        if (status.paymentStatus === 'PAID' || status.paymentStatus === 'REFUNDED') {
          setPhase('paid');
          return;
        }
        if (status.paymentStatus === 'PAYMENT_FAILED') {
          setPhase('failed');
          return;
        }
        setPhase('pending');
      } catch {
        // 查不到或网络异常时不误报成功，继续按待确认处理
        if (active) setPhase('pending');
      }
      if (active && pollAttempt < POLL_MAX_ATTEMPTS) {
        timer = setTimeout(() => {
          if (active) setPollAttempt((value) => value + 1);
        }, POLL_INTERVAL_MS);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderNo, pollAttempt, refreshToken]);

  const handleManualRefresh = () => {
    setPollAttempt(0);
    setRefreshToken((value) => value + 1);
  };

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
    // 仅在支付成功后才挽留，未支付/支付失败时不该拦着用户
    if (phase === 'paid' && hasCustomerService && !contacted) {
      setReminderOpen(true);
      return;
    }
    navigateHome();
  };

  return (
    <div className="ps-page">
      <main className="ps-card" aria-busy={loading}>
        {loading || phase === 'checking' ? (
          <div className="ps-loading">
            <Skeleton.Avatar active size={72} shape="circle" />
            <Skeleton active paragraph={{ rows: 2 }} />
            <Skeleton.Button active block style={{ height: 48, marginTop: 12 }} />
            <Skeleton.Button active block style={{ height: 48 }} />
          </div>
        ) : (
          <>
            <div className="ps-hero" data-testid="ps-hero" data-phase={phase}>
              {phase === 'paid' ? (
                <>
                  <CheckCircleFilled className="ps-hero__icon" aria-hidden="true" />
                  <h1 className="ps-hero__title">支付成功</h1>
                  <p className="ps-hero__sub">感谢您的购买，我们会尽快为您安排发货</p>
                </>
              ) : null}
              {phase === 'pending' ? (
                <>
                  <ClockCircleFilled className="ps-hero__icon ps-hero__icon--pending" aria-hidden="true" />
                  <h1 className="ps-hero__title">支付确认中</h1>
                  <p className="ps-hero__sub">已完成支付的话请稍候，系统正在与支付平台核对；若尚未付款，可返回首页重新下单</p>
                </>
              ) : null}
              {phase === 'failed' ? (
                <>
                  <CloseCircleFilled className="ps-hero__icon ps-hero__icon--failed" aria-hidden="true" />
                  <h1 className="ps-hero__title">支付未完成</h1>
                  <p className="ps-hero__sub">本笔支付未成功，金额不会被扣取，您可以返回首页重新下单</p>
                </>
              ) : null}
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

            {hasCustomerService && phase === 'paid' ? (
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

      {!loading && phase !== 'checking' ? (
        <footer className="ps-actions">
          {phase !== 'paid' ? (
            <Button size="large" block icon={<ReloadOutlined />} type="primary" className="ps-btn ps-btn--primary" onClick={handleManualRefresh}>
              我已完成支付，刷新状态
            </Button>
          ) : null}
          {hasCustomerService && phase === 'paid' ? (
            <Button type="primary" size="large" block icon={<WechatOutlined />} className="ps-btn ps-btn--primary" onClick={openCustomerService}>
              添加客服微信
            </Button>
          ) : null}
          {/* 上方已有主按钮（客服或刷新）时，返回首页降为次要样式 */}
          {(() => {
            const secondary = (hasCustomerService && phase === 'paid') || phase !== 'paid';
            return (
              <Button size="large" block icon={<HomeOutlined />} className={secondary ? 'ps-btn ps-btn--ghost' : 'ps-btn ps-btn--primary'} type={secondary ? 'default' : 'primary'} onClick={handleBackHome}>
                返回首页
              </Button>
            );
          })()}
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
