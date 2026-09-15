# 人生支线 · SideQuest

一个鼓励现实体验、记录个人经历的响应式 Web/PWA 项目。已实现用户端核心闭环、内容运营基础和本地统计；使用方式见 [主要功能操作说明](docs/4.主要功能操作说明.md)，验收边界见 [验证记录](docs/validation/主要功能闭环验证.md)。首版不做远端统计上报，生产上线仍需独立验收。

## 本地开发

使用 Node.js `24.16.0` 和 pnpm `11.5.1`。

```sh
pnpm install --frozen-lockfile
pnpm dev:web
```

用户端默认地址为 `http://127.0.0.1:5173`。当前页面是工程占位，尚未提供随机、记录或成长功能。

内容端使用已有 PostgreSQL。将 `apps/content/.env.example` 的配置填入 `apps/content/.env`，然后运行：

```sh
pnpm dev:content
```

内容端默认地址为 `http://127.0.0.1:3000`，`/health` 仅检查进程存活，`/admin` 为运营后台。`CONTENT_SERVER_URL` 和 `WEB_ORIGIN` 必须与实际访问地址一致（`localhost` 和 `127.0.0.1` 是不同来源）。配置完成后 `pnpm dev` 可同时启动两端。

不会自动创建数据库或推送表结构。首次迁移已在提供的项目库中执行，`/admin` 已可显示首个管理员创建页面；请在本机设置自己的运营账号。新接入的空项目库需先审阅并执行 `pnpm db:migrate`。不要把占位环境值作为部署凭证。

更多命令、配置边界和验证范围见 [工程开发说明](docs/3.工程开发说明.md)。
