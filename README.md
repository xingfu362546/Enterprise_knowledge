# 企业知识库 · 智能问答原型

企业知识库 HTML 原型：PC 门户 + 员工小程序，核心为 **小Q** 智能问答入口。

## 打开方式

| 端 | 入口 | 说明 |
|----|------|------|
| 站点根路径 | `index.html` | 自动跳转原型导航（Cloudflare `_redirects`） |
| 原型导航 | `prototype/index.html` | 双击 `打开原型.bat` |
| PC 门户 | `portal/index.html` | 右下角胶囊按钮 → 右侧抽屉与小Q对话 |
| 小程序首页 | `miniapp/home.html` | 卡通小Q浮层入口（闲置后缩至边缘） |
| 小程序聊天 | `miniapp/kb-chat.html` | 全屏问答页，含快捷问题与文档引用 |

## 智能问答相关文件

| 文件 | 作用 |
|------|------|
| `assets/kb-chat.js` | PC 抽屉聊天逻辑 |
| `assets/mp-kb-chat.js` | 小程序聊天页逻辑 |
| `assets/mp-kb-mascot.js` | 小程序小Q入口交互 |
| `assets/mp-kb.css` | 小Q形象与小程序聊天样式 |
| `assets/portal.css` | 门户页与 PC 入口样式 |

## 文档

- 设计决策：`docs/DESIGN_SESSION.md`

## Cloudflare Pages

| 配置项 | 值 |
|--------|-----|
| Build output directory | `/`（仓库根目录） |
| Build command | （留空） |

根路径 `/` 经 `_redirects` 与 `index.html` 跳转至 `prototype/index.html`（原型导航）。
