# ComposeBuilder AI 指导文件

禁止对AGENT.md进行修改

## 软件目的

通过图形化界面，简化用户制作docker-compose.yml文件的过程，做到鼠标点击就能生成合理的docker compose配置文件。

## 软件架构

1. 使用vue作为软件架构
2. 软件最终包装为composebuilder/composebuilder镜像并发布至dockerhub
3. 软件使用80端口
4. 软件对docker-compose.yml文件分为：镜像名称、容器名称、重启策略，网络网桥或端口，挂载卷或挂载目录，环境变量，健康检查

## 软件运行

1. 用户输入镜像名称，一个或多个，然后根据以下设置逐个完成镜像配置文件并合并；有多个镜像时，采用颜色标签方便用户区分
2. 容器名称取镜像开发者名称或镜像名，二选一，或用户自定义
3. 服务名称取容器名称
4. 重启策略选择
5. 网络网桥、端口，端口在443、80、3000至3100间选择或自定义，可选udp或tcp；或者使用网桥，使用网桥时需要有容器向外提供服务，该容器需要开放端口；或者使用host宿主机网络
6. 挂载卷名称取容器名称，或自定义，不推荐使用挂载卷；推荐使用挂载目录，采用“/srv/容器名称/data”，可选只读
7. 环境变量由用户自定义
8. 健康检查提供常见配置由用户选择，或放弃健康检查
9. 提供privilege模式选择，默认为关
10. 提供用户id和组id选择，默认为0:0

## 取名举例

1. “composebuilder/composebuilder”默认取composebuilder
2. “nginx:alpine”默认取nginx
3. “ghcr.io/bitwarden/mssql:latest”默认取mssql
4. “ghcr.io/bitwarden/nginx:latest”默认取nginx
