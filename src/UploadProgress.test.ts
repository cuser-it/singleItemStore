import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadAsset } from './api';

class FakeXHR {
  static latest: FakeXHR;
  upload = { onprogress: null as null | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 201;
  responseText = JSON.stringify({ source: '/img/video.mp4', resolvedUrl: '/img/video.mp4' });
  withCredentials = false;
  timeout = 0;
  open = vi.fn();
  send = vi.fn();
  constructor() { FakeXHR.latest = this; }
}
afterEach(() => vi.unstubAllGlobals());

describe('media upload progress', () => {
  it('uses actual transfer progress but waits for storage confirmation before 100%', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const progress = vi.fn();
    const pending = uploadAsset(new File(['video'], 'test.mp4'), { siteId: 2, section: 'hero', kind: 'video', onProgress: progress });
    const xhr = FakeXHR.latest;
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/admin/upload?siteId=2&section=hero&kind=video');
    expect(xhr.withCredentials).toBe(true);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    expect(progress).toHaveBeenLastCalledWith(50);
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    expect(progress).toHaveBeenLastCalledWith(99);
    xhr.onload?.();
    await expect(pending).resolves.toMatchObject({ source: '/img/video.mp4' });
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it.each(['storage', 'network', 'timeout', 'abort'])('does not report success on %s failure', async (failure) => {
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const progress = vi.fn();
    const pending = uploadAsset(new File(['video'], 'test.mp4'), { onProgress: progress });
    const assertion = expect(pending).rejects.toBeInstanceOf(Error);
    const xhr = FakeXHR.latest;
    if (failure === 'storage') { xhr.status = 502; xhr.responseText = '{"message":"storage failed"}'; xhr.onload?.(); }
    if (failure === 'network') xhr.onerror?.();
    if (failure === 'timeout') xhr.ontimeout?.();
    if (failure === 'abort') xhr.onabort?.();
    await assertion;
    expect(progress).not.toHaveBeenCalledWith(100);
  });
});
