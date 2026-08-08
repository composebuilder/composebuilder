<template>
  <div class="app">
    <AppHero :version="packageVersion" />

    <div class="layout">
      <div class="layout__left">
        <ImageInputPanel v-model="imageInput" :has-services="Boolean(services.length)" @add-images="addImages" @clear-all="clearAll" />

        <section class="panel panel--wide">
          <div class="panel__intro">
            <h2>服务配置</h2>
            <p>逐个完善容器名称、端口、挂载、环境变量与健康检查。</p>
          </div>
          <div v-if="!services.length" class="empty">还没有服务，先在上方添加镜像。</div>
          <ServiceCard
            v-for="service in services"
            :key="service.id"
            :service="service"
            :available-dependencies="availableDependsOn(service)"
            @remove="removeService"
            @activate="setActiveService"
            @deactivate="clearActiveService"
            @container-mode="applyContainerNameMode"
            @sync-name="syncServiceName"
            @network-mode="onNetworkModeChange"
            @normalize-user="normalizeUserId"
            @preset-port="addPresetPort"
            @add-port="addPort"
            @remove-port="removePort"
            @volume-defaults="syncVolumeDefaults"
            @normalize-volume="normalizeVolumeSource"
            @add-volume="addVolume"
            @remove-volume="removeVolume"
            @add-env="addEnv"
            @remove-env="removeEnv"
            @toggle-dependency="toggleDependsOn"
          />
        </section>
      </div>

      <div class="layout__right">
        <YamlEditorPanel v-model="composeYamlText" @dirty="markYamlDirty" @refresh="importFromYamlText" @download="downloadYaml" />
        <ActiveServiceIndicator :service="activeService" />
      </div>
    </div>

    <AppFooter />
  </div>
</template>

<script>
import { version as packageVersion } from "./package.json";
import ActiveServiceIndicator from "./components/ActiveServiceIndicator.vue";
import AppFooter from "./components/AppFooter.vue";
import AppHero from "./components/AppHero.vue";
import ImageInputPanel from "./components/ImageInputPanel.vue";
import ServiceCard from "./components/ServiceCard.vue";
import YamlEditorPanel from "./components/YamlEditorPanel.vue";
import {
  createService,
  defaultVolumePath,
  deriveContainerName,
  generateComposeYaml,
  imageBaseName,
  importComposeYaml,
  normalizeWindowsPath,
  serviceColors,
} from "./lib/compose.js";

export default {
  components: { ActiveServiceIndicator, AppFooter, AppHero, ImageInputPanel, ServiceCard, YamlEditorPanel },
  data() {
    return {
      packageVersion,
      imageInput: "",
      services: [],
      composeYaml: "",
      composeYamlText: "",
      yamlDirty: false,
      activeServiceId: null,
    };
  },
  computed: {
    activeService() {
      return this.services.find((service) => service.id === this.activeServiceId) || null;
    },
  },
  watch: {
    services: {
      deep: true,
      handler() {
        this.composeYaml = generateComposeYaml(this.services);
        if (!this.yamlDirty) this.composeYamlText = this.composeYaml;
      },
    },
  },
  mounted() {
    this.composeYaml = generateComposeYaml(this.services);
    this.composeYamlText = this.composeYaml;
  },
  methods: {
    addImages(imageInput) {
      const images = imageInput.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
      images.forEach((image, index) => {
        const service = createService(image);
        service.color = serviceColors[(this.services.length + index) % serviceColors.length];
        this.services.push(service);
      });
      this.imageInput = "";
    },
    clearAll() {
      this.services = [];
      this.composeYaml = "";
      this.composeYamlText = "";
      this.yamlDirty = false;
      this.activeServiceId = null;
    },
    removeService(id) {
      this.services = this.services.filter((service) => service.id !== id);
      if (this.activeServiceId === id) this.activeServiceId = null;
    },
    setActiveService(id) {
      this.activeServiceId = id;
    },
    clearActiveService(id) {
      if (this.activeServiceId === id) this.activeServiceId = null;
    },
    applyContainerNameMode(service) {
      service.containerName = deriveContainerName(service.containerNameMode, service.image, service.containerName);
      this.syncServiceName(service);
      service.volumes.forEach((volume) => {
        if (volume.kind === "bind" && volume.source.startsWith("/srv/")) volume.source = defaultVolumePath(service.containerName);
        if (volume.kind === "volume" && (!volume.source || volume.source === imageBaseName(service.image))) volume.source = service.containerName;
      });
    },
    syncServiceName(service) {
      service.serviceName = service.containerName || imageBaseName(service.image);
    },
    onNetworkModeChange(service) {
      service.rawNetworkMode = "";
    },
    normalizeUserId(service, key, event) {
      const raw = event?.target?.value ?? "";
      service[key] = raw === "" ? null : Number.isFinite(Number(raw)) ? Number(raw) : null;
    },
    availableDependsOn(service) {
      return this.services.filter((item) => item.id !== service.id && item.health?.type && item.health.type !== "none");
    },
    toggleDependsOn(service, name) {
      if (!service.dependsOnConfig || typeof service.dependsOnConfig !== "object") service.dependsOnConfig = {};
      if (service.dependsOn.includes(name)) {
        service.dependsOn = service.dependsOn.filter((item) => item !== name);
        delete service.dependsOnConfig[name];
      } else service.dependsOn = [...service.dependsOn, name];
    },
    addPort(service) {
      service.ports.push({ id: crypto.randomUUID(), hostIp: "", host: 3000, container: 3000, protocol: "tcp" });
    },
    addPresetPort(service, port) {
      if (service.ports.some((item) => Number(item.host) === Number(port))) return;
      service.ports.push({ id: crypto.randomUUID(), hostIp: "", host: port, container: port, protocol: "tcp" });
      service.health.port = port;
    },
    removePort(service, index) {
      service.ports.splice(index, 1);
    },
    addVolume(service) {
      service.volumes.push({ id: crypto.randomUUID(), kind: "bind", source: defaultVolumePath(service.containerName), target: "/data", readOnly: false });
    },
    removeVolume(service, index) {
      service.volumes.splice(index, 1);
    },
    syncVolumeDefaults(service, volume) {
      volume.source = volume.kind === "bind" ? defaultVolumePath(service.containerName) : service.containerName || imageBaseName(service.image);
    },
    normalizeVolumeSource(volume, event) {
      volume.source = normalizeWindowsPath(event?.target?.value ?? volume.source ?? "");
    },
    addEnv(service) {
      service.env.push({ id: crypto.randomUUID(), key: "", value: "", isNull: false });
    },
    removeEnv(service, index) {
      service.env.splice(index, 1);
    },
    markYamlDirty() {
      this.yamlDirty = true;
    },
    importFromYamlText() {
      if (!this.composeYamlText.trim()) return;
      try {
        const { cleaned, services } = importComposeYaml(this.composeYamlText);
        this.composeYamlText = cleaned;
        this.services = services;
        this.yamlDirty = false;
        this.composeYaml = generateComposeYaml(this.services);
        this.composeYamlText = this.composeYaml;
      } catch (error) {
        console.error(error);
        alert("导入失败，请检查 YAML 格式是否正确。");
      }
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

<style scoped>
.app { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; display: grid; gap: 28px; position: relative; }
.layout { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 4fr); gap: 24px; align-items: start; position: relative; }
.layout__left { position: relative; z-index: 2; display: grid; gap: 24px; }
.layout__right { position: sticky; top: 24px; z-index: 1; display: grid; gap: 24px; height: calc(100vh - 48px); grid-template-rows: 9fr 1fr; }
@media (max-width: 720px) { .layout { grid-template-columns: 1fr; } .layout__right { position: static; } }
</style>
