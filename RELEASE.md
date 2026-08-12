# Release 发布指南

## 版本号规则（语义化版本 SemVer）

| 变更类型 | 版本 | 示例 |
|---------|------|------|
| Bug 修复 | patch | `1.0.0` → `1.0.1` |
| 新增功能（向后兼容） | minor | `1.0.0` → `1.1.0` |
| 破坏性变更 / 重大重构 | major | `1.0.0` → `2.0.0` |

**版本号唯一来源是 `package.json` 的 `version`**，manifest 构建时自动读取（`manifest.config.ts`），无需手动改两处。

## 提交信息规范（用于自动生成 CHANGELOG）

使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 风格：

- `feat: xxx` → 新功能（bump minor）
- `fix: xxx` → 修复（bump patch）
- `chore:` / `refactor:` / `docs:` / `style:` 等 → 不 bump 版本

## 手动发布流程（本地）

1. 确认代码已提交、工作区干净
2. 按变更类型生成版本号 + CHANGELOG + 打 tag：

   ```bash
   pnpm release:patch   # 或 release:minor / release:major
   ```

   等价于 `standard-version`：bump version → 生成/更新 `CHANGELOG.md` → git 提交 → 打 `vX.Y.Z` tag

3. 推送代码与 tag：

   ```bash
   git push
   git push --follow-tags
   ```

4. 构建并打包 zip：

   ```bash
   pnpm package         # 生成 release/bugreplay-vX.Y.Z.zip
   ```

5. 创建 GitHub Release（本地 CLI）：

   ```bash
   gh release create vX.Y.Z release/bugreplay-vX.Y.Z.zip --title "vX.Y.Z" --notes "见 CHANGELOG.md"
   ```

> ⚡ 推送 `v*` tag 后，仓库内的 `.github/workflows/release.yml` 会自动执行：构建 → 打包 → 创建 GitHub Release（附 zip），此时无需手动执行第 4、5 步。

## CI / 自动发布

- `.github/workflows/ci.yml`：每次 push / PR 自动跑 `lint + type-check + build`，作为质量门禁。
- `.github/workflows/release.yml`：打 `v*` tag 时自动发布 Release（需要仓库已配置 GitHub Actions 权限）。

## 上架扩展商店（待办）

- Chrome Web Store：https://developer.chrome.com/docs/webstore/ （需开发者账号，一次性 $5 注册费）
- Edge Add-ons：https://partner.microsoft.com/dashboard/microsoftedge/
- Firefox AMO：https://addons.mozilla.org/developers/
