# npm 发布指南

## 可发布包

当前仓库里适合发布到 npm 的包：

- `@openbunny/shared`
- `@openbunny/ui-web`
- `@openbunny/cli`
- `@openbunny/tui`

以下包是应用而不是 npm 库，已标记为 `private`，不应发布：

- `@openbunny/web`
- `@openbunny/desktop`
- `@openbunny/mobile`
- `openbunny`（根目录）
- `openbunny-proxy`

## 发布前准备

1. 登录 npm 账号

```bash
npm login
npm whoami
```

2. 统一版本号

```bash
pnpm version:set 0.2.0
```

3. 本地构建

```bash
pnpm --filter @openbunny/shared build
pnpm --filter @openbunny/ui-web build
pnpm --filter @openbunny/cli build
pnpm --filter @openbunny/tui build
```

4. Dry run 验包内容

```bash
pnpm publish:npm:dry-run
```

## 正式发布

按依赖顺序发布，先发底层包，再发上层包：

```bash
pnpm publish:npm --access public
```

如果需要带标签发布，例如 `next`：

```bash
pnpm publish:npm --access public --tag next
```

## 发布顺序

发布脚本会按以下顺序执行：

1. `@openbunny/shared`
2. `@openbunny/ui-web`
3. `@openbunny/cli`
4. `@openbunny/tui`

这样可以保证依赖链上的包先出现在 npm registry 里。

## 注意事项

- 不要在子包目录里直接运行 `npm version`，这个仓库使用统一版本管理。
- 先运行 `pnpm publish:npm:dry-run`，确认打包内容正确再正式发布。
- 首次发布带 scope 的公开包时，正式发布需要带 `--access public`。
