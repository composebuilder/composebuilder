# 构建镜像
FROM node:24-alpine AS build

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 安装依赖
RUN npm ci

# 构建应用
RUN npm run build

# 运行镜像
FROM caddy:alpine

# 开发信息
LABEL github.repository="https://github.com/composebuilder/composebuilder"
LABEL maintainer="https://github.com/BlazeSnow"

# 复制应用代码
COPY --from=build /app/dist /app

# 复制 Caddy 配置文件
COPY Caddyfile /etc/caddy/Caddyfile

# 暴露端口
EXPOSE 80
