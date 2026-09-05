import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureVideoPoster } from './videoPoster';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('video poster capture', () => {
  function setup() {
    const video = document.createElement('video');
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'video' ? video : create(tag)) as typeof document.createElement);
    vi.spyOn(video, 'load').mockImplementation(() => {});
    vi.spyOn(video, 'pause').mockImplementation(() => {});
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:poster'), revokeObjectURL: revoke }));
    return { video, revoke };
  }

  it('times out and releases local video instead of leaving upload permanently pending', async () => {
    vi.useFakeTimers();
    const { video, revoke } = setup();
    const pending = captureVideoPoster(new File(['x'], 'x.mp4', { type: 'video/mp4' }));
    const assertion = expect(pending).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(revoke).toHaveBeenCalledWith('blob:poster');
    expect(video.hasAttribute('src')).toBe(false);
    expect(video.onloadeddata).toBeNull();
  });

  it('rejects decode errors and releases the object URL', async () => {
    const { video, revoke } = setup();
    const pending = captureVideoPoster(new File(['x'], 'x.mp4', { type: 'video/mp4' }));
    video.dispatchEvent(new Event('error'));
    await expect(pending).rejects.toThrow('无法读取视频首帧');
    expect(revoke).toHaveBeenCalledWith('blob:poster');
  });
});
