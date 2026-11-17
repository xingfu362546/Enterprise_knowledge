# 企业知识库 · 智能问答原型

**版本：v1.1.0**（2026-11-17）

企业知识库 HTML 原型：PC 门户 + 员工小程序，核心为 **小Q** 智能问答入口。v1.1.0 起，PC 门户的 AI 智能助手改为居中大浮层，可选择多个智能体对话。

## 打开方式

| 端 | 入口 | 说明 |
|----|------|------|
| 站点根路径 | `index.html` | 自动跳转原型导航（Cloudflare `_redirects`） |
| 原型导航 | `prototype/index.html` | 双击 `打开原型.bat` |
| PC 门户 | `portal/index.html` | 右下角「AI智能助手」按钮 → 居中大浮层，左侧选智能体、右侧对话 |
| 小程序首页 | `miniapp/home.html` | 卡通小Q浮层入口（闲置后缩至边缘） |
| 小程序聊天 | `miniapp/kb-chat.html` | 全屏问答页，含快捷问题与文档引用 |
| 小程序智能助手 | `miniapp/assistant.html` | 多智能体对话页 |

## 智能体（v1.1.0）

| 智能体 | 用途 |
|--------|------|
| 企业助手 | 请假查询与发起 |
| 6Q思维法 | 思维方法与练习 |
| 会议室查询 | 场地、容量、预约 |
| 学员数据查询 | 学员档案、参与期数、签到、支付、场次名单、课程场次；复训有礼名单与 Excel 导出 |

## 智能问答相关文件

| 文件 | 作用 |
|------|------|
| `assets/kb-chat.js` | PC 抽屉聊天逻辑 |
| `assets/oa-assistant.js` | 多智能体助手（PC 大浮层 / 小程序内嵌） |
| `assets/oa-assistant.css` | 多智能体助手样式 |
| `assets/mp-kb-chat.js` | 小程序聊天页逻辑 |
| `assets/mp-kb-mascot.js` | 小程序小Q入口交互 |
| `assets/mp-kb.css` | 小Q形象与小程序聊天样式 |
| `assets/portal.css` | 门户页与 PC 入口样式 |
| `mcp_bridge.py` | 本机门户到本体 MCP 的只读桥接（`/api/mcp`、`/api/students/*`） |

## 本地运行

```powershell
# 需本体服务在 8001 端口；桥接默认 127.0.0.1:8765
python -u mcp_bridge.py
# 打开 http://127.0.0.1:8765/portal/index.html
```

桥接从本体 `.env` 读取管理员口令，不保存业务库密码；学员名单查询走本体已发布动作，只读。

## 文档

- 设计决策：`docs/DESIGN_SESSION.md`
- 版本记录：`VERSION`

## Cloudflare Pages

| 配置项 | 值 |
|--------|-----|
| Build output directory | `/`（仓库根目录） |
| Build command | （留空） |

根路径 `/` 经 `_redirects` 与 `index.html` 跳转至 `prototype/index.html`（原型导航）。
