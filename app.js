const { createApp } = Vue;

const imageBaseName = (image) => {
  const noTag = image.split(":")[0];
  const parts = noTag.split("/");
  return parts[parts.length - 1] || noTag;
};

const imageDeveloperName = (image) => {
  const noTag = image.split(":")[0];
  const parts = noTag.split("/");
  if (parts.length > 1 && parts[0]) return parts[0];
  return imageBaseName(image);
};

const defaultVolumePath = (containerName) =>
  containerName ? `/srv/${containerName}/data` : "/srv/container/data";

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
    command: "",
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
    userId: 0,
    groupId: 0,
  };
};

createApp({
  data() {
    return {
      imageInput: "",
      services: [],
      composeYaml: "",
      activeServiceId: null,
      composeYamlText: "",
      yamlDirty: false,
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
        this.composeYaml = this.generateCompose();
        if (!this.yamlDirty) {
          this.composeYamlText = this.composeYaml;
        }
      },
    },
  },
  mounted() {
    this.composeYaml = this.generateCompose();
    this.composeYamlText = this.composeYaml;
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
        this.services.push(service);
      });
      this.imageInput = "";
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
    },
    setActiveService(id) {
      this.activeServiceId = id;
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
    availableDependsOn(service) {
      return this.services.filter(
        (item) => item.id !== service.id && item.health?.type && item.health.type !== "none"
      );
    },
    toggleDependsOn(service, name) {
      if (service.dependsOn.includes(name)) {
        service.dependsOn = service.dependsOn.filter((item) => item !== name);
      } else {
        service.dependsOn = [...service.dependsOn, name];
      }
    },
    addPort(service) {
      service.ports.push({
        id: crypto.randomUUID(),
        host: 3000,
        container: 3000,
        protocol: "tcp",
      });
    },
    addPresetPort(service, port) {
      if (this.hasPort(service, port)) return;
      service.ports.push({
        id: crypto.randomUUID(),
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
      });
    },
    removeEnv(service, idx) {
      service.env.splice(idx, 1);
    },
    parsePortMapping(mapping) {
      const [mappingPart, protocolPart] = mapping.split("/");
      const protocol = protocolPart || "tcp";
      const parts = mappingPart.split(":");
      let host = "";
      let container = "";
      if (parts.length >= 2) {
        container = parts[parts.length - 1];
        host = parts[parts.length - 2];
      } else if (parts.length === 1) {
        host = parts[0];
        container = parts[0];
      }
      return {
        id: crypto.randomUUID(),
        host: Number(host) || host,
        container: Number(container) || container,
        protocol,
      };
    },
    parseVolumeMapping(mapping, fallbackName) {
      const parts = mapping.split(":");
      const readOnly = parts[parts.length - 1] === "ro";
      if (readOnly) parts.pop();
      let source = "";
      let target = "";
      if (parts.length >= 2) {
        source = parts[0];
        target = parts[1];
      } else if (parts.length === 1) {
        target = parts[0];
        source = `${fallbackName}-data`;
      }
      const isBind =
        source.startsWith("/") ||
        source.startsWith("./") ||
        source.startsWith("../") ||
        source.startsWith("~");
      return {
        id: crypto.randomUUID(),
        kind: isBind ? "bind" : "volume",
        source,
        target,
        readOnly,
      };
    },
    parseHealthcheck(health) {
      if (!health || !health.test) return null;
      let cmd = "";
      if (Array.isArray(health.test)) {
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
      if (Array.isArray(dependsOn)) return dependsOn;
      if (dependsOn && typeof dependsOn === "object") return Object.keys(dependsOn);
      return [];
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
        service.serviceName = containerName;
        service.color = colorPalette[index % colorPalette.length];
        service.restart = svc.restart || "no";
        service.networkMode = svc.network_mode || "ports";
        service.ports = Array.isArray(svc.ports)
          ? svc.ports.map((p) => this.parsePortMapping(String(p)))
          : [];
        service.volumes = Array.isArray(svc.volumes)
          ? svc.volumes.map((v) => this.parseVolumeMapping(String(v), containerName))
          : [];
        const envList = [];
        if (Array.isArray(svc.environment)) {
          svc.environment.forEach((item) => {
            const [key, value = ""] = String(item).split("=");
            envList.push({ id: crypto.randomUUID(), key, value });
          });
        } else if (svc.environment && typeof svc.environment === "object") {
          Object.entries(svc.environment).forEach(([key, value]) => {
            envList.push({ id: crypto.randomUUID(), key, value: String(value) });
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
        } else if (typeof svc.user === "number") {
          service.userId = svc.user;
          service.groupId = 0;
        }
        service.command = svc.command ? String(svc.command) : "";
        const dependsOn = this.parseDependsOn(svc.depends_on);
        service.dependsOn = dependsOn;
        nextServices.push(service);
      });
      this.services = nextServices;
    },
    importFromYamlText() {
      if (!this.composeYamlText.trim()) return;
      try {
        const doc = jsyaml.load(this.composeYamlText);
        this.applyImportedServices(doc);
        this.yamlDirty = false;
        this.composeYaml = this.generateCompose();
        this.composeYamlText = this.composeYaml;
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
        lines.push(`  ${name}:`);
        lines.push(`    image: ${service.image}`);
        if (service.containerName) {
          lines.push(`    container_name: ${service.containerName}`);
        }
        if (service.restart) {
          lines.push(`    restart: ${service.restart}`);
        }
        if (service.networkMode === "bridge") {
          lines.push("    network_mode: bridge");
        } else if (service.networkMode === "host") {
          lines.push("    network_mode: host");
        }
        if (service.networkMode !== "host" && service.ports.length) {
          lines.push("    ports:");
          service.ports.forEach((port) => {
            if (!port.host || !port.container) return;
            const suffix = port.protocol && port.protocol !== "tcp" ? `/${port.protocol}` : "";
            lines.push(`      - "${port.host}:${port.container}${suffix}"`);
          });
        }
        if (service.volumes.length) {
          lines.push("    volumes:");
          service.volumes.forEach((vol) => {
            if (!vol.source || !vol.target) return;
            const mode = vol.readOnly ? ":ro" : "";
            if (vol.kind === "volume") {
              volumeNames.add(vol.source);
              lines.push(`      - "${vol.source}:${vol.target}${mode}"`);
            } else {
              lines.push(`      - "${vol.source}:${vol.target}${mode}"`);
            }
          });
        }
        const deps = Array.isArray(service.dependsOn) ? service.dependsOn : [];
        if (deps.length) {
          const validDeps = deps.filter((dep) =>
            this.services.some((svc) => (svc.serviceName || svc.containerName) === dep)
          );
          if (validDeps.length) {
            lines.push("    depends_on:");
            validDeps.forEach((dep) => lines.push(`      - ${dep}`));
          }
        }
        if (service.command && service.command.trim()) {
          lines.push(`    command: ${service.command.trim()}`);
        }
        if (service.privileged) {
          lines.push("    privileged: true");
        }
        if (
          service.userId !== null &&
          service.userId !== undefined &&
          service.groupId !== null &&
          service.groupId !== undefined
        ) {
          lines.push(`    user: "${service.userId}:${service.groupId}"`);
        }
        const envPairs = service.env
          .map((env) => `${env.key}=${env.value}`)
          .filter((pair) => pair !== "=" && !pair.startsWith("=") && !pair.endsWith("="));
        if (envPairs.length) {
          lines.push("    environment:");
          envPairs.forEach((pair) => lines.push(`      - "${pair}"`));
        }
        const healthcheck = this.buildHealthcheck(service);
        if (healthcheck) {
          lines.push("    healthcheck:");
          lines.push(`      test: ["${healthcheck.test[0]}", "${healthcheck.test[1]}"]`);
          lines.push(`      interval: ${healthcheck.interval}`);
          lines.push(`      timeout: ${healthcheck.timeout}`);
          lines.push(`      retries: ${healthcheck.retries}`);
          lines.push(`      start_period: ${healthcheck.start_period}`);
        }
      });

      if (volumeNames.size) {
        lines.push("volumes:");
        volumeNames.forEach((name) => {
          lines.push(`  ${name}: {}`);
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
}).mount("#app");
