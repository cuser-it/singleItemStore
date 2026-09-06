import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultBootstrap } from '../shared/site';
import { AdminAppShell } from './AdminApp';
import * as api from './api';

vi.mock('./api', async (original) => ({
  ...await original<typeof import('./api')>(),
  fetchAdminMe: vi.fn(),
  fetchAdminBootstrap: vi.fn(),
  fetchAdminSkus: vi.fn(),
  fetchAdminOrders: vi.fn(),
  fetchPaymentSettings: vi.fn(),
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/admin?siteId=1');
  vi.mocked(api.fetchAdminMe).mockResolvedValue(true);
  vi.mocked(api.fetchAdminBootstrap).mockResolvedValue({ ...defaultBootstrap, authenticated: true, sites: [defaultBootstrap.site], activeSiteId: 1 });
  vi.mocked(api.fetchAdminSkus).mockResolvedValue([]);
  vi.mocked(api.fetchAdminOrders).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  vi.mocked(api.fetchPaymentSettings).mockResolvedValue({} as Awaited<ReturnType<typeof api.fetchPaymentSettings>>);
});

describe('admin initialization in StrictMode', () => {
  it('renders content and stops spinning after successful responses', async () => {
    const { container } = render(<StrictMode><AdminAppShell /></StrictMode>);
    await waitFor(() => expect(api.fetchAdminBootstrap).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('.antd-admin-content .ant-spin-spinning')).toBeNull());
    expect(screen.getByText('管理中心')).toBeInTheDocument();
    expect(container.querySelector('.antd-admin-content')).not.toBeEmptyDOMElement();
  });
});
