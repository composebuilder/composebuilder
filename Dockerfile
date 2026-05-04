# 运行镜像
FROM caddy:alpine

# 开发信息
LABEL github.repository="https://github.com/composebuilder/composebuilder"
LABEL maintainer="https://github.com/BlazeSnow"

# 复制静态产物
COPY dist /app

# 复制 Caddy 配置文件
COPY Caddyfile /etc/caddy/Caddyfile

# 暴露端口
EXPOSE 80
