# 前台页面细节优化说明

## 修改日期
2024年1月

## 修改内容

### 1. 宝贝评价数字显示优化
**位置**: 首页评价区域标题
**修改前**: `宝贝评价({allReviews.length})` - 显示实际评论数量
**修改后**: `宝贝评价(999+)` - 固定显示 999+
**原因**: 营造热度感，不暴露真实评论数量

### 2. 全部评论底部提示
**位置**: 点击"查看全部评论"后的弹窗底部
**新增内容**: "仅展示最近10条评论"提示文字
**样式**: 居中显示，灰色小字

### 3. 首页顶部浮层动画
**位置**: 页面左上角的浮动购买提示
**修改前**: 显示图片 `<img src={floatingItem?.resolvedUrl} />`
**修改后**: 显示文字内容 `{floatingItem?.content}`
**原因**: 直接显示购买文案更直观

### 4. 底部"最新抢购"列表优化
**位置**: 产品详情下方的"最新抢购"区域
**新增功能**: 
- 每条抢购记录左侧添加随机生成的头像
- 头像大小：20px x 20px
- 头像样式：圆形
- 使用 DiceBear API 生成随机头像，基于 item.id 和 index 作为种子

**实现方式**:
```typescript
function getRandomAvatar(seed: string | number) {
  const avatars = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=',
    'https://api.dicebear.com/7.x/bottts/svg?seed=',
    'https://api.dicebear.com/7.x/initials/svg?seed=',
  ];
  const randomIndex = (typeof seed === 'string' ? seed.charCodeAt(0) : seed) % avatars.length;
  return `${avatars[randomIndex]}${seed}`;
}
```

### 5. 底部评价列表头像
**位置**: 首页底部的评价列表
**新增功能**: 在用户名左侧添加小头像
- 头像大小：16px x 16px
- 头像样式：圆形
- 使用与抢购列表相同的随机头像生成方式

### 6. 全部评论详情页完整优化
**位置**: 点击"查看全部评论"后的弹窗内容

#### 新增功能：
1. **头像显示**
   - 在用户名左侧添加头像
   - 头像大小：14px x 14px
   - 圆形样式

2. **评论日期**
   - 在用户名下方显示评论日期
   - 格式：YYYY/MM/DD（中文格式）
   - 使用 `review.createdAt` 字段，如果没有则使用当前时间
   - 样式：小字号，灰色

3. **点赞按钮**
   - 位置：每条评论右上角
   - 样式：圆角按钮，浅灰背景
   - 显示内容：👍 图标 + 点赞数
   - 点赞数初始值：随机 10-60
   - 交互：点击后数字+1（纯前端，不入库）

**状态管理**:
```typescript
const [reviewLikes, setReviewLikes] = useState<Record<number, number>>();

// 初始化时为每条评论生成随机点赞数
const initialLikes: Record<number, number> = {};
data.allReviews.forEach((review) => {
  initialLikes[review.id] = Math.floor(Math.random() * 50) + 10;
});
setReviewLikes(initialLikes);

// 点赞处理
const handleReviewLike = (reviewId: number) => {
  setReviewLikes((prev) => {
    if (!prev) return prev;
    return { ...prev, [reviewId]: (prev[reviewId] ?? 0) + 1 };
  });
};
```

## 技术细节

### 头像生成方案
使用 DiceBear API 提供的免费头像生成服务：
- avataaars: 卡通风格头像
- bottts: 机器人风格头像
- initials: 首字母头像

每次根据 seed 值生成稳定的头像，同一个 seed 总是生成相同的头像。

### 样式实现
所有新增样式均使用内联样式（inline style），避免修改全局 CSS 文件。

## 测试建议

1. **视觉测试**: 检查所有头像是否正常显示
2. **交互测试**: 点击点赞按钮，确认数字递增
3. **响应式测试**: 在不同屏幕尺寸下查看布局
4. **性能测试**: 确认头像加载不影响页面性能

## 注意事项

1. 点赞功能为纯前端实现，不保存到数据库
2. 刷新页面后点赞数会重置为随机初始值
3. 头像使用外部 API，需要网络连接
4. 如果 DiceBear API 不可用，头像会显示为空（alt=""）

## Git 提交
```
commit be644dd
feat: 优化前台页面细节

- 宝贝评价数字改为固定显示 999+
- 全部评论底部添加「仅展示最近10条评论」提示
- 顶部浮层改为显示文字内容而非图片
- 底部最新抢购列表添加随机头像
- 底部评价列表用户名旁添加小头像
- 全部评论详情页添加头像、日期和点赞按钮（前端假数据）
```
