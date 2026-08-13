# TODO

> 项目目标：打磨质量 → 完善文档 → 规范工程 → 扩展推广 → 增强 AI
> 优先级：🔴 高 / 🟡 中 / 🟢 低

## 1️⃣ 版本管理 & 发布（Release）

### 版本号
- [x] 🔴 统一版本来源：`package.json` 的 `version` 与 manifest 版本同步（manifest 自动读取 package.json）
- [x] 🔴 采用语义化版本（`major.minor.patch`），并约定规则：新增功能→minor、修复→patch、破坏性变更→major
- [x] 🟡 引入 changelog 自动生成（`standard-version`，见 `RELEASE.md`）
- [x] 🟡 在页面（popup 底部）展示当前扩展版本号

### GitHub Release
- [x] 🔴 编写打包脚本：`pnpm package` 将 `dist/` 打成 `release/bugreplay-vX.Y.Z.zip`
- [x] 🔴 配置 GitHub Actions：PR 时跑 `lint + type-check + build`（质量门禁，`.github/workflows/ci.yml`）
- [x] 🔴 配置发布 workflow：`push tag` → 构建 → 创建 GitHub Release（附 zip + 更新日志，`.github/workflows/release.yml`）
- [x] 🟡 掌握手动发布流程（见 `RELEASE.md`）：`standard-version` → `git push --follow-tags` → `gh release create`
- [ ] 🟡 上架扩展商店：Chrome Web Store / Edge Add-ons / Firefox AMO

## 2️⃣ 操作文档站（VitePress）

- [ ] 🔴 在 `docs/` 初始化 VitePress 文档站点
- [ ] 🔴 页面规划：首页、快速开始、安装加载、录制 / 标注 / 回放 / 导出 / 平台提交 使用指南、`.rrt` 格式、常见问题、更新日志
- [ ] 🔴 站点配置：标题 / logo / 导航 / 侧边栏，首页与页脚显示版本号
- [ ] 🟡 为每个功能配截图或 GIF 演示
- [ ] 🟡 部署：GitHub Actions 自动部署到 GitHub Pages（或 Vercel / Netlify）

## 3️⃣ UI/UX 打磨（当前版本较粗糙）

- [ ] 🔴 统一设计规范：配色 / 间距 / 圆角 / 字体，沉淀为 CSS 变量或 UnoCSS 主题
- [ ] 🔴 逐页面打磨：popup、options、upload、replayer（布局、间距、空态、加载态）
- [ ] 🔴 统一暗色主题与组件样式（下拉、弹窗、Toast、表单控件）
- [ ] 🟡 窄屏 / 小窗口适配、滚动条美化
- [ ] 🟡 回放页细节：时间轴控制条、面板折叠、标注交互手感
- [ ] 🟢 录制悬浮工具栏细节打磨

## 6️⃣ AI 能力增强

- [ ] 🟡 增强 AI 生成 Bug 描述：支持自定义 Prompt / 更多模型 / 输出格式
- [ ] 🟡 AI 自动分析录制数据：结合 error 日志 + 失败请求定位异常根因
- [ ] 🟡 AI 一键生成测试报告 / 更细的复现步骤
- [ ] 🟡 控制台 / 网络一键 AI 摘要
- [ ] 🟢 AI 分析前的数据脱敏开关

## 7️⃣ 功能与体验（后续）

- [ ] 🟡 录制数据隐私脱敏（输入框、敏感字段）可配置
- [ ] 🟡 录制性能优化（长会话内存 / 体积）
- [ ] 🟢 多语言 i18n（中 / 英）
- [ ] 🟢 键盘快捷键自定义
