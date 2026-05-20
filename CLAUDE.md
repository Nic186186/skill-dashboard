# skill-dashboard

## 项目定位

本项目是一个本地优先的 Agent Skill 看板，用于扫描本机多个目录中的 `SKILL.md`，整理为可搜索、可筛选、可复制调用语句的网页面板。

## 技术栈

- Next.js
- React
- TypeScript
- 本地文件系统扫描
- 可选读取 SQLite 使用记录

## 约定

- 默认中文文案优先。
- 不把本地密钥、token、真实隐私数据写进代码或 README。
- `.next/`、`node_modules/`、`*.tsbuildinfo` 不进 Git。
- 公开说明文档要解释“为什么做”，不要只写安装命令。
- 截图放在 `docs/images/`。

## 验证命令

```bash
pnpm lint
pnpm build
```

## Git

- commit message 用英文。
- push 前先确认构建通过。
