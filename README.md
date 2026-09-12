# cxy 个人网站

> 极客风格 · 个人数字名片

一个使用纯静态 HTML + CSS + JavaScript 构建的个人网站，包含个人数字名片、知识库（真实网页抓取阅读）、极客工具箱、打字测试、数据仪表盘与四款小游戏，全站共用一套主题系统。

🌐 **在线访问**: [https://eggfish.dpdns.org](https://eggfish.dpdns.org)

---

## 📁 项目结构

```
├── index.html # 主页 · 个人名片
├── mindnote.html # MindNote · 链接收藏（点卡片直达原站，不抓取、秒开）
├── tool.html # GeekTool · 极客工具箱（含 SHA / RSA）
├── type.html # TypeRush · 打字速度测试
├── dash.html # Insight Dash · 数据仪表盘
├── artisan.html # Artisan Shop · 创作者小店
├── flappy.html # Flappy · 极简小鸟
├── snakegames.html # 贪吃蛇
├── tetris.html # 俄罗斯方块
├── assets/
│   ├── theme.css # 全站设计令牌 + 换肤控件样式
│   └── theme.js # 全站换肤实现（唯一一份）
├── favicon.svg # 站点图标（终端提示符 >_，跟随主题变色）
├── avatar.jpg # 头像图片
└── README.md # 项目说明文档
```

## 🎮 功能特性

| 模块 | 说明 |
|------|------|
| **个人名片** | 头像、名称、头衔、个人简介、GitHub 链接 |
| **每日名言** | 根据日期自动轮换显示，17 条精选格言 |
| **技能栈** | 展示技术标签（React、Rust、Python 等） |
| **项目作品** | 作品集展示 + 游戏入口卡片 |
| **留言板** | 支持发布/删除留言，数据存储在后端 D1 数据库 |
| **MindNote** | 链接收藏库：内置常用文档链接 + 自建收藏（仅本机 localStorage），点卡片直接在新标签页打开原站；不做任何网络抓取，因此是秒开 |
| **打字排名** | 打字速度测试，成绩提交后自动排名（WPM/正确率） |
| **极客工具箱** | 时间戳转换、Base64 编解码、颜色转换、UUID 生成、JSON 格式化、密码生成器、SHA 哈希（文本 / 文件）、RSA 加解密与签名 |
| **贪吃蛇** | 经典游戏，键盘/触屏双支持 |
| **俄罗斯方块** | 经典游戏，计分/等级/预览功能 |
| **全局换肤** | 绿/蓝/紫/橙/粉/青 六种预设 + 自定义调色盘；9 个页面共用一套实现，canvas 游戏也跟随变色，跨标签实时同步 |

---

## 🎨 主题系统（全站统一）

所有页面共用一份实现，不再各自复制令牌与换肤代码：

```
assets/theme.css   # 设计令牌（:root）+ 换肤控件样式
assets/theme.js    # 预设解析 · 应用 · 挂载控件 · 跨标签同步
```

### 新页面接入（两个标签 + 一个槽位）

```html
<head>
  <link rel="stylesheet" href="assets/theme.css" />
  <script src="assets/theme.js"></script>  <!-- 放在 <head> 同步加载，避免首屏闪色 -->
</head>
<body>
  <!-- 换肤控件挂载点；窄容器（游戏卡片等）写 data-theme-switcher="compact" -->
  <div data-theme-switcher></div>
</body>
```

### 约定

- **令牌**：`--primary` `--primary-dark` `--primary-light` `--primary-rgb` `--primary-glow`
  `--primary-border` `--primary-border-hover` `--border-color` `--text-accent/-secondary/-muted`
- **半透明主色**：一律写 `rgba(var(--primary-rgb), .04)`，这样自定义颜色也能跟随；
  不要写固定的 `rgba(0, 255, 200, .04)`
- **JS / canvas 取色**：`GeekTheme.colors()` → `{ primary, dark, light, rgb }`（换肤后自动更新），
  或监听 `document` 上的 `geekthemechange` 事件重绘画面
- **预设**：`green / blue / purple / orange / pink / cyan` + 任意自定义色
  （自定义色的派生色按与预设同一套 HSL 关系式推导，色系不会跑偏）
- **持久化**：`localStorage` 的 `preferred_theme` / `custom_theme_color` / `current_primary_color`，
  兼容旧页面写过的键值；多标签页通过 `storage` 事件同步
- **形态自适应**：宽容器渲染整条色板；窄容器只占一个圆钮，点开弹出色板；
  `≤600px` 自动切紧凑形态，避免把页头挤到换行
- **关闭浮动钮**：`<html data-theme-ui="none">`（页面有槽位时本来也不会出现浮动钮）
- **站点图标也跟着换肤**：`<link rel="icon" href="favicon.svg" data-theme-icon />`，
  有 JS 时图标会变成当前主题色的内联 SVG（零额外请求），禁用 JS 时回退到静态 `favicon.svg`

---

## 🛠️ 技术栈

### 前端
- **HTML5** - 页面结构
- **CSS3** - 极客暗色风格 · 玻璃态效果 · 响应式设计
- **JavaScript** - 游戏逻辑 · 留言板交互 · 名言轮换
- **WebCrypto API** - SHA 哈希 · RSA-OAEP 加密 · RSA-PSS 签名（纯前端，密钥只存在浏览器）
- **CSS 变量主题令牌** - `assets/theme.css` + `assets/theme.js` 统一换肤，页面内不再各写一份令牌
- **Font Awesome** - 图标库
- **Google Fonts** - JetBrains Mono / Inter 字体

### 后端 (Cloudflare)
- **Cloudflare Pages** - 前端托管 · 自动部署
- **Cloudflare Workers** - API 服务
- **D1 数据库** - 留言板 · 打字排名数据存储

---

## 🚀 部署方式

> 推送到 `main` 分支即自动触发 Cloudflare Pages 部署（新增的 `assets/` 目录会随静态资源一起发布，无需改构建配置）。

### 方式一：Cloudflare Pages（推荐）

```bash
# 1. 登录 Cloudflare Dashboard → Pages
# 2. 连接 GitHub 仓库
# 3. 构建设置：
#    - 框架预设: 无 (None)
#    - 构建命令: 留空
#    - 输出目录: 留空
# 4. 点击部署
