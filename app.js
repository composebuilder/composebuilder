const { createApp } = Vue;

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const defaultVolumePath = (containerName) =>
  containerName ? `/srv/${containerName}/data` : "/srv/container/data";

const newService = (image, developerName) => {
  const baseName = developerName
    ? `${developerName}-${image.split(":")[0]}`
    : image.split(":")[0];
  const containerName = slugify(baseName || image);
  return {
    id: crypto.randomUUID(),
    image,
    containerName,
    serviceName: slugify(containerName),
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
  };
};

createApp({
  data() {
    return {
      developerName: "",
      imageInput: "",
      services: [],
      composeYaml: "",
    };
  },
  watch: {
    services: {
      deep: true,
      handler() {
        this.composeYaml = this.generateCompose();
      },
    },
    developerName() {
      this.services.forEach((service) => {
        if (service.containerName) return;
        service.containerName = slugify(
          `${this.developerName}-${service.image.split(":")[0]}`
        );
        this.syncServiceName(service);
        service.volumes.forEach((vol) => {
          if (vol.kind === "bind" && vol.source.startsWith("/srv/")) {
            vol.source = defaultVolumePath(service.containerName);
          }
        });
      });
    },
  },
  mounted() {
    this.composeYaml = this.generateCompose();
  },
  methods: {
    addImages() {
      const raw = this.imageInput
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      raw.forEach((image) => {
        this.services.push(newService(image, this.developerName));
      });
      this.imageInput = "";
    },
    clearAll() {
      this.services = [];
      this.composeYaml = "";
    },
    removeService(id) {
      this.services = this.services.filter((service) => service.id !== id);
    },
    syncServiceName(service) {
      service.serviceName = slugify(service.containerName || service.image);
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
        volume.source = service.containerName || "data-volume";
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
        const name = service.serviceName || slugify(service.containerName || service.image);
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
        } else if (service.ports.length) {
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
            if (vol.kind === "volume") {
              volumeNames.add(vol.source);
              lines.push(`      - "${vol.source}:${vol.target}"`);
            } else {
              lines.push(`      - "${vol.source}:${vol.target}"`);
            }
          });
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
