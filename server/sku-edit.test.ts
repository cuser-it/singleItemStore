import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const baseUrl = 'http://localhost:5174';
let authCookie = '';

beforeAll(async () => {
  // 登录获取 cookie
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin' }),
  });
  const setCookie = loginRes.headers.get('set-cookie');
  authCookie = setCookie?.split(';')[0] || '';
});

describe('SKU 编辑功能测试', () => {
  it('应该能够成功编辑 SKU', async () => {
    // 1. 获取 SKU 列表
    const skusRes = await fetch(`${baseUrl}/api/admin/skus`, {
      headers: { cookie: authCookie },
    });
    const skus = await skusRes.json();
    expect(skus.length).toBeGreaterThan(0);
    
    const firstSku = skus[0];
    console.log('原始 SKU:', firstSku);
    
    // 2. 编辑 SKU
    const updatedInput = {
      skuCode: firstSku.skuCode,
      name: '测试编辑后的规格名称',
      subtitle: firstSku.subtitle,
      price: '188.00',
      originalPrice: firstSku.originalPrice,
      saleLabel: firstSku.saleLabel,
      highlight: firstSku.highlight,
      enabled: firstSku.enabled,
      sortOrder: firstSku.sortOrder,
    };
    
    const updateRes = await fetch(`${baseUrl}/api/admin/skus/${firstSku.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        cookie: authCookie 
      },
      body: JSON.stringify(updatedInput),
    });
    
    console.log('更新响应状态:', updateRes.status);
    const updateResult = await updateRes.json();
    console.log('更新响应内容:', updateResult);
    
    expect(updateRes.ok).toBe(true);
    expect(updateResult.name).toBe('测试编辑后的规格名称');
    expect(updateResult.price).toBe('188.00');
    
    // 3. 验证更新成功
    const verifyRes = await fetch(`${baseUrl}/api/admin/skus`, {
      headers: { cookie: authCookie },
    });
    const verifiedSkus = await verifyRes.json();
    const verifiedSku = verifiedSkus.find((s: any) => s.id === firstSku.id);
    
    console.log('验证后的 SKU:', verifiedSku);
    expect(verifiedSku.name).toBe('测试编辑后的规格名称');
    expect(verifiedSku.price).toBe('188.00');
  });
  
  it('删除（停用）SKU 后应该变为停用状态', async () => {
    // 1. 获取一个启用的 SKU
    const skusRes = await fetch(`${baseUrl}/api/admin/skus`, {
      headers: { cookie: authCookie },
    });
    const skus = await skusRes.json();
    const enabledSku = skus.find((s: any) => s.enabled);
    
    if (!enabledSku) {
      console.log('没有启用的 SKU，跳过测试');
      return;
    }
    
    console.log('准备停用的 SKU:', enabledSku);
    
    // 2. 删除（停用）SKU
    const deleteRes = await fetch(`${baseUrl}/api/admin/skus/${enabledSku.id}`, {
      method: 'DELETE',
      headers: { cookie: authCookie },
    });
    
    console.log('删除响应状态:', deleteRes.status);
    expect(deleteRes.status).toBe(204);
    
    // 3. 验证 SKU 被停用而不是删除
    const verifyRes = await fetch(`${baseUrl}/api/admin/skus`, {
      headers: { cookie: authCookie },
    });
    const verifiedSkus = await verifyRes.json();
    const verifiedSku = verifiedSkus.find((s: any) => s.id === enabledSku.id);
    
    console.log('停用后的 SKU:', verifiedSku);
    expect(verifiedSku).toBeDefined(); // SKU 仍然存在
    expect(verifiedSku.enabled).toBe(false); // 但是被停用了
  });
});
