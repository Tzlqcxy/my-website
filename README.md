# cxy 个人网站

> 极客风格 · 个人数字名片

一个使用纯静态 HTML + CSS + JavaScript 构建的个人网站：个人数字名片、链接收藏库、极客工具箱、打字测试、数据仪表盘、创作者小店与五款小游戏（独立游戏中心入口），游戏战绩接入云端排名；全站共用一套主题系统（换色 + 白天/黑夜 + 液态玻璃）与音乐播放器。

🌐 **在线访问**: [https://eggfish.dpdns.org](https://eggfish.dpdns.org)

---

## 📁 项目结构

```
├── index.html      # 主页 · 个人名片（留言板 / 打字排名 / 每日名言）
├── games.html      # 游戏中心 · 五款游戏独立入口 + 本地最高分徽章
├── fish.html       # 大鱼吃小鱼（canvas 手绘深海 · 主题色跟随）
├── flappy.html     # Flappy · 极简小鸟
├── snakegames.html # 贪吃蛇
├── tetris.html     # 俄罗斯方块
├── type.html       # TypeRush · 打字速度测试（云端排名）
├── mindnote.html   # MindNote · 链接收藏（点卡片直达原站，不抓取、秒开）
├── tool.html       # GeekTool · 极客工具箱（含 SHA / RSA）
├── dash.html       # Insight Dash · 数据仪表盘
├── artisan.html    # Artisan Shop · 创作者小店
├── admin.html      # 后台管理 · 密钥登录（战绩/排名/留言 查改删）
├── assets/
│   ├── theme.css   # 全站设计令牌 + 换肤控件 + 液态玻璃 + 战绩面板样式
│   ├── theme.js    # 全站换肤（色彩/昼夜/液态玻璃开关）+ 播放器注入
│   ├── scores.js   # 小游戏云端战绩面板（Top10 + 代号 + 自动上报）
│   ├── player.js   # 全站音乐播放器（左下角浮窗）
│   └── playlist.js # 播放清单（往 music/ 加歌后在这里登记）
├── music/          # 音频文件（cat/5/13 三首）
├── favicon.svg     # 站点图标（终端提示符 >_，跟随主题变色）
├── avatar.jpg      # 头像图片
└── README.md       # 项目说明文档
```

> 后端源码在 `worker/` 目录（Cloudflare Workers + D1，已被 .gitignore 排除，仅本地与线上各一份，注意备份）。

---

## 🎮 功能特性

| 模块 | 说明 |
|------|------|
| **个人名片** | 头像、名称、头衔、简介、GitHub 链接、每日名言（按日期轮换） |
| **留言板** | 发布留言存后端 D1；删除需管理密钥（首页锁钮开启管理模式） |
| **打字排名** | 成绩自动提交云端，WPM/正确率排名，首页领奖台 + 榜单 |
| **游戏中心** | 五款游戏独立入口，卡片显示本地最高分徽章 |
| **大鱼吃小鱼** | 吃小鱼长大、躲大鱼；五阶段成长、金鱼 ×3 分、NPC 互相捕食、深海动效 |
| **云端战绩** | 四款小游戏（fish/flappy/snake/tetris）游戏结束自动上报，每游戏同名只留最高分，游戏页内 Top10 面板 |
| **后台管理** | `admin.html` 密钥登录：游戏战绩/打字排名 行内编辑 + 删除、留言管理、数据总览 |
| **极客工具箱** | 时间戳、Base64、颜色、UUID、JSON、密码生成、SHA 哈希、RSA 加解密与签名 |
| **MindNote** | 链接收藏库，点卡片直达原站（localStorage） |
| **音乐播放器** | 左下角浮窗，进度/音量/三档循环/清单/MediaSession；清单见 `assets/playlist.js` |

---

## 🎨 主题系统（全站统一）

```
assets/theme.css   # 设计令牌（:root）+ 换肤控件 + 液态玻璃 + 组件样式
assets/theme.js    # 预设解析 · 应用 · 控件挂载 · 跨标签同步 · 播放器注入
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

### 三层开关（色板最左侧两个圆钮）

- **☀️ / 🌙 白天黑夜**：`html[data-mode]` 切换；文字/边框族变量按模式重算；
  首次访问跟随系统 `prefers-color-scheme`，存 `preferred_mode`
- **💧 液态玻璃**：`html[data-lg]`；配方参考 blog —— body 彩色光斑缓慢漂移 +
  卡片半透明底 + 大 blur + 白描边；存 `preferred_liquid_glass`，
  单页关闭写 `<html data-lg="off">`
- **🎨 配色**：绿/蓝/紫/橙/粉/青 六预设 + 自定义调色盘，canvas 游戏跟随变色

### 约定

- **令牌**：`--primary` `--primary-dark` `--primary-light` `--primary-rgb` `--primary-glow`
  `--primary-border` `--primary-border-hover` `--border-color` `--text-accent/-secondary/-muted`
- **半透明主色**：一律写 `rgba(var(--primary-rgb), .04)`，自定义颜色也能跟随
- **JS / canvas 取色**：`GeekTheme.colors()` → `{ primary, dark, light, rgb }`，
  或监听 `document` 上的 `geekthemechange` 事件
- **JS API**：`GeekTheme.set(id|hex)` / `.setMode('light'|'dark')` / `.toggleMode()`
  / `.setLg('on'|'off')` / `.toggleLg()` / `.get()`
- **多标签同步**：`storage` 事件；换肤、昼夜、液态玻璃均同步
- **页面 opt-out**：`<html data-theme-ui="none">`（无槽位页不出现浮动换肤钮）、
  `data-player="off"`（不注入音乐播放器）、`data-lg="off"`（关闭液态玻璃）

---

## ☁️ 云端战绩

```
assets/scores.js   # 全站共用组件
```

游戏页接入只需两步：

```html
<script src="assets/scores.js"></script>          <!-- head 里，theme.js 之后 -->
<div class="cloud-rank" data-cloud-rank="fish"></div>  <!-- 页面任意位置 -->
<!-- 游戏结束时： -->
GameScores.submit('fish', score, '可选说明');
```

- 代号与 TypeRush 共用（`localStorage.typing_name`），面板内可改
- 0 分静默跳过；断网有缓存兜底；`pageshow` 自动刷新
- 调试：URL 加 `?gsapi=http://127.0.0.1:8787` 指向本地 worker

---

## 🔐 后台管理

- 入口 `admin.html`（不进导航、noindex），登录密钥 = Cloudflare Secret `ADMIN_TOKEN`
- 功能：游戏战绩 / 打字排名（行内编辑 + 删除）、留言删除、各表数据总览
- 接口：`/api/admin/*`（stats / game-scores / rankings 的 GET·PUT·DELETE），
  每个请求带 `X-Admin-Token` 头，服务端逐个校验；密钥存 sessionStorage（关标签页失效）

---

## 🛠️ 技术栈

### 前端
- **HTML5 / CSS3 / JavaScript** - 纯静态，无构建步骤
- **WebCrypto API** - SHA 哈希 · RSA-OAEP 加密 · RSA-PSS 签名（纯前端）
- **WebAudio** - 播放器内置合成八音盒演示曲（零音频依赖的兜底曲目）
- **Font Awesome** + **Google Fonts**（JetBrains Mono / Inter）

### 后端 (Cloudflare)
- **Cloudflare Pages** - 前端托管 · 推送 main 自动部署
- **Cloudflare Workers**（Hono）- API 服务
- **D1 数据库** - 留言板 · 打字排名 · 小游戏战绩

---

## 🚀 部署方式

> 前端：推送到 `main` 分支即自动触发 Cloudflare Pages 部署。

### 后端 worker（改动后手动部署）

```bash
cd worker
npm install

npx wrangler login                    # 首次
echo <管理密钥> | npx wrangler secret put ADMIN_TOKEN
npm run db:games:remote               # 首次：建 game_scores 表
npm run deploy                        # wrangler deploy
```

### API 一览

| 接口 | 说明 |
|------|------|
| `GET/POST /api/messages`、`DELETE /api/messages/:id` | 留言板（删除需管理密钥） |
| `GET /api/rankings(/top)`、`POST /api/rankings` | 打字排名（同名取最高） |
| `GET /api/game-scores?game=`、`GET /api/game-scores/summary` | 小游戏榜单 / 各游戏榜首 |
| `POST /api/game-scores` | 上报战绩（同名同游戏取最高，拒绝 0 分） |
| `GET/PUT/DELETE /api/admin/*` | 后台管理（全部需 X-Admin-Token） |
| `GET /api/stats/*` | 访问统计 |
