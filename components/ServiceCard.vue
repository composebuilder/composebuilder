<template>
  <article class="service-card" :style="{ borderLeftColor: service.color }" @mouseenter="$emit('activate', service.id)"
    @mouseleave="$emit('deactivate', service.id)" @focusin="$emit('activate', service.id)">
    <div class="service-card__header">
      <div>
        <div class="service-card__title"><span class="color-tag" :style="{ background: service.color }"></span>
          <h3 class="image-scroll" :class="{ 'image-scroll--auto': imageOverflow }" ref="imageTitle"><span
              v-if="imageOverflow">{{ service.image }} · {{ service.image }}</span><span v-else>{{ service.image
              }}</span></h3>
        </div>
        <p>服务名称：{{ service.serviceName || "待生成" }}</p>
      </div>
      <button class="button button--danger" @click="$emit('remove', service.id)">移除</button>
    </div>

    <div class="grid">
      <div class="field"><label>容器名称来源</label><select v-model="service.containerNameMode"
          @change="$emit('container-mode', service)">
          <option value="developer">镜像开发者</option>
          <option value="image">镜像名称</option>
          <option value="custom">自定义</option>
        </select></div>
      <div class="field"><label>容器名称</label><input v-model.trim="service.containerName"
          :disabled="service.containerNameMode !== 'custom'" @input="$emit('sync-name', service)" /></div>
      <div class="field"><label>服务名称（自动同步）</label><input v-model="service.serviceName" disabled /></div>
      <div class="field"><label>重启策略</label><select v-model="service.restart">
          <option value="no">不自动重启</option>
          <option value="always">always</option>
          <option value="on-failure">on-failure</option>
          <option value="unless-stopped">unless-stopped</option>
        </select></div>
      <div class="field"><label>网络模式</label><select v-model="service.networkMode"
          @change="$emit('network-mode', service)">
          <option value="ports">端口映射</option>
          <option value="bridge">网桥 (bridge)</option>
          <option value="host">宿主机 (host)</option>
        </select></div>
      <div class="field"><label>特权模式</label><select v-model="service.privileged">
          <option :value="false">关闭</option>
          <option :value="true">开启</option>
        </select></div>
      <div class="field"><label>用户 ID</label><input type="number" min="0" v-model.number="service.userId"
          @input="$emit('normalize-user', service, 'userId', $event)" /></div>
      <div class="field"><label>组 ID</label><input type="number" min="0" v-model.number="service.groupId"
          @input="$emit('normalize-user', service, 'groupId', $event)" /></div>
    </div>

    <div class="subpanel" v-if="service.networkMode !== 'host'">
      <div class="subpanel__header">
        <h4>端口映射</h4>
        <div class="actions"><button class="chip" @click="$emit('preset-port', service, 80)"
            :disabled="hasPort(80)">+80</button><button class="chip" @click="$emit('preset-port', service, 443)"
            :disabled="hasPort(443)">+443</button>
          <div class="chip-group"><span class="chip-label">连续端口</span><button v-if="nextPort" class="chip"
              @click="$emit('preset-port', service, nextPort)">+{{ nextPort }}</button><span v-else
              class="chip-label">已到 3100</span></div>
        </div>
      </div>
      <div v-for="(port, index) in service.ports" :key="port.id" class="grid grid--ports">
        <div class="field"><label>宿主机端口</label><input type="number" min="1" max="65535" v-model.number="port.host" />
        </div>
        <div class="field"><label>容器端口</label><input type="number" min="1" max="65535"
            v-model.number="port.container" /></div>
        <div class="field"><label>协议</label><select v-model="port.protocol">
            <option value="tcp">tcp</option>
            <option value="udp">udp</option>
          </select></div><button class="button button--ghost" @click="$emit('remove-port', service, index)">删除</button>
      </div><button class="button button--ghost" @click="$emit('add-port', service)">添加端口</button>
      <p class="hint">可选范围推荐：80、443、3000-3100，也支持自定义。</p>
      <p class="hint" v-if="service.networkMode === 'bridge' && !service.ports.length">使用网桥时，需要有容器对外提供服务，请确保开放端口。</p>
    </div>
    <p class="hint" v-if="service.networkMode === 'host'">使用宿主机网络时无需端口映射，容器将直接使用宿主机网络栈。</p>

    <div class="subpanel">
      <div class="subpanel__header">
        <h4>挂载卷 / 目录</h4>
      </div>
      <div v-for="(volume, index) in service.volumes" :key="volume.id" class="grid grid--vols">
        <div class="field"><label>类型</label><select v-model="volume.kind"
            @change="$emit('volume-defaults', service, volume)">
            <option value="bind">目录挂载</option>
            <option value="volume">命名卷</option>
          </select></div>
        <div class="field"><label>{{ volume.kind === "bind" ? "宿主机目录" : "卷名称" }}</label><input
            v-model.trim="volume.source" @input="$emit('normalize-volume', volume, $event)" /></div>
        <div class="field"><label>容器目录</label><input v-model.trim="volume.target" /></div>
        <div class="field"><label>只读</label><select v-model="volume.readOnly">
            <option :value="false">否</option>
            <option :value="true">是</option>
          </select></div><button class="button button--ghost"
          @click="$emit('remove-volume', service, index)">删除</button>
      </div><button class="button button--ghost" @click="$emit('add-volume', service)">添加挂载</button>
      <p class="hint">推荐目录：/srv/{{ service.containerName || "容器名称" }}/data</p>
      <p class="hint">不推荐使用挂载卷，优先考虑挂载目录。</p>
    </div>

    <div class="subpanel">
      <div class="subpanel__header">
        <h4>环境变量</h4>
      </div>
      <div v-for="(env, index) in service.env" :key="env.id" class="grid grid--env">
        <div class="field"><label>键</label><input v-model.trim="env.key" /></div>
        <div class="field"><label>值</label><input v-model.trim="env.value" @input="env.isNull = false" /></div><button
          class="button button--ghost" @click="$emit('remove-env', service, index)">删除</button>
      </div><button class="button button--ghost" @click="$emit('add-env', service)">添加环境变量</button>
    </div>

    <div class="subpanel">
      <div class="subpanel__header">
        <h4>服务依赖</h4>
      </div>
      <div class="field"><label>depends_on（仅显示已配置健康检查的服务）</label>
        <div class="checkbox-list" v-if="availableDependencies.length"><label class="checkbox-item"
            v-for="dependency in availableDependencies" :key="dependency.id"><input type="checkbox"
              :checked="service.dependsOn.includes(dependency.serviceName || dependency.containerName)"
              @change="$emit('toggle-dependency', service, dependency.serviceName || dependency.containerName)" /><span>{{
                dependency.serviceName || dependency.containerName }}</span></label></div>
        <p class="hint" v-else>暂无已配置健康检查的服务可选。</p>
      </div>
    </div>

    <div class="subpanel">
      <div class="subpanel__header">
        <h4>启动命令</h4>
      </div>
      <div class="field"><label>command</label><input v-model.trim="service.command" @input="service.commandList = []"
          placeholder="例如：nginx -g 'daemon off;'" /></div>
      <p class="hint">command 可为空，将不写入配置。</p>
    </div>

    <div class="subpanel">
      <div class="subpanel__header">
        <h4>健康检查</h4>
      </div>
      <div class="grid">
        <div class="field"><label>类型</label><select v-model="service.health.type"
            @change="service.health.disable = false">
            <option value="none">不启用</option>
            <option value="http">HTTP</option>
            <option value="tcp">TCP</option>
            <option value="cmd">自定义命令</option>
          </select></div>
        <div class="field" v-if="service.health.type !== 'none' && service.health.type !== 'cmd'">
          <label>端口</label><input type="number" min="1" max="65535" v-model.number="service.health.port" /></div>
        <div class="field" v-if="service.health.type === 'cmd'"><label>命令</label><input
            v-model.trim="service.health.cmd" placeholder="例如：curl -f http://localhost:8080" /></div>
        <div class="field"><label>间隔</label><input v-model.trim="service.health.interval" placeholder="30s" /></div>
        <div class="field"><label>超时</label><input v-model.trim="service.health.timeout" placeholder="5s" /></div>
        <div class="field"><label>重试次数</label><input type="number" min="1" v-model.number="service.health.retries" />
        </div>
        <div class="field"><label>启动宽限期</label><input v-model.trim="service.health.startPeriod" placeholder="10s" />
        </div>
      </div>
    </div>
  </article>
</template>

<script>
export default {
  props: { service: { type: Object, required: true }, availableDependencies: { type: Array, required: true } },
  emits: ["remove", "activate", "deactivate", "container-mode", "sync-name", "network-mode", "normalize-user", "preset-port", "add-port", "remove-port", "volume-defaults", "normalize-volume", "add-volume", "remove-volume", "add-env", "remove-env", "toggle-dependency"],
  data() { return { imageOverflow: false }; },
  computed: { nextPort() { for (let port = 3000; port <= 3100; port += 1) if (!this.hasPort(port)) return port; return null; } },
  watch: { "service.image": "measureOverflow" },
  mounted() { window.addEventListener("resize", this.measureOverflow); this.measureOverflow(); },
  beforeUnmount() { window.removeEventListener("resize", this.measureOverflow); },
  methods: { hasPort(port) { return this.service.ports.some((item) => Number(item.host) === Number(port)); }, measureOverflow() { this.$nextTick(() => { const el = this.$refs.imageTitle; this.imageOverflow = Boolean(el && el.scrollWidth > el.clientWidth); }); } },
};
</script>
