<template>
  <div class="app">
    <header class="hero">
      <div class="hero__content">
        <p class="hero__eyebrow">ComposeBuilder</p>
        <h1>用图形化方式快速拼装你的 docker-compose.yml</h1>
        <p class="hero__subtitle">
          输入镜像，配置容器，立刻生成合并后的 Compose 配置文件。
        </p>
        <div class="hero__meta">
          <span>文档：<a href="https://www.blazesnow.com/composebuilder" target="_blank"
              rel="noopener noreferrer">https://www.blazesnow.com/composebuilder</a></span>
          <span>镜像：<a href="https://hub.docker.com/r/composebuilder/composebuilder" target="_blank"
              rel="noopener noreferrer">composebuilder/composebuilder</a></span>
          <span>前端架构：Vue 3</span>
          <span>当前版本：v2026.3.28.0</span>
        </div>
      </div>
      <div class="hero__art">
        <div class="orb orb--one"></div>
        <div class="orb orb--two"></div>
        <div class="orb orb--three"></div>
      </div>
    </header>

    <div class="layout">
      <div class="layout__left">
        <section class="panel panel--grid">
          <div class="panel__intro">
            <h2>镜像输入</h2>
            <p>支持一行一个镜像名称，或用逗号分隔。添加后可逐个配置。</p>
          </div>
          <div class="field">
            <label for="images">镜像名称</label>
            <textarea id="images" v-model="imageInput" placeholder="例如：nginx:latest, redis:7 或 mysql:8"></textarea>
          </div>
          <p class="hint">需要导入现有配置时，请直接编辑 YAML 并点击刷新按钮。</p>
          <div class="actions">
            <button class="button button--primary" @click="addImages">
              添加镜像
            </button>
            <button class="button button--ghost" @click="clearAll" :disabled="!services.length">
              清空全部
            </button>
          </div>
        </section>

        <section class="panel panel--wide">
          <div class="panel__intro">
            <h2>服务配置</h2>
            <p>逐个完善容器名称、端口、挂载、环境变量与健康检查。</p>
          </div>

          <div v-if="!services.length" class="empty">
            还没有服务，先在上方添加镜像。
          </div>

          <div v-for="service in services" :key="service.id" class="service-card"
            :style="{ borderLeftColor: service.color }" @mouseenter="setActiveService(service.id, $event)"
            @mouseleave="clearActiveService(service.id)" @focusin="setActiveService(service.id, $event)">
            <div class="service-card__header">
              <div>
                <div class="service-card__title">
                  <span class="color-tag" :style="{ background: service.color }"></span>
                  <h3 class="image-scroll" :class="{ 'image-scroll--auto': service.imageOverflow }"
                    :ref="(el) => setImageRef(service.id, el)">
                    <span v-if="service.imageOverflow">{{ service.image }} · {{ service.image }}</span>
                    <span v-else>{{ service.image }}</span>
                  </h3>
                </div>
                <p>服务名称：{{ service.serviceName || '待生成' }}</p>
              </div>
              <button class="button button--danger" @click="removeService(service.id)">
                移除
              </button>
            </div>

            <div class="grid">
              <div class="field">
                <label>容器名称来源</label>
                <select v-model="service.containerNameMode" @change="applyContainerNameMode(service)">
                  <option value="developer">镜像开发者</option>
                  <option value="image">镜像名称</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div class="field">
                <label>容器名称</label>
                <input v-model.trim="service.containerName" :disabled="service.containerNameMode !== 'custom'"
                  @input="syncServiceName(service)" />
              </div>
              <div class="field">
                <label>服务名称（自动同步）</label>
                <input v-model="service.serviceName" disabled />
              </div>
              <div class="field">
                <label>重启策略</label>
                <select v-model="service.restart">
                  <option value="no">不自动重启</option>
                  <option value="always">always</option>
                  <option value="on-failure">on-failure</option>
                  <option value="unless-stopped">unless-stopped</option>
                </select>
              </div>
              <div class="field">
                <label>网络模式</label>
                <select v-model="service.networkMode" @change="onNetworkModeChange(service)">
                  <option value="ports">端口映射</option>
                  <option value="bridge">网桥 (bridge)</option>
                  <option value="host">宿主机 (host)</option>
                </select>
              </div>
              <div class="field">
                <label>特权模式</label>
                <select v-model="service.privileged">
                  <option :value="false">关闭</option>
                  <option :value="true">开启</option>
                </select>
              </div>
              <div class="field">
                <label>用户 ID</label>
                <input type="number" min="0" v-model.number="service.userId"
                  @input="normalizeUserId(service, 'userId', $event)" />
              </div>
              <div class="field">
                <label>组 ID</label>
                <input type="number" min="0" v-model.number="service.groupId"
                  @input="normalizeUserId(service, 'groupId', $event)" />
              </div>
            </div>

            <div class="subpanel" v-if="service.networkMode !== 'host'">
              <div class="subpanel__header">
                <h4>端口映射</h4>
                <div class="actions">
                  <button class="chip" @click="addPresetPort(service, 80)" :disabled="hasPort(service, 80)">
                    +80
                  </button>
                  <button class="chip" @click="addPresetPort(service, 443)" :disabled="hasPort(service, 443)">
                    +443
                  </button>
                  <div class="chip-group">
                    <span class="chip-label">连续端口</span>
                    <button v-if="nextSequentialPort(service)" class="chip"
                      @click="addPresetPort(service, nextSequentialPort(service))">
                      +{{ nextSequentialPort(service) }}
                    </button>
                    <span v-else class="chip-label">已到 3100</span>
                  </div>
                </div>
              </div>
              <div v-for="(port, idx) in service.ports" :key="port.id" class="grid grid--ports">
                <div class="field">
                  <label>宿主机端口</label>
                  <input type="number" min="1" max="65535" v-model.number="port.host" />
                </div>
                <div class="field">
                  <label>容器端口</label>
                  <input type="number" min="1" max="65535" v-model.number="port.container" />
                </div>
                <div class="field">
                  <label>协议</label>
                  <select v-model="port.protocol">
                    <option value="tcp">tcp</option>
                    <option value="udp">udp</option>
                  </select>
                </div>
                <button class="button button--ghost" @click="removePort(service, idx)">删除</button>
              </div>
              <button class="button button--ghost" @click="addPort(service)">添加端口</button>
              <p class="hint">可选范围推荐：80、443、3000-3100，也支持自定义。</p>
              <p class="hint" v-if="service.networkMode === 'bridge' && !service.ports.length">
                使用网桥时，需要有容器对外提供服务，请确保开放端口。
              </p>
            </div>
            <p class="hint" v-if="service.networkMode === 'host'">
              使用宿主机网络时无需端口映射，容器将直接使用宿主机网络栈。
            </p>

            <div class="subpanel">
              <div class="subpanel__header">
                <h4>挂载卷 / 目录</h4>
              </div>
              <div v-for="(vol, idx) in service.volumes" :key="vol.id" class="grid grid--vols">
                <div class="field">
                  <label>类型</label>
                  <select v-model="vol.kind" @change="syncVolumeDefaults(service, vol)">
                    <option value="bind">目录挂载</option>
                    <option value="volume">命名卷</option>
                  </select>
                </div>
                <div class="field">
                  <label>{{ vol.kind === 'bind' ? '宿主机目录' : '卷名称' }}</label>
                  <input v-model.trim="vol.source" @input="normalizeVolumeSource(vol, $event)" />
                </div>
                <div class="field">
                  <label>容器目录</label>
                  <input v-model.trim="vol.target" />
                </div>
                <div class="field">
                  <label>只读</label>
                  <select v-model="vol.readOnly">
                    <option :value="false">否</option>
                    <option :value="true">是</option>
                  </select>
                </div>
                <button class="button button--ghost" @click="removeVolume(service, idx)">删除</button>
              </div>
              <button class="button button--ghost" @click="addVolume(service)">添加挂载</button>
              <p class="hint">
                推荐目录：/srv/{{ service.containerName || '容器名称' }}/data
              </p>
              <p class="hint">不推荐使用挂载卷，优先考虑挂载目录。</p>
            </div>

            <div class="subpanel">
              <div class="subpanel__header">
                <h4>环境变量</h4>
              </div>
              <div v-for="(env, idx) in service.env" :key="env.id" class="grid grid--env">
                <div class="field">
                  <label>键</label>
                  <input v-model.trim="env.key" />
                </div>
                <div class="field">
                  <label>值</label>
                  <input v-model.trim="env.value" @input="clearEnvNull(env)" />
                </div>
                <button class="button button--ghost" @click="removeEnv(service, idx)">删除</button>
              </div>
              <button class="button button--ghost" @click="addEnv(service)">添加环境变量</button>
            </div>

            <div class="subpanel">
              <div class="subpanel__header">
                <h4>服务依赖</h4>
              </div>
              <div class="field">
                <label>depends_on（仅显示已配置健康检查的服务）</label>
                <div class="checkbox-list" v-if="availableDependsOn(service).length">
                  <label class="checkbox-item" v-for="dep in availableDependsOn(service)" :key="dep.id">
                    <input type="checkbox" :checked="service.dependsOn.includes(dep.serviceName || dep.containerName)"
                      @change="toggleDependsOn(service, dep.serviceName || dep.containerName)" />
                    <span>{{ dep.serviceName || dep.containerName }}</span>
                  </label>
                </div>
                <p class="hint" v-else>暂无已配置健康检查的服务可选。</p>
              </div>
            </div>

            <div class="subpanel">
              <div class="subpanel__header">
                <h4>启动命令</h4>
              </div>
              <div class="field">
                <label>command</label>
                <input v-model.trim="service.command" @input="onCommandInput(service)"
                  placeholder="例如：nginx -g 'daemon off;'" />
              </div>
              <p class="hint">command 可为空，将不写入配置。</p>
            </div>

            <div class="subpanel">
              <div class="subpanel__header">
                <h4>健康检查</h4>
              </div>
              <div class="grid">
                <div class="field">
                  <label>类型</label>
                  <select v-model="service.health.type">
                    <option value="none">不启用</option>
                    <option value="http">HTTP</option>
                    <option value="tcp">TCP</option>
                    <option value="cmd">自定义命令</option>
                  </select>
                </div>
                <div class="field" v-if="service.health.type !== 'none' && service.health.type !== 'cmd'">
                  <label>端口</label>
                  <input type="number" min="1" max="65535" v-model.number="service.health.port" />
                </div>
                <div class="field" v-if="service.health.type === 'cmd'">
                  <label>命令</label>
                  <input v-model.trim="service.health.cmd" placeholder="例如：curl -f http://localhost:8080" />
                </div>
                <div class="field">
                  <label>间隔</label>
                  <input v-model.trim="service.health.interval" placeholder="30s" />
                </div>
                <div class="field">
                  <label>超时</label>
                  <input v-model.trim="service.health.timeout" placeholder="5s" />
                </div>
                <div class="field">
                  <label>重试次数</label>
                  <input type="number" min="1" v-model.number="service.health.retries" />
                </div>
                <div class="field">
                  <label>启动宽限期</label>
                  <input v-model.trim="service.health.startPeriod" placeholder="10s" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="layout__right">
        <section class="panel panel--wide yaml-panel">
          <div class="panel__intro">
            <h2>YAML 展示区</h2>
            <p>右侧可直接编辑，点击刷新后同步到左侧。</p>
          </div>
          <div class="compose-output">
            <div class="compose-editor">
              <div class="line-numbers" ref="lineNumbers" :style="lineNumberStyle">
                <div class="line-numbers__inner" :style="{ transform: `translateY(-${lineScrollTop}px)` }">
                  <span v-for="line in lineNumbers" :key="line">{{ line }}</span>
                </div>
              </div>
              <textarea ref="yamlArea" v-model="composeYamlText" @input="markYamlDirty" @scroll="syncLineScroll"
                wrap="off"></textarea>
            </div>
          </div>
          <div class="actions">
            <button class="button button--primary" @click="importFromYamlText" :disabled="!composeYamlText">
              刷新
            </button>
            <button class="button button--ghost" @click="downloadYaml" :disabled="!composeYamlText">
              下载 YAML
            </button>
          </div>
        </section>

        <section class="panel panel--wide panel--compact editor-panel" v-if="activeService">
          <h3 class="image-scroll" :class="{ 'image-scroll--auto': activeImageOverflow }" :ref="setActiveImageRef">
            <span v-if="activeImageOverflow">
              正在编辑：{{ activeService.serviceName || '待生成' }} · 正在编辑：{{ activeService.serviceName || '待生成' }}
            </span>
            <span v-else>正在编辑：{{ activeService.serviceName || '待生成' }}</span>
          </h3>
        </section>
      </div>
    </div>

    <footer class="footer">
      <p>
        <a href="https://github.com/composebuilder/composebuilder" target="_blank" rel="noopener noreferrer">
          ComposeBuilder
        </a> - 让 compose 配置更直观。
      </p>
      <p>
        本产品以
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noreferrer">
          GNU Affero General Public License v3.0
        </a>
        的条款发布。
      </p>
      <p>Copyright © 2026 <a href="https://github.com/BlazeSnow" target="_blank"
          rel="noopener noreferrer">BlazeSnow</a>.
        保留所有权利。</p>
    </footer>
  </div>
</template>

<script>
import { load as yamlLoad } from "js-yaml";

const imageBaseName = (image) => {
  const imageText = String(image || "");
  const slashIndex = imageText.lastIndexOf("/");
  const colonIndex = imageText.lastIndexOf(":");
  const hasTag = colonIndex > slashIndex;
  const noTag = hasTag ? imageText.slice(0, colonIndex) : imageText;
  const parts = noTag.split("/");
  return parts[parts.length - 1] || noTag;
};

const imageDeveloperName = (image) => {
  const imageText = String(image || "");
  const slashIndex = imageText.lastIndexOf("/");
  const colonIndex = imageText.lastIndexOf(":");
  const hasTag = colonIndex > slashIndex;
  const noTag = hasTag ? imageText.slice(0, colonIndex) : imageText;
  const parts = noTag.split("/");
  if (parts.length > 1) {
    const first = parts[0];
    const hasRegistry =
      first.includes(".") || first.includes(":") || first === "localhost";
    if (hasRegistry && parts[1]) return parts[1];
    if (!hasRegistry && first) return first;
  }
  return imageBaseName(image);
};

const defaultVolumePath = (containerName) =>
  containerName ? `/srv/${containerName}/data` : "/srv/container/data";

const normalizeWindowsPath = (value) => {
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return value.replace(/\\/g, "/");
  }
  return value;
};

const sanitizeYamlWindowsPaths = (text) => {
  return text.replace(/[A-Za-z]:\\[^"\r\n']*/g, (match) => match.replace(/\\/g, "/"));
};

const colorPalette = [
  "#c45a1a",
  "#247c8a",
  "#b63b29",
  "#6d5a8d",
  "#2f7d59",
  "#b88b2c",
];

const deriveContainerName = (mode, image, currentValue) => {
  if (mode === "developer") {
    return imageDeveloperName(image);
  }
  if (mode === "image") return imageBaseName(image);
  return currentValue || imageBaseName(image);
};

const newService = (image) => {
  const containerNameMode = "developer";
  const containerName = deriveContainerName(containerNameMode, image, "");
  return {
    id: crypto.randomUUID(),
    image,
    containerName,
    containerNameMode,
    serviceName: containerName,
    color: "",
    restart: "unless-stopped",
    networkMode: "ports",
    rawNetworkMode: "",
    ports: [
      {
        id: crypto.randomUUID(),
        host: 80,
        container: 80,
        protocol: "tcp",
      },
    ],
    volumes: [
      {
        id: crypto.randomUUID(),
        kind: "bind",
        source: defaultVolumePath(containerName),
        target: "/data",
        readOnly: false,
      },
    ],
    env: [],
    dependsOn: [],
    dependsOnConfig: {},
    command: "",
    commandList: [],
    rawBuild: null,
    health: {
      type: "none",
      port: 80,
      cmd: "",
      interval: "30s",
      timeout: "5s",
      retries: 3,
      startPeriod: "10s",
    },
    privileged: false,
    userId: null,
    groupId: null,
  };
};

export default {
  data() {
    return {
      imageInput: "",
      services: [],
      composeYaml: "",
      activeServiceId: null,
      composeYamlText: "",
      yamlDirty: false,
      lineNumberStyle: {},
      lineScrollTop: 0,
      imageRefs: {},
      activeImageRef: null,
      activeImageOverflow: false,
    };
  },
  computed: {
    activeService() {
      return this.services.find((service) => service.id === this.activeServiceId) || null;
    },
    lineNumbers() {
      const lines = this.composeYamlText ? this.composeYamlText.split("\n").length : 1;
      return Array.from({ length: lines }, (_, idx) => idx + 1);
    },
  },
  watch: {
    services: {
      deep: true,
      handler() {
        this.composeYaml = this.generateCompose();
        if (!this.yamlDirty) {
          this.composeYamlText = this.composeYaml;
        }
        this.$nextTick(() => this.updateImageOverflow());
      },
    },
  },
  mounted() {
    this.composeYaml = this.generateCompose();
    this.composeYamlText = this.composeYaml;
    this.$nextTick(() => this.updateLineNumberSize());
    window.addEventListener("resize", this.updateLineNumberSize);
    window.addEventListener("resize", this.updateImageOverflow);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.updateLineNumberSize);
    window.removeEventListener("resize", this.updateImageOverflow);
  },
  methods: {
    hasPort(service, port) {
      return service.ports.some((item) => Number(item.host) === Number(port));
    },
    nextSequentialPort(service) {
      for (let port = 3000; port <= 3100; port += 1) {
        if (!this.hasPort(service, port)) return port;
      }
      return null;
    },
    addImages() {
      const raw = this.imageInput
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      raw.forEach((image, index) => {
        const service = newService(image);
        const paletteIndex = (this.services.length + index) % colorPalette.length;
        service.color = colorPalette[paletteIndex];
        service.imageOverflow = false;
        this.services.push(service);
      });
      this.imageInput = "";
      this.$nextTick(() => this.updateImageOverflow());
    },
    clearAll() {
      this.services = [];
      this.composeYaml = "";
      this.composeYamlText = "";
      this.yamlDirty = false;
    },
    removeService(id) {
      this.services = this.services.filter((service) => service.id !== id);
      if (this.activeServiceId === id) {
        this.activeServiceId = null;
      }
      delete this.imageRefs[id];
    },
    setImageRef(id, el) {
      if (el) {
        this.imageRefs[id] = el;
      } else {
        delete this.imageRefs[id];
      }
    },
    setActiveImageRef(el) {
      this.activeImageRef = el;
      this.$nextTick(() => this.updateImageOverflow());
    },
    updateImageOverflow() {
      this.services.forEach((service) => {
        const el = this.imageRefs[service.id];
        if (!el) return;
        service.imageOverflow = el.scrollWidth > el.clientWidth;
      });
      if (this.activeImageRef) {
        this.activeImageOverflow =
          this.activeImageRef.scrollWidth > this.activeImageRef.clientWidth;
      } else {
        this.activeImageOverflow = false;
      }
    },
    setActiveService(id) {
      this.activeServiceId = id;
      this.$nextTick(() => this.updateImageOverflow());
    },
    clearActiveService(id) {
      if (this.activeServiceId === id) {
        this.activeServiceId = null;
      }
    },
    applyContainerNameMode(service) {
      service.containerName = deriveContainerName(
        service.containerNameMode,
        service.image,
        service.containerName
      );
      this.syncServiceName(service);
      service.volumes.forEach((vol) => {
        if (vol.kind === "bind" && vol.source.startsWith("/srv/")) {
          vol.source = defaultVolumePath(service.containerName);
        }
        if (vol.kind === "volume" && (!vol.source || vol.source === imageBaseName(service.image))) {
          vol.source = service.containerName;
        }
      });
    },
    syncServiceName(service) {
      service.serviceName = service.containerName || imageBaseName(service.image);
    },
    normalizeVolumeSource(volume, event) {
      const raw = event?.target?.value ?? volume.source ?? "";
      volume.source = normalizeWindowsPath(raw);
    },
    normalizeUserId(service, key, event) {
      const raw = event?.target?.value ?? "";
      if (raw === "") {
        service[key] = null;
        return;
      }
      const parsed = Number(raw);
      service[key] = Number.isFinite(parsed) ? parsed : null;
    },
    availableDependsOn(service) {
      return this.services.filter(
        (item) => item.id !== service.id && item.health?.type && item.health.type !== "none"
      );
    },
    toggleDependsOn(service, name) {
      if (!service.dependsOnConfig || typeof service.dependsOnConfig !== "object") {
        service.dependsOnConfig = {};
      }
      if (service.dependsOn.includes(name)) {
        service.dependsOn = service.dependsOn.filter((item) => item !== name);
        delete service.dependsOnConfig[name];
      } else {
        service.dependsOn = [...service.dependsOn, name];
      }
    },
    addPort(service) {
      service.ports.push({
        id: crypto.randomUUID(),
        hostIp: "",
        host: 3000,
        container: 3000,
        protocol: "tcp",
      });
    },
    addPresetPort(service, port) {
      if (this.hasPort(service, port)) return;
      service.ports.push({
        id: crypto.randomUUID(),
        hostIp: "",
        host: port,
        container: port,
        protocol: "tcp",
      });
      service.health.port = port;
    },
    removePort(service, idx) {
      service.ports.splice(idx, 1);
    },
    addVolume(service) {
      service.volumes.push({
        id: crypto.randomUUID(),
        kind: "bind",
        source: defaultVolumePath(service.containerName),
        target: "/data",
        readOnly: false,
      });
    },
    removeVolume(service, idx) {
      service.volumes.splice(idx, 1);
    },
    syncVolumeDefaults(service, volume) {
      if (volume.kind === "bind") {
        volume.source = defaultVolumePath(service.containerName);
      }
      if (volume.kind === "volume") {
        volume.source = service.containerName || imageBaseName(service.image);
      }
    },
    addEnv(service) {
      service.env.push({
        id: crypto.randomUUID(),
        key: "",
        value: "",
        isNull: false,
      });
    },
    removeEnv(service, idx) {
      service.env.splice(idx, 1);
    },
    clearEnvNull(env) {
      env.isNull = false;
    },
    onNetworkModeChange(service) {
      service.rawNetworkMode = "";
    },
    onCommandInput(service) {
      service.commandList = [];
    },
    parsePortMapping(mapping) {
      const [mappingPart, protocolPart] = mapping.split("/");
      const protocol = protocolPart || "tcp";
      let hostIp = "";
      let host = "";
      let container = "";
      if (mappingPart.startsWith("[")) {
        const endBracket = mappingPart.indexOf("]");
        if (endBracket > 0) {
          hostIp = mappingPart.slice(1, endBracket);
          const rest = mappingPart.slice(endBracket + 1);
          if (rest.startsWith(":")) {
            const restParts = rest.slice(1).split(":");
            if (restParts.length >= 2) {
              host = restParts[0];
              container = restParts[1];
            }
          }
        }
      } else {
        const parts = mappingPart.split(":");
        if (parts.length >= 3) {
          hostIp = parts.slice(0, parts.length - 2).join(":");
          host = parts[parts.length - 2];
          container = parts[parts.length - 1];
        } else if (parts.length === 2) {
          host = parts[0];
          container = parts[1];
        } else if (parts.length === 1) {
          container = parts[0];
        }
      }
      return {
        id: crypto.randomUUID(),
        hostIp,
        host: Number(host) || host,
        container: Number(container) || container,
        protocol,
      };
    },
    parsePortEntry(entry) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const hostIp = entry.host_ip ? String(entry.host_ip) : "";
        const host = entry.published !== undefined && entry.published !== null ? Number(entry.published) || String(entry.published) : "";
        const container = entry.target !== undefined && entry.target !== null ? Number(entry.target) || String(entry.target) : "";
        const protocol = entry.protocol ? String(entry.protocol) : "tcp";
        return {
          id: crypto.randomUUID(),
          hostIp,
          host,
          container,
          protocol,
        };
      }
      return this.parsePortMapping(String(entry));
    },
    parseVolumeMapping(mapping, fallbackName) {
      let readOnly = false;
      let normalized = mapping;
      if (normalized.endsWith(":ro")) {
        readOnly = true;
        normalized = normalized.slice(0, -3);
      }
      normalized = normalizeWindowsPath(normalized);
      let source = "";
      let target = "";
      if (/^[A-Za-z]:[\\/]/.test(normalized)) {
        const firstColon = normalized.indexOf(":");
        const lastColon = normalized.lastIndexOf(":");
        if (lastColon > firstColon) {
          source = normalized.slice(0, lastColon);
          target = normalized.slice(lastColon + 1);
        } else {
          target = normalized;
          source = `${fallbackName}-data`;
        }
      } else {
        const parts = normalized.split(":");
        if (parts.length >= 2) {
          source = parts[0];
          target = parts[1];
        } else if (parts.length === 1) {
          target = parts[0];
          source = `${fallbackName}-data`;
        }
      }
      const isBind =
        source.startsWith("/") ||
        source.startsWith("./") ||
        source.startsWith("../") ||
        source.startsWith("~") ||
        /^[A-Za-z]:\//.test(source);
      return {
        id: crypto.randomUUID(),
        kind: isBind ? "bind" : "volume",
        source,
        target,
        readOnly,
      };
    },
    parseVolumeEntry(entry, fallbackName) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const readOnly = Boolean(entry.read_only);
        const target = entry.target !== undefined && entry.target !== null ? String(entry.target) : "";
        let source = entry.source !== undefined && entry.source !== null ? String(entry.source) : "";
        source = normalizeWindowsPath(source);
        let kind = "volume";
        if (entry.type === "bind") {
          kind = "bind";
        } else if (entry.type === "volume") {
          kind = "volume";
        } else if (source) {
          kind =
            source.startsWith("/") ||
            source.startsWith("./") ||
            source.startsWith("../") ||
            source.startsWith("~") ||
            /^[A-Za-z]:\//.test(source)
              ? "bind"
              : "volume";
        }
        return {
          id: crypto.randomUUID(),
          kind,
          source,
          target,
          readOnly,
        };
      }
      return this.parseVolumeMapping(String(entry), fallbackName);
    },
    parseHealthcheck(health) {
      if (!health || !health.test) return null;
      let cmd = "";
      if (Array.isArray(health.test)) {
        if (String(health.test[0] || "").toUpperCase() === "NONE") {
          return {
            type: "none",
            port: 80,
            cmd: "",
            interval: health.interval || "30s",
            timeout: health.timeout || "5s",
            retries: Number(health.retries) || 3,
            startPeriod: health.start_period || "10s",
          };
        }
        if (health.test[0] === "CMD-SHELL") {
          cmd = health.test[1] || "";
        } else {
          cmd = health.test.slice(1).join(" ");
        }
      } else if (typeof health.test === "string") {
        cmd = health.test;
      }
      const httpMatch = cmd.match(/curl\s+-f\s+http:\/\/localhost:(\d+)/i);
      const tcpMatch = cmd.match(/nc\s+-z\s+localhost\s+(\d+)/i);
      const type = httpMatch ? "http" : tcpMatch ? "tcp" : "cmd";
      return {
        type,
        port: Number(httpMatch?.[1] || tcpMatch?.[1] || 80),
        cmd,
        interval: health.interval || "30s",
        timeout: health.timeout || "5s",
        retries: Number(health.retries) || 3,
        startPeriod: health.start_period || "10s",
      };
    },
    parseDependsOn(dependsOn) {
      if (Array.isArray(dependsOn)) {
        return {
          names: dependsOn.map((name) => String(name)),
          config: {},
        };
      }
      if (dependsOn && typeof dependsOn === "object") {
        const names = Object.keys(dependsOn);
        const config = {};
        names.forEach((name) => {
          const value = dependsOn[name];
          if (value && typeof value === "object" && !Array.isArray(value)) {
            config[name] = { ...value };
          }
        });
        return { names, config };
      }
      return { names: [], config: {} };
    },
    applyImportedServices(doc) {
      const services = doc?.services || {};
      const entries = Object.entries(services);
      const nextServices = [];
      entries.forEach(([serviceName, svc], index) => {
        const image = svc.image || "";
        const containerName = svc.container_name || serviceName || imageBaseName(image);
        const service = newService(image);
        service.containerNameMode = "custom";
        service.containerName = containerName;
        service.serviceName = serviceName || containerName;
        service.color = colorPalette[index % colorPalette.length];
        service.restart = this.normalizeRestartValue(svc.restart);
        const importedNetworkMode = typeof svc.network_mode === "string" ? svc.network_mode : "";
        if (importedNetworkMode === "bridge" || importedNetworkMode === "host") {
          service.networkMode = importedNetworkMode;
          service.rawNetworkMode = "";
        } else if (importedNetworkMode) {
          service.networkMode = "ports";
          service.rawNetworkMode = importedNetworkMode;
        } else {
          service.networkMode = "ports";
          service.rawNetworkMode = "";
        }
        service.rawBuild = svc.build !== undefined ? svc.build : null;
        service.ports = Array.isArray(svc.ports)
          ? svc.ports.map((p) => this.parsePortEntry(p))
          : [];
        service.volumes = Array.isArray(svc.volumes)
          ? svc.volumes.map((v) => this.parseVolumeEntry(v, containerName))
          : [];
        const envList = [];
        if (Array.isArray(svc.environment)) {
          svc.environment.forEach((item) => {
            const raw = String(item);
            const splitIndex = raw.indexOf("=");
            const key = splitIndex >= 0 ? raw.slice(0, splitIndex) : raw;
            const value = splitIndex >= 0 ? raw.slice(splitIndex + 1) : "";
            envList.push({ id: crypto.randomUUID(), key, value, isNull: false });
          });
        } else if (svc.environment && typeof svc.environment === "object") {
          Object.entries(svc.environment).forEach(([key, value]) => {
            envList.push({
              id: crypto.randomUUID(),
              key,
              value: value === null || value === undefined ? "" : String(value),
              isNull: value === null || value === undefined,
            });
          });
        }
        service.env = envList;
        const parsedHealth = this.parseHealthcheck(svc.healthcheck);
        if (parsedHealth) {
          service.health = parsedHealth;
        }
        service.privileged = Boolean(svc.privileged);
        if (typeof svc.user === "string" && svc.user.includes(":")) {
          const [uid, gid] = svc.user.split(":");
          service.userId = Number(uid) || 0;
          service.groupId = Number(gid) || 0;
        } else if (typeof svc.user === "string" && /^\d+$/.test(svc.user.trim())) {
          service.userId = Number(svc.user.trim());
          service.groupId = 0;
        } else if (typeof svc.user === "number") {
          service.userId = svc.user;
          service.groupId = 0;
        }
        if (Array.isArray(svc.command)) {
          service.commandList = svc.command.map((item) => String(item));
          service.command = "";
        } else {
          service.command = svc.command ? String(svc.command) : "";
          service.commandList = [];
        }
        const dependsOn = this.parseDependsOn(svc.depends_on);
        service.dependsOn = dependsOn.names;
        service.dependsOnConfig = dependsOn.config;
        nextServices.push(service);
      });
      this.services = nextServices;
    },
    formatYamlScalar(value) {
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      const text = String(value ?? "");
      if (/^[A-Za-z0-9_.-]+$/.test(text)) return text;
      return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    },
    formatYamlDoubleQuoted(value) {
      const text = String(value ?? "");
      return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    },
    formatYamlKey(value) {
      const text = String(value ?? "");
      if (/^[A-Za-z0-9_.-]+$/.test(text)) return text;
      return this.formatYamlDoubleQuoted(text);
    },
    normalizeRestartValue(value) {
      if (typeof value !== "string") return "";
      const text = value.trim();
      if (!text) return "";
      if (text === "no" || text === "always" || text === "unless-stopped") return text;
      if (/^on-failure(?::\d+)?$/.test(text)) return text;
      return "";
    },
    appendYamlNode(lines, indent, value) {
      const pad = " ".repeat(indent);
      if (Array.isArray(value)) {
        if (!value.length) {
          lines.push(`${pad}[]`);
          return;
        }
        value.forEach((item) => {
          if (item !== null && typeof item === "object") {
            lines.push(`${pad}-`);
            this.appendYamlNode(lines, indent + 2, item);
          } else {
            lines.push(`${pad}- ${this.formatYamlScalar(item)}`);
          }
        });
        return;
      }
      if (value !== null && typeof value === "object") {
        const entries = Object.entries(value);
        if (!entries.length) {
          lines.push(`${pad}{}`);
          return;
        }
        entries.forEach(([key, nested]) => {
          if (nested !== null && typeof nested === "object") {
            lines.push(`${pad}${this.formatYamlKey(key)}:`);
            this.appendYamlNode(lines, indent + 2, nested);
          } else {
            lines.push(`${pad}${this.formatYamlKey(key)}: ${this.formatYamlScalar(nested)}`);
          }
        });
        return;
      }
      lines.push(`${pad}${this.formatYamlScalar(value)}`);
    },
    importFromYamlText() {
      if (!this.composeYamlText.trim()) return;
      try {
        const cleaned = sanitizeYamlWindowsPaths(this.composeYamlText);
        if (cleaned !== this.composeYamlText) {
          this.composeYamlText = cleaned;
        }
        const doc = yamlLoad(cleaned);
        this.applyImportedServices(doc);
        this.yamlDirty = false;
        this.composeYaml = this.generateCompose();
        this.composeYamlText = this.composeYaml;
        this.$nextTick(() => this.updateImageOverflow());
      } catch (error) {
        console.error(error);
        alert("导入失败，请检查 YAML 格式是否正确。");
      }
    },
    resetYamlText() {
      this.composeYamlText = this.composeYaml;
      this.yamlDirty = false;
    },
    markYamlDirty() {
      this.yamlDirty = true;
      this.$nextTick(() => this.updateLineNumberSize());
    },
    syncLineScroll(event) {
      this.lineScrollTop = event.target.scrollTop;
    },
    updateLineNumberSize() {
      const area = this.$refs.yamlArea;
      if (!area) return;
      const height = `${area.clientHeight}px`;
      this.lineNumberStyle = { height };
    },
    buildHealthcheck(service) {
      const health = service.health;
      if (health.type === "none") return null;
      let cmd = health.cmd;
      if (health.type === "http") {
        cmd = `curl -f http://localhost:${health.port} || exit 1`;
      } else if (health.type === "tcp") {
        cmd = `nc -z localhost ${health.port} || exit 1`;
      }
      if (!String(cmd || "").trim()) return null;
      return {
        test: ["CMD-SHELL", cmd],
        interval: health.interval || "30s",
        timeout: health.timeout || "5s",
        retries: Number(health.retries) || 3,
        start_period: health.startPeriod || "10s",
      };
    },
    generateCompose() {
      if (!this.services.length) return "";
      const lines = [];
      lines.push('version: "3.8"');
      lines.push("services:");
      const volumeNames = new Set();

      this.services.forEach((service) => {
        const name = service.serviceName || service.containerName || imageBaseName(service.image);
        lines.push(`  ${this.formatYamlKey(name)}:`);
        if (service.image) {
          lines.push(`    image: ${this.formatYamlDoubleQuoted(service.image)}`);
        }
        if (service.rawBuild !== null && service.rawBuild !== undefined) {
          if (service.rawBuild !== null && typeof service.rawBuild === "object") {
            lines.push("    build:");
            this.appendYamlNode(lines, 6, service.rawBuild);
          } else {
            lines.push(`    build: ${this.formatYamlScalar(service.rawBuild)}`);
          }
        }
        if (service.containerName) {
          lines.push(`    container_name: ${this.formatYamlDoubleQuoted(service.containerName)}`);
        }
        const restartValue = this.normalizeRestartValue(service.restart);
        if (restartValue) {
          lines.push(`    restart: ${restartValue}`);
        }
        if (service.networkMode === "bridge") {
          lines.push("    network_mode: bridge");
        } else if (service.networkMode === "host") {
          lines.push("    network_mode: host");
        } else if (service.rawNetworkMode) {
          lines.push(`    network_mode: ${this.formatYamlScalar(service.rawNetworkMode)}`);
        }
        if (service.networkMode === "ports" && !service.rawNetworkMode && service.ports.length) {
          const validPorts = service.ports.filter((port) => port.container);
          if (validPorts.length) {
            lines.push("    ports:");
            validPorts.forEach((port) => {
              const suffix = port.protocol && port.protocol !== "tcp" ? `/${port.protocol}` : "";
              const rawHostIp = port.hostIp || "";
              const hostIp =
                rawHostIp && rawHostIp.includes(":") && !rawHostIp.startsWith("[")
                  ? `[${rawHostIp}]`
                  : rawHostIp;
              const hasHostPort = port.host !== "" && port.host !== null && port.host !== undefined;
              const hostPart = hasHostPort ? `${port.host}:` : "";
              const ipPart = hasHostPort && hostIp ? `${hostIp}:` : "";
              lines.push(`      - "${ipPart}${hostPart}${port.container}${suffix}"`);
            });
          }
        }
        if (service.volumes.length) {
          const validVolumes = service.volumes.filter((vol) => vol.target);
          if (validVolumes.length) {
            lines.push("    volumes:");
            validVolumes.forEach((vol) => {
              const mode = vol.readOnly ? ":ro" : "";
              if (vol.kind === "volume") {
                if (vol.source) {
                  volumeNames.add(vol.source);
                  lines.push(`      - "${vol.source}:${vol.target}${mode}"`);
                } else {
                  lines.push(`      - "${vol.target}${mode}"`);
                }
              } else {
                const source = normalizeWindowsPath(vol.source);
                if (!source) return;
                lines.push(`      - "${source}:${vol.target}${mode}"`);
              }
            });
          }
        }
        const deps = Array.isArray(service.dependsOn) ? service.dependsOn : [];
        if (deps.length) {
          const validDeps = deps.filter((dep) =>
            this.services.some((svc) => (svc.serviceName || svc.containerName) === dep)
          );
          if (validDeps.length) {
            const depConfig =
              service.dependsOnConfig && typeof service.dependsOnConfig === "object"
                ? service.dependsOnConfig
                : {};
            const hasObjectDepends = validDeps.some((dep) => {
              const cfg = depConfig[dep];
              return cfg && typeof cfg === "object" && !Array.isArray(cfg) && Object.keys(cfg).length;
            });
            lines.push("    depends_on:");
            if (hasObjectDepends) {
              validDeps.forEach((dep) => {
                const cfg = depConfig[dep];
                if (cfg && typeof cfg === "object" && !Array.isArray(cfg) && Object.keys(cfg).length) {
                  lines.push(`      ${this.formatYamlKey(dep)}:`);
                  Object.entries(cfg).forEach(([key, value]) => {
                    lines.push(`        ${this.formatYamlKey(key)}: ${this.formatYamlScalar(value)}`);
                  });
                } else {
                  lines.push(`      ${this.formatYamlKey(dep)}: {}`);
                }
              });
            } else {
              validDeps.forEach((dep) => lines.push(`      - ${this.formatYamlDoubleQuoted(dep)}`));
            }
          }
        }
        if (service.command && service.command.trim()) {
          lines.push(`    command: ${this.formatYamlDoubleQuoted(service.command.trim())}`);
        } else if (Array.isArray(service.commandList) && service.commandList.length) {
          const list = service.commandList.map((item) => this.formatYamlDoubleQuoted(item)).join(", ");
          lines.push(`    command: [${list}]`);
        }
        if (service.privileged) {
          lines.push("    privileged: true");
        }
        if (Number.isFinite(service.userId) && Number.isFinite(service.groupId)) {
          lines.push(`    user: "${service.userId}:${service.groupId}"`);
        }
        const envPairs = service.env
          .filter((env) => env.key && !String(env.key).startsWith("="));
        if (envPairs.length) {
          const hasNullEnv = envPairs.some((env) => env.isNull);
          lines.push("    environment:");
          if (hasNullEnv) {
            envPairs.forEach((env) => {
              if (env.isNull) {
                lines.push(`      ${this.formatYamlKey(env.key)}:`);
              } else {
                lines.push(`      ${this.formatYamlKey(env.key)}: ${this.formatYamlDoubleQuoted(env.value)}`);
              }
            });
          } else {
            envPairs
              .map((env) => `${env.key}=${env.value}`)
              .forEach((pair) => lines.push(`      - ${this.formatYamlDoubleQuoted(pair)}`));
          }
        }
        const healthcheck = this.buildHealthcheck(service);
        if (healthcheck) {
          lines.push("    healthcheck:");
          lines.push(
            `      test: [${this.formatYamlDoubleQuoted(healthcheck.test[0])}, ${this.formatYamlDoubleQuoted(
              healthcheck.test[1]
            )}]`
          );
          lines.push(`      interval: ${healthcheck.interval}`);
          lines.push(`      timeout: ${healthcheck.timeout}`);
          lines.push(`      retries: ${healthcheck.retries}`);
          lines.push(`      start_period: ${healthcheck.start_period}`);
        }
      });

      if (volumeNames.size) {
        lines.push("volumes:");
        volumeNames.forEach((name) => {
          lines.push(`  ${this.formatYamlKey(name)}: {}`);
        });
      }

      return lines.join("\n");
    },
    async copyYaml() {
      if (!this.composeYamlText) return;
      await navigator.clipboard.writeText(this.composeYamlText);
    },
    downloadYaml() {
      if (!this.composeYamlText) return;
      const blob = new Blob([this.composeYamlText], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "docker-compose.yml";
      link.click();
      URL.revokeObjectURL(url);
    },
  },
};
</script>

<style>
@import "@fontsource/fraunces/400.css";
@import "@fontsource/fraunces/600.css";
@import "@fontsource/fraunces/700.css";
@import "@fontsource/space-grotesk/400.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/600.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/jetbrains-mono/400.css";

:root {
  color-scheme: light dark;
  --bg: #f6f0e8;
  --bg-2: #f1e7da;
  --surface: #fff9f2;
  --surface-2: #fff4e4;
  --surface-3: #fffdf8;
  --ink: #1d1b19;
  --muted: #6b5f52;
  --accent: #c45a1a;
  --accent-2: #247c8a;
  --accent-3: #e2b13c;
  --danger: #b63b29;
  --ring: rgba(196, 90, 26, 0.25);
  --shadow: 0 18px 50px rgba(29, 27, 25, 0.12);
  --body-grad-1: #fff3df;
  --body-grad-2: #eadfce;
  --input-bg: #ffffff;
  --border: rgba(29, 27, 25, 0.15);
  --border-soft: rgba(29, 27, 25, 0.12);
  --border-faint: rgba(29, 27, 25, 0.08);
  --border-dashed: rgba(29, 27, 25, 0.2);
  --compose-bg: #191613;
  --compose-ink: #f5e9da;
  --compose-line: rgba(245, 233, 218, 0.5);
  --font-title: "Fraunces", "Times New Roman", serif;
  --font-body: "Space Grotesk", "Segoe UI", sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top left, var(--body-grad-1) 0%, var(--bg) 45%, var(--body-grad-2) 100%);
  color: var(--ink);
  font-family: var(--font-body);
}

a {
  text-underline-offset: 3px;
  color: inherit;
}

a:visited {
  color: inherit;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  display: grid;
  gap: 28px;
  position: relative;
}

.hero {
  position: relative;
  padding: 28px;
  background: linear-gradient(120deg, var(--surface) 10%, var(--surface-2) 90%);
  border-radius: 28px;
  box-shadow: var(--shadow);
  overflow: hidden;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  color: var(--muted);
  margin: 0 0 8px;
}

.hero h1 {
  font-family: var(--font-title);
  font-size: clamp(2rem, 3vw, 3rem);
  margin: 0 0 12px;
}

.hero__subtitle {
  margin: 0 0 18px;
  color: var(--muted);
}

.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  font-size: 0.85rem;
  color: var(--muted);
}

.hero__art {
  position: relative;
  min-height: 200px;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(0.5px);
  animation: float 12s ease-in-out infinite;
}

.orb--one {
  width: 150px;
  height: 150px;
  background: rgba(196, 90, 26, 0.18);
  top: 10px;
  right: 40px;
}

.orb--two {
  width: 210px;
  height: 210px;
  background: rgba(36, 124, 138, 0.2);
  bottom: -40px;
  right: 10px;
  animation-delay: -4s;
}

.orb--three {
  width: 120px;
  height: 120px;
  background: rgba(226, 177, 60, 0.25);
  top: 90px;
  left: 20px;
  animation-delay: -8s;
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-20px);
  }
}

.panel {
  background: var(--surface);
  border-radius: 24px;
  padding: 24px;
  box-shadow: var(--shadow);
  display: grid;
  gap: 20px;
}

.panel--grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.panel--wide {
  grid-template-columns: 1fr;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 6fr) minmax(0, 4fr);
  gap: 24px;
  align-items: start;
  position: relative;
}

.layout__left {
  position: relative;
  z-index: 2;
  display: grid;
  gap: 24px;
}

.layout__right {
  position: sticky;
  top: 24px;
  z-index: 1;
  display: grid;
  gap: 24px;
  height: calc(100vh - 48px);
  grid-template-rows: 9fr 1fr;
}

.yaml-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
}

.yaml-panel .compose-output {
  height: 100%;
  overflow: hidden;
}

.yaml-panel .compose-editor {
  height: 100%;
}

.yaml-panel textarea {
  height: 100%;
  max-height: none;
}

.editor-panel {
  display: grid;
  align-content: center;
  min-height: 0;
  text-align: left;
}

.editor-panel .panel__intro {
  margin-bottom: 6px;
}

.editor-panel p {
  margin: 0;
}

.panel__intro h2 {
  margin: 0 0 6px;
  font-family: var(--font-title);
  font-size: 1.6rem;
}

.panel__intro p {
  margin: 0;
  color: var(--muted);
}

.field {
  display: grid;
  gap: 8px;
}

label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

input,
textarea,
select {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  font-family: var(--font-body);
  transition: border 0.2s ease, box-shadow 0.2s ease;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--ring);
}

textarea {
  min-height: 96px;
  resize: vertical;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.button {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-body);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.button:hover {
  transform: translateY(-1px);
}

.button--primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 8px 18px rgba(196, 90, 26, 0.25);
}

.button--ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--ink);
}

.button--danger {
  background: var(--danger);
  color: #fff;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.chip {
  border: 1px dashed var(--border-dashed);
  background: transparent;
  padding: 6px 12px;
  border-radius: 16px;
  cursor: pointer;
}

.chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.chip-label {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-right: 6px;
}

.checkbox-list {
  display: grid;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--ink);
}

.service-card {
  border-radius: 20px;
  padding: 20px;
  border: 1px solid var(--border-faint);
  background: var(--surface-2);
  display: grid;
  gap: 18px;
  animation: fadeIn 0.4s ease;
  border-left: 10px solid transparent;
  min-width: 0;
}

.service-card__header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.service-card__header>div {
  min-width: 0;
}

.service-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.color-tag {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  box-shadow: 0 0 0 2px var(--surface);
}

.image-scroll {
  max-width: 100%;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: thin;
  min-width: 0;
}

.image-scroll--auto {
  overflow: hidden;
  position: relative;
  min-width: 0;
}

.image-scroll--auto span {
  display: inline-block;
  padding-right: 32px;
  animation: marquee 10s linear infinite;
}

.image-scroll--auto:hover span {
  animation-play-state: paused;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-50%);
  }
}

.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.grid--ports,
.grid--env,
.grid--vols {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
}

.subpanel {
  padding: 16px;
  border-radius: 18px;
  background: var(--surface-3);
  border: 1px dashed var(--border-soft);
  display: grid;
  gap: 12px;
}

.subpanel__header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.hint {
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0;
}

.empty {
  padding: 28px;
  border-radius: 16px;
  text-align: center;
  color: var(--muted);
  border: 1px dashed var(--border-dashed);
}

.compose-output {
  background: var(--compose-bg);
  color: var(--compose-ink);
  border-radius: 18px;
  padding: 18px 18px 18px 8px;
  overflow-x: auto;
  font-family: "JetBrains Mono", "Courier New", monospace;
  font-size: 0.9rem;
}

.compose-editor {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 10px;
  align-items: start;
}

.line-numbers {
  user-select: none;
  text-align: right;
  color: var(--compose-line);
  font-size: inherit;
  line-height: 1.5;
  overflow: hidden;
  padding-left: 0;
}

.line-numbers span {
  display: block;
  line-height: 1.5;
}

.line-numbers__inner {
  will-change: transform;
}

.compose-output textarea {
  width: 100%;
  min-height: 220px;
  max-height: 360px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  padding: 0;
  resize: vertical;
  overflow: auto;
  white-space: pre;
  overflow-wrap: normal;
}

.footer {
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
}

.panel--compact {
  padding: 16px;
}

.editor-panel .panel__intro h2 {
  font-size: 1.1rem;
}

.editor-panel .panel__intro p {
  font-size: 0.85rem;
}

.editor-panel p {
  font-size: 0.9rem;
}

.editor-panel h3 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 1.1rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 720px) {
  .hero {
    padding: 22px;
  }

  .panel {
    padding: 20px;
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .layout__right {
    position: static;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #141210;
    --bg-2: #191613;
    --surface: #1f1d1b;
    --surface-2: #23211f;
    --surface-3: #1b1917;
    --ink: #f4efe8;
    --muted: #b6a99a;
    --accent: #e07a3a;
    --accent-2: #37a0b0;
    --accent-3: #f0c35a;
    --danger: #e26858;
    --ring: rgba(224, 122, 58, 0.35);
    --shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    --body-grad-1: #1b1917;
    --body-grad-2: #0e0d0c;
    --input-bg: #1a1917;
    --border: rgba(244, 239, 232, 0.2);
    --border-soft: rgba(244, 239, 232, 0.16);
    --border-faint: rgba(244, 239, 232, 0.12);
    --border-dashed: rgba(244, 239, 232, 0.25);
    --compose-bg: #0f0e0d;
    --compose-ink: #efe7dc;
    --compose-line: rgba(239, 231, 220, 0.5);
  }
}
</style>
