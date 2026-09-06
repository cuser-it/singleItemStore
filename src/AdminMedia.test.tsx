import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  uploadAsset: vi.fn(),
  createMediaAsset: vi.fn(),
  updateMediaAsset: vi.fn(),
  saveHeroMediaMode: vi.fn(),
}));

const asset = (id: number, section: 'hero' | 'detail', kind: 'image' | 'video', siteId = 1) => ({
  id,
  siteId,
  section,
  kind,
  sourceType: 'upload' as const,
  source: `/uploads/${id}.${kind === 'video' ? 'mp4' : 'jpg'}`,
  posterSource: kind === 'video' ? `/uploads/${id}.jpg` : null,
  alt: `${kind}-${id}`,
  sortOrder: id,
  enabled: true,
  resolvedUrl: `/uploads/${id}.${kind === 'video' ? 'mp4' : 'jpg'}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function bootstrap() {
  const carousel = asset(1, 'hero', 'image');
  const video = asset(2, 'hero', 'video');
  const detail = asset(3, 'detail', 'image');
  return {
    ...defaultBootstrap,
    settings: { ...defaultBootstrap.settings, heroMediaMode: 'image' as const },
    heroImages: [carousel, { ...carousel }],
    heroVideo: video,
    detailImages: [detail, { ...detail }, asset(4, 'detail', 'video')],
    authenticated: true as const,
    sites: [defaultBootstrap.site],
    activeSiteId: 1,
  };
}

beforeEach(() => {
  class TestResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
  window.history.replaceState({}, '', '/admin?siteId=1#/media');
  vi.clearAllMocks();
  vi.mocked(api.fetchAdminMe).mockResolvedValue(true);
  vi.mocked(api.fetchAdminBootstrap).mockResolvedValue(bootstrap());
  vi.mocked(api.fetchAdminSkus).mockResolvedValue([]);
  vi.mocked(api.fetchAdminOrders).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  vi.mocked(api.fetchPaymentSettings).mockResolvedValue({} as Awaited<ReturnType<typeof api.fetchPaymentSettings>>);
});

async function renderMedia() {
  render(<AdminAppShell />);
  await waitFor(() => expect(screen.getByText('/uploads/1.jpg')).toBeInTheDocument());
}

describe('admin media tabs', { timeout: 30000 }, () => {
  it('keeps carousel, homepage video and detail images separate and de-duplicates by siteId/id', async () => {
    await renderMedia();
    expect(screen.getAllByRole('row', { name: /image-1/ })).toHaveLength(1);
    expect(screen.queryByText('/uploads/2.mp4')).not.toBeInTheDocument();
    expect(screen.queryByAltText('image-3')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '首页视频' }));
    expect(await screen.findByText('/uploads/2.mp4')).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /image-1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /image-3/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '商品详情图' }));
    expect(await screen.findByRole('row', { name: /image-3/ })).toBeInTheDocument();
    expect(screen.queryByText('/uploads/2.mp4')).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /image-1/ })).not.toBeInTheDocument();
    expect(screen.queryByText('/uploads/4.mp4')).not.toBeInTheDocument();
  });

  it('renders video poster only and mounts a player only after explicit preview', async () => {
    await renderMedia();
    fireEvent.click(screen.getByRole('tab', { name: '首页视频' }));
    expect(await screen.findByText('/uploads/2.mp4')).toBeInTheDocument();
    expect(screen.queryByLabelText('已保存视频预览')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('视频预览播放器')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('点击预览'));
    expect(await screen.findByLabelText('视频预览播放器')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByLabelText('视频预览播放器')).not.toBeInTheDocument());
  });

  it('does not upload or request media when switching tabs', async () => {
    await renderMedia();
    expect(api.uploadAsset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: '首页视频' }));
    fireEvent.click(screen.getByRole('tab', { name: '商品详情图' }));
    fireEvent.click(screen.getByRole('tab', { name: '轮播图片' }));
    expect(api.uploadAsset).not.toHaveBeenCalled();
    expect(api.fetchAdminBootstrap).toHaveBeenCalledTimes(1);
  });
});

describe('admin media upload locking', { timeout: 30000 }, () => {
  it('shows progress and blocks drawer close while upload is busy', async () => {
    await renderMedia();
    fireEvent.click(screen.getByRole('button', { name: /添加轮播图/ }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    let resolveUpload: ((value: any) => void) | undefined;
    vi.mocked(api.uploadAsset).mockImplementation(async (_file: File, options: any) => {
      options.onProgress?.(42);
      return await new Promise((resolve) => { resolveUpload = resolve; });
    });
    fireEvent.change(input, { target: { files: [new File(['image'], 'image.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('上传文件中')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();

    expect(screen.getByText('上传文件中')).toBeInTheDocument();
    const drawer = document.querySelector('.ant-drawer')!;
    const cancel = Array.from(drawer.querySelectorAll('button')).find(button => button.textContent?.replace(/\s/g, '') === '取消')!;
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    fireEvent.keyDown(drawer, { key: 'Escape', keyCode: 27 });
    const mask = drawer.querySelector('.ant-drawer-mask');
    if (mask) fireEvent.click(mask);
    expect(screen.getByText('上传文件中')).toBeInTheDocument();
    await act(async () => { resolveUpload?.({ source: '/uploads/image.jpg', resolvedUrl: '/uploads/image.jpg' }); });
    await waitFor(() => expect(screen.queryByText('上传文件中')).not.toBeInTheDocument());
    expect(screen.getByLabelText('素材地址')).toHaveValue('/uploads/image.jpg');
    expect(api.createMediaAsset).not.toHaveBeenCalled();
    fireEvent.click(cancel);
    expect(await screen.findByText('放弃未保存的媒体吗？')).toBeInTheDocument();
    fireEvent.click(screen.getByText('继续编辑'));
    expect(screen.getByLabelText('素材地址')).toHaveValue('/uploads/image.jpg');
  });
});
