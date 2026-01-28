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
      },
    },
  },
  mounted() {
    this.composeYaml = this.generateCompose();
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
    },
    removeService(id) {
      this.services = this.services.filter((service) => service.id !== id);
      if (this.activeServiceId === id) {
        this.activeServiceId = null;
      }
    },
    setActiveService(id, event) {
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
      if (!this.composeYaml) return;
      await navigator.clipboard.writeText(this.composeYaml);
    },
    downloadYaml() {
      if (!this.composeYaml) return;
      const blob = new Blob([this.composeYaml], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "docker-compose.yml";
      link.click();
      URL.revokeObjectURL(url);
    },
  },
}).mount("#app");
