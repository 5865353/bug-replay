# 🚀 发布（Release）流程

> 目的：给项目打上版本号、打包成 zip、发布到 GitHub Releases，让别人能下载安装。
> 本文件是"照着做"的操作手册，忘了就来翻这里。

---

## 1️⃣ 一句话理解

**发版 = 改完代码 → 自动改版本号 + 写日志 + 打标签 → 推送 → 机器人自动打包发布**

```
pnpm release:patch       ① 自动：改版本号 + 写 CHANGELOG + 打 tag + 提交
git push --follow-tags   ② 推送到 GitHub（触发机器人）
去 GitHub Releases 页     ③ 机器人自动构建 / 打包 / 发布完成
```

打个比方：就像发一条朋友圈 —— ① 写好内容 ② 点发送 ③ 别人看到。只不过这里有个"机器人"帮你自动打包上传。

---

## 2️⃣ 先认识 5 个词

| 词 | 是什么 | 你的感知 |
|----|--------|----------|
| **版本号** `1.0.0` | 版本代号，存在 `package.json` | 决定这次是"小修 / 新功能 / 大改" |
| **tag** `v1.0.1` | git 的快照标签，指向某个提交 | 触发自动发布的关键信号 |
| **CHANGELOG.md** | 更新日志 | 发布时自动生成，用户看"这版改了什么" |
| **GitHub Actions** | GitHub 的自动机器人 | 推 tag 后自动帮你构建 + 打包 + 发布 |
| **GitHub Release** | 仓库的"下载发布页" | 用户在这里下载 zip |

---

## 3️⃣ 版本号怎么定（语义化版本）

| 你的变更 | 用什么命令 | 版本变化 |
|---------|-----------|----------|
| 修了一个 Bug | `pnpm release:patch` | `1.0.0` → `1.0.1` |
| 加了新功能 | `pnpm release:minor` | `1.0.0` → `1.1.0` |
| 大改 / 不兼容 | `pnpm release:major` | `1.0.0` → `2.0.0` |

> 版本号**只需改 `package.json` 一处**（`standard-version` 自动改），扩展的 manifest 版本在构建时自动读取，无需手动改两处。

### 提交信息要写成约定格式（决定版本号 + 日志内容）
- `feat: 新增 xxx` → 新功能（bump minor）
- `fix: 修复 xxx` → 修复（bump patch）
- `chore:` / `docs:` / `refactor:` / `style:` → 不 bump 版本

---

## 4️⃣ 【推荐】一条龙自动发版（日常就用这个）

### ① 发版前检查
```bash
pnpm lint          # 0 error
pnpm type-check    # 通过
pnpm build         # 成功
```
全部通过再继续。

### ② 自动出版本号 + 日志 + 标签
```bash
pnpm release:patch   # 或 release:minor / release:major
```
一条命令自动完成 4 件事：改 `package.json` 版本号 → 更新 `CHANGELOG.md` → git 提交 → 打 `vX.Y.Z` 标签。

### ③ 推送（触发机器人）
```bash
git push --follow-tags
```

### ④ 完成
等 1~2 分钟，打开 GitHub → 仓库 → **Releases** 页，即可看到新版本和 `bugreplay-vX.Y.Z.zip` 下载链接。
（机器人由 `.github/workflows/release.yml` 驱动：自动 `build` → 打 zip → 创建 Release）

---

## 5️⃣ 【备选】手动发版（不走机器人）

```bash
# 1. 自动：改版本号 + 写日志 + 打标签 + 提交
pnpm release:patch

# 2. 推送代码和标签
git push
git push --follow-tags

# 3. 本地构建并打包 zip
pnpm package          # 生成 release/bugreplay-vX.Y.Z.zip

# 4. 手动创建 GitHub Release（需要已安装 gh CLI 并登录）
gh release create vX.Y.Z release/bugreplay-vX.Y.Z.zip --title "vX.Y.Z" --notes "见 CHANGELOG.md"
```

> 如果推送 tag 后机器人已经自动发布了，就**不需要**再手动跑第 3、4 步。

---

## 6️⃣ 发布前检查清单（Checklist）

- [ ] 代码已提交，`git status` 干净
- [ ] `pnpm lint` 无 error
- [ ] `pnpm type-check` 通过
- [ ] `pnpm build` 成功
- [ ] 提交信息用了 `feat:` / `fix:` 前缀（决定版本号）
- [ ] 推送 tag 后去 GitHub Releases 页确认 zip 已生成

---

## 7️⃣ 常见问题

**Q：第一次用 GitHub Actions 需要配置什么吗？**
一般不需要。确认仓库 `Settings → Actions → General` 允许工作流运行即可（首次可能要点一下"Enable / 我了解这些工作流"）。

**Q：`release/` 目录的 zip 会进 git 吗？**
不会，`.gitignore` 已忽略 `release/`。

**Q：发错版本号了怎么办？**
```bash
git tag -d vX.Y.Z                    # 本地删标签
git push origin :vX.Y.Z              # 远端删标签
pnpm release:patch                   # 重新发
```

**Q：zip 怎么给用户安装？**
解压后：Chrome 打开 `chrome://extensions/` → 开启开发者模式 → 加载已解压的扩展程序 → 选择解压目录。

---

## 8️⃣ 上架扩展商店（待办）

- Chrome Web Store：https://developer.chrome.com/docs/webstore/ （需开发者账号，一次性 $5）
- Edge Add-ons：https://partner.microsoft.com/dashboard/microsoftedge/
- Firefox AMO：https://addons.mozilla.org/developers/

---

## 9️⃣ 这套流程涉及的文件

| 文件 | 作用 |
|------|------|
| `package.json` | 版本号唯一来源 + `release` / `package` 脚本 |
| `manifest.config.ts` | 构建时自动读取版本号 |
| `scripts/package.mjs` | 把 `dist/` 打包成 zip |
| `.github/workflows/ci.yml` | 每次 push / PR 自动 lint + type-check + build |
| `.github/workflows/release.yml` | 推 `v*` tag 时自动构建、打包、发布 |
| `CHANGELOG.md` | 更新日志（`standard-version` 生成） |
