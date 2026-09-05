import { useState } from 'react';
import { Modal, Form, DatePicker, Checkbox, Button, Space, Radio, message, Alert } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface OrderExportModalProps {
  visible: boolean;
  onCancel: () => void;
  onExport: (params: {
    startDate?: string;
    endDate?: string;
    columns: string[];
  }) => Promise<void>;
  /** 当前列表筛选条件的文字描述，在弹窗里回显，避免用户误以为导出的是全部数据 */
  filterSummary?: string;
  /** 当前筛选下的订单总数（不含时间范围限制） */
  filteredTotal?: number;
}

// 所有可导出的字段
const ALL_COLUMNS = [
  { label: '订单号', value: 'orderNo' },
  { label: '商品名称', value: 'productName' },
  { label: '规格', value: 'skuName' },
  { label: '数量', value: 'quantity' },
  { label: '单价', value: 'unitAmount' },
  { label: '总金额', value: 'totalAmount' },
  { label: '收货人', value: 'recipientName' },
  { label: '手机号', value: 'phone' },
  { label: '收货地址', value: 'address' },
  { label: '支付状态', value: 'paymentStatus' },
  { label: '履约状态', value: 'fulfillmentStatus' },
  { label: '物流公司', value: 'logisticsCompany' },
  { label: '物流单号', value: 'logisticsNo' },
  { label: '支付渠道', value: 'paymentChannel' },
  { label: '创建时间', value: 'createdAt' },
  { label: '支付时间', value: 'paidAt' },
  { label: '发货时间', value: 'shippedAt' },
  { label: '退款时间', value: 'refundedAt' },
  { label: '退款备注', value: 'refundNote' },
];

// 默认选中的字段
const DEFAULT_COLUMNS = [
  'orderNo',
  'recipientName',
  'phone',
  'address',
  'skuName',
  'quantity',
  'totalAmount',
  'paymentStatus',
  'fulfillmentStatus',
  'createdAt',
];

export function OrderExportModal({ visible, onCancel, onExport, filterSummary, filteredTotal }: OrderExportModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [timeRangeType, setTimeRangeType] = useState<'preset' | 'custom'>('preset');
  const [presetRange, setPresetRange] = useState<string>('24h');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);

  const handleOk = async () => {
    try {
      await form.validateFields();
      setLoading(true);

      let startDate: string | undefined;
      let endDate: string | undefined;

      if (timeRangeType === 'preset') {
        const now = dayjs();
        switch (presetRange) {
          case '24h':
            startDate = now.subtract(24, 'hour').toISOString();
            break;
          case '3d':
            startDate = now.subtract(3, 'day').toISOString();
            break;
          case '7d':
            startDate = now.subtract(7, 'day').toISOString();
            break;
          case '30d':
            startDate = now.subtract(30, 'day').toISOString();
            break;
        }
        // 选了“全部时间”则不传时间范围，完全按列表筛选导出
        if (presetRange !== 'all') endDate = now.toISOString();
      } else {
        const customRange = form.getFieldValue('customRange') as [Dayjs, Dayjs] | undefined;
        if (customRange && customRange[0] && customRange[1]) {
          startDate = customRange[0].startOf('day').toISOString();
          endDate = customRange[1].endOf('day').toISOString();
        }
      }

      await onExport({
        startDate,
        endDate,
        columns: selectedColumns as string[],
      });

      message.success('订单导出成功');
      onCancel();
      form.resetFields();
      setTimeRangeType('preset');
      setPresetRange('24h');
      setSelectedColumns(DEFAULT_COLUMNS);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTimeRangeType('preset');
    setPresetRange('24h');
    setSelectedColumns(DEFAULT_COLUMNS);
    onCancel();
  };

  const handleCheckAll = () => {
    setSelectedColumns(ALL_COLUMNS.map((col) => col.value));
  };

  const handleCheckNone = () => {
    setSelectedColumns([]);
  };

  const handleCheckDefault = () => {
    setSelectedColumns(DEFAULT_COLUMNS);
  };

  const disabledDate = (current: Dayjs) => {
    if (!current) return false;
    
    // 禁用未来日期
    if (current.isAfter(dayjs(), 'day')) {
      return true;
    }
    
    // 检查是否超过一年
    const customRange = form.getFieldValue('customRange') as [Dayjs, Dayjs] | undefined;
    if (customRange && customRange[0] && customRange[1]) {
      const diff = customRange[1].diff(customRange[0], 'year', true);
      if (diff > 1) {
        return true;
      }
    }
    
    return false;
  };

  return (
    <Modal
      title="导出订单"
      open={visible}
      onCancel={handleCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
          导出 Excel
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="导出范围 = 列表筛选 ∩ 下方时间范围"
          description={
            <>
              <div>
                当前列表筛选：<b>{filterSummary || '全部订单'}</b>
                {typeof filteredTotal === 'number' ? <>，共 <b>{filteredTotal}</b> 笔</> : null}
              </div>
              <div style={{ marginTop: 4 }}>
                导出时还会再叠加下方选择的时间范围，<b>创建时间不在该范围内的订单不会被导出</b>。
                若导出结果为空或条数少于预期，请改选更大的时间范围。
              </div>
            </>
          }
        />
        <Form.Item label="时间范围">
          <Radio.Group
            value={timeRangeType}
            onChange={(e) => setTimeRangeType(e.target.value)}
          >
            <Radio value="preset">预设范围</Radio>
            <Radio value="custom">自定义范围</Radio>
          </Radio.Group>
        </Form.Item>

        {timeRangeType === 'preset' && (
          <Form.Item>
            <Radio.Group value={presetRange} onChange={(e) => setPresetRange(e.target.value)}>
              <Space direction="vertical">
                <Radio value="24h">近 24 小时</Radio>
                <Radio value="3d">近 3 天</Radio>
                <Radio value="7d">近 7 天</Radio>
                <Radio value="30d">近 30 天</Radio>
                <Radio value="all">全部时间（不限制创建时间）</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        )}

        {timeRangeType === 'custom' && (
          <Form.Item
            name="customRange"
            rules={[{ required: true, message: '请选择时间范围' }]}
          >
            <RangePicker
              style={{ width: '100%' }}
              disabledDate={disabledDate}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  const diff = dates[1].diff(dates[0], 'year', true);
                  if (diff > 1) {
                    message.warning('时间范围最多支持一年');
                    form.setFieldValue('customRange', undefined);
                  }
                }
              }}
            />
          </Form.Item>
        )}

        <Form.Item label="导出字段">
          <Space style={{ marginBottom: 8 }}>
            <Button size="small" onClick={handleCheckAll}>
              全选
            </Button>
            <Button size="small" onClick={handleCheckNone}>
              清空
            </Button>
            <Button size="small" onClick={handleCheckDefault}>
              默认选择
            </Button>
            <span style={{ marginLeft: 8, color: '#666' }}>
              已选 {selectedColumns.length} 项
            </span>
          </Space>
          <Checkbox.Group
            value={selectedColumns}
            onChange={setSelectedColumns}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {ALL_COLUMNS.map((col) => (
                <Checkbox key={col.value} value={col.value}>
                  {col.label}
                </Checkbox>
              ))}
            </div>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}
