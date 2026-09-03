# 易支付配置说明

## 当前配置状态

✅ **已完成配置项：**
- 网关地址：`https://pay.yunvix.com/submit.php`
- 商户ID：`1000`
- 商户密钥：`4NTZ8t7475dJ4tXtW4jAJDJeDtvdJ84T`
- 启用渠道：支付宝、微信

⚠️ **临时配置（本地测试）：**
- 回调地址：`http://103.236.76.222:3001/api/payment/epay/notify`
- 返回地址：`http://103.236.76.222:5173/payment/return`

## 配置方式

### 1. 环境变量方式（推荐）

在 `.env` 文件中配置：

```env
# 易支付配置
EPAY_GATEWAY_URL="https://pay.yunvix.com/submit.php"
EPAY_MERCHANT_ID="1000"
EPAY_MERCHANT_SECRET="4NTZ8t7475dJ4tXtW4jAJDJeDtvdJ84T"
EPAY_NOTIFY_URL="http://103.236.76.222:3001/api/payment/epay/notify"
EPAY_RETURN_URL="http://103.236.76.222:5173/payment/return"
```

### 2. 管理后台配置方式

访问后台管理系统的"支付配置"页面，填写以下信息：

- **易支付网关地址**：`https://pay.yunvix.com/submit.php`
- **商户ID**：`1000`
- **商户密钥**：`4NTZ8t7475dJ4tXtW4jAJDJeDtvdJ84T`
- **异步回调地址**：`https://你的域名.com/api/payment/epay/notify`（必须是公网可访问的完整URL）
- **同步返回地址**：`https://你的域名.com/payment/return`（用户支付完成后跳转的页面）
- **启用的支付渠道**：选择 支付宝 和/或 微信

## 重要说明

### 关于回调地址（notify_url）

**必须满足以下条件：**

1. **必须是完整的URL**：不能是相对路径，必须包含协议和域名
2. **必须可以公网访问**：易支付服务器会主动 POST 请求到这个地址
3. **推荐使用 HTTPS**：生产环境强烈建议使用 HTTPS

**错误示例：**
- ❌ `/api/payment/epay/notify`（相对路径）
- ❌ `http://localhost:3001/api/payment/epay/notify`（本地地址，易支付无法访问）
- ❌ `http://192.168.1.100:3001/api/payment/epay/notify`（内网地址，易支付无法访问）

**正确示例：**
- ✅ `https://shop.example.com/api/payment/epay/notify`
- ✅ `http://103.236.76.222:3001/api/payment/epay/notify`（仅当此IP可公网访问且防火墙开放）

### 关于返回地址（return_url）

这是用户支付完成后浏览器跳转的页面地址，也必须是完整URL。

### 本地测试注意事项

如果你在本地开发环境测试支付功能：

1. **回调地址问题**：易支付无法访问 `localhost` 或内网IP，所以异步回调（notify_url）会失败
2. **测试方案**：
   - 使用内网穿透工具（如 ngrok, frp）将本地服务暴露到公网
   - 或者部署到有公网IP的服务器上测试
3. **返回地址**：可以使用 `http://localhost:5173/payment/return`，因为这是浏览器端跳转

## 生产环境部署

部署到生产环境时，需要将回调地址和返回地址改为实际域名：

```env
EPAY_NOTIFY_URL="https://你的域名.com/api/payment/epay/notify"
EPAY_RETURN_URL="https://你的域名.com/payment/return"
```

或者在后台管理系统中更新配置。

## 支付流程

1. 用户在前台下单
2. 系统生成订单并跳转到易支付收银台
3. 用户完成支付
4. **异步回调**：易支付 POST 到 `notify_url`，系统更新订单状态（这是最重要的）
5. **同步返回**：浏览器跳转到 `return_url`，展示支付结果

## 故障排查

### 问题：点击支付后跳转到 404 页面

**原因**：网关地址错误，缺少 `submit.php`

**解决**：确保网关地址是 `https://pay.yunvix.com/submit.php`

### 问题：支付完成后订单状态没有更新

**原因**：异步回调失败，易支付无法访问你的 `notify_url`

**排查步骤**：
1. 检查 `notify_url` 是否是完整的公网可访问URL
2. 检查服务器防火墙是否开放了对应端口
3. 检查易支付后台是否有回调失败记录
4. 查看应用服务器日志 `/api/payment/epay/notify` 是否收到请求

### 问题：后台配置保存后刷新页面还是显示"未配置"

**原因**：这个问题已修复（见 commit 6c1ef5c）

**解决**：拉取最新代码并重启服务

## 易支付文档

官方文档：https://pay.yunvix.com/doc_old.html#pay1
