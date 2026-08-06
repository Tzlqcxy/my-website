# cxy 个人网站

> 极客风格 · 个人数字名片

一个使用纯静态 HTML + CSS + JavaScript 构建的个人网站，包含个人简介、技能展示、项目作品集、留言板以及两个经典小游戏（贪吃蛇、俄罗斯方块）。

🌐 **在线访问**: [https://eggfish.dpdns.org](https://eggfish.dpdns.org)

---

## 📁 项目结构

## 📁 项目结构

```
/
├── index.html          # 主页 · 个人名片
├── snakegames.html     # 贪吃蛇游戏
├── tetris.html         # 俄罗斯方块游戏
└── README.md           # 项目说明文档
```

## 🎮 功能特性

| 模块 | 说明 |
| ------ | ------ |
| **个人名片** | 头像、名称、头衔、个人简介、GitHub 链接 |
| **每日名言** | 根据日期自动轮换显示，17 条精选格言 |
| **技能栈** | 展示技术标签（React、Rust、Python 等） |
| **项目作品** | 作品集展示 + 游戏入口卡片 |
| **留言板** | 支持发布/删除留言，数据存储在 localStorage |
| **贪吃蛇** | 经典游戏，键盘/触屏双支持 |
| **俄罗斯方块** | 经典游戏，计分/等级/预览功能 |

---

## 🛠️ 技术栈

- **HTML5** - 页面结构
- **CSS3** - 极客暗色风格 · 玻璃态效果 · 响应式设计
- **JavaScript** - 游戏逻辑 · 留言板交互 · 名言轮换
- **Font Awesome** - 图标库
- **Google Fonts** - JetBrains Mono / Inter 字体
- **Cloudflare Pages** - 部署托管 · 自动部署

---

## 🚀 部署方式

### 方式一：Cloudflare Pages（推荐）

```bash
# 1. 登录 Cloudflare Dashboard → Pages
# 2. 连接 GitHub 仓库
# 3. 构建设置：
#    - 框架预设: 无 (None)
#    - 构建命令: 留空
#    - 输出目录: 留空
# 4. 点击部署
