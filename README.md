# ComposeBuilder

ComposeBuilder 是一个用于快速生成 `docker-compose.yml` 的前端工具。它提供图形化流程，帮助用户为多个镜像逐项配置容器名称、重启策略、端口映射或网桥、挂载卷/目录、环境变量与健康检查。

## 使用方式

1. 直接打开 `index.html` 即可使用（纯前端）。
2. 推荐在浏览器中配置完成后复制或下载 `docker-compose.yml`。

## 镜像发布约定

最终应用可打包为 `composebuilder/composebuilder` 并暴露 80 端口。

## 主要功能

- 输入一个或多个镜像名称并逐个配置
- 容器名称与服务名称自动同步
- 端口映射/网桥二选一
- 支持卷/目录挂载与环境变量编辑
- 内置常见健康检查模板

## 目录结构

- `index.html` - 应用入口
- `app.js` - Vue 逻辑
- `styles.css` - 视觉样式
