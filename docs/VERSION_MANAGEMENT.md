# 版本管理指南

## 概述

OpenBunny 使用统一的版本管理系统，所有包的版本号由根目录 `package.json` 统一管理。

## 版本同步机制

版本号会自动同步到以下位置：
- 根目录 `package.json`
- 所有 workspace 包的 `package.json` (packages/*/package.json, worker/package.json)
- `packages/shared/src/version.ts` (供代码引用)
- `packages/mobile/app.json` (Expo 配置)

## 使用方法

### 1. 查看当前版本

```bash
cat package.json | grep version
```

### 2. 同步版本号（不修改版本）

如果手动修改了某些包的版本号，可以运行此命令将所有包同步到根目录的版本：

```bash
pnpm version:sync
```

### 3. 更新版本号

更新版本号并同步到所有包：

```bash
# 方式 1: 使用 pnpm version:set
pnpm version:set 0.2.0

# 方式 2: 直接运行脚本
node scripts/sync-version.mjs 0.2.0
```

### 4. 标准版本发布流程

```bash
# 1. 更新版本号
pnpm version:set 0.2.0

# 2. 提交版本变更
git add .
git commit -m "chore: bump version to 0.2.0"

# 3. 创建 git tag
git tag v0.2.0

# 4. 推送到远程
git push origin main --tags
```

## 版本号规范

遵循 [Semantic Versioning 2.0.0](https://semver.org/)：

- **MAJOR.MINOR.PATCH** (例如: 1.2.3)
  - **MAJOR**: 不兼容的 API 变更
  - **MINOR**: 向后兼容的功能新增
  - **PATCH**: 向后兼容的问题修复

### 版本号示例

- `0.1.0` - 初始开发版本
- `0.2.0` - 新增功能
- `0.2.1` - Bug 修复
- `1.0.0` - 第一个稳定版本
- `1.1.0` - 新增功能（向后兼容）
- `2.0.0` - 重大变更（不向后兼容）

## 自动化脚本

### scripts/sync-version.mjs

此脚本负责版本同步，功能包括：

1. 读取根目录 `package.json` 的版本号
2. 如果提供了新版本号参数，先更新根目录版本
3. 遍历所有 workspace 包，更新其 `package.json`
4. 生成 `packages/shared/src/version.ts` 文件
5. 更新 `packages/mobile/app.json` 中的 Expo 版本

### 注意事项

⚠️ **不要手动编辑 `packages/shared/src/version.ts`**

此文件由脚本自动生成，手动修改会在下次同步时被覆盖。

## 在代码中使用版本号

```typescript
import { APP_VERSION } from '@shared/version';

console.log(`OpenBunny v${APP_VERSION}`);
```

## CI/CD 集成

在 CI/CD 流程中，可以在构建前自动同步版本：

```yaml
# .github/workflows/build.yml
- name: Sync version
  run: pnpm version:sync
  
- name: Build
  run: pnpm build
```

## 常见问题

### Q: 为什么不使用 `npm version` 命令？

A: `npm version` 只更新单个包，而我们需要同步整个 monorepo 的所有包，包括生成 TypeScript 文件和更新 Expo 配置。

### Q: 版本号不一致怎么办？

A: 运行 `pnpm version:sync` 会将所有包同步到根目录的版本号。

### Q: 如何在发布前验证版本号？

A: 可以运行以下命令检查所有包的版本：

```bash
# 检查所有 package.json
find . -name "package.json" -not -path "*/node_modules/*" -exec grep -H "\"version\":" {} \;

# 检查 version.ts
cat packages/shared/src/version.ts

# 检查 app.json
cat packages/mobile/app.json | grep version
```

## 版本历史

- `0.1.0` (2024-03) - 初始版本
  - 多平台支持 (Web, Desktop, Mobile, CLI, TUI)
  - 基础 AI 功能
  - 工具系统
  - 技能系统

---

**维护者**: OpenBunny Team  
**最后更新**: 2024-03-05
