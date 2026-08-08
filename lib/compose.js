import { load as yamlLoad } from "js-yaml";

export const serviceColors = [
  "#c45a1a",
  "#247c8a",
  "#b63b29",
  "#6d5a8d",
  "#2f7d59",
  "#b88b2c",
];

export const imageBaseName = (image) => {
  const imageText = String(image || "");
  const slashIndex = imageText.lastIndexOf("/");
  const colonIndex = imageText.lastIndexOf(":");
  const noTag = colonIndex > slashIndex ? imageText.slice(0, colonIndex) : imageText;
  const parts = noTag.split("/");
  return parts[parts.length - 1] || noTag;
};

export const imageDeveloperName = (image) => {
  const imageText = String(image || "");
  const slashIndex = imageText.lastIndexOf("/");
  const colonIndex = imageText.lastIndexOf(":");
  const noTag = colonIndex > slashIndex ? imageText.slice(0, colonIndex) : imageText;
  const parts = noTag.split("/");
  if (parts.length > 1) {
    const first = parts[0];
    const hasRegistry = first.includes(".") || first.includes(":") || first === "localhost";
    if (hasRegistry && parts[1]) return parts[1];
    if (!hasRegistry && first) return first;
  }
  return imageBaseName(image);
};

export const defaultVolumePath = (containerName) =>
  containerName ? `/srv/${containerName}/data` : "/srv/container/data";

export const normalizeWindowsPath = (value) => {
  if (/^[A-Za-z]:[\\/]/.test(value)) return value.replace(/\\/g, "/");
  return value;
};

export const sanitizeYamlWindowsPaths = (text) =>
  text.replace(/[A-Za-z]:\\[^"\r\n']*/g, (match) => match.replace(/\\/g, "/"));

export const deriveContainerName = (mode, image, currentValue) => {
  if (mode === "developer") return imageDeveloperName(image);
  if (mode === "image") return imageBaseName(image);
  return currentValue || imageBaseName(image);
};

export const createService = (image, createId = () => crypto.randomUUID()) => {
  const containerNameMode = "developer";
  const containerName = deriveContainerName(containerNameMode, image, "");
  return {
    id: createId(),
    image,
    containerName,
    containerNameMode,
    serviceName: containerName,
    color: "",
    restart: "unless-stopped",
    networkMode: "ports",
    rawNetworkMode: "",
    ports: [{ id: createId(), host: 80, container: 80, protocol: "tcp" }],
    volumes: [{
      id: createId(),
      kind: "bind",
      source: defaultVolumePath(containerName),
      target: "/data",
      readOnly: false,
    }],
    env: [],
    dependsOn: [],
    dependsOnConfig: {},
    command: "",
    commandList: [],
    rawBuild: null,
    health: {
      type: "none",
      disable: false,
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

const parsePortMapping = (mapping, createId) => {
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
        if (restParts.length >= 2) [host, container] = restParts;
      }
    }
  } else {
    const parts = mappingPart.split(":");
    if (parts.length >= 3) {
      hostIp = parts.slice(0, parts.length - 2).join(":");
      host = parts[parts.length - 2];
      container = parts[parts.length - 1];
    } else if (parts.length === 2) {
      [host, container] = parts;
    } else if (parts.length === 1) {
      [container] = parts;
    }
  }
  return { id: createId(), hostIp, host: Number(host) || host, container: Number(container) || container, protocol };
};

const parsePortEntry = (entry, createId) => {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    return {
      id: createId(),
      hostIp: entry.host_ip ? String(entry.host_ip) : "",
      host: entry.published !== undefined && entry.published !== null ? Number(entry.published) || String(entry.published) : "",
      container: entry.target !== undefined && entry.target !== null ? Number(entry.target) || String(entry.target) : "",
      protocol: entry.protocol ? String(entry.protocol) : "tcp",
    };
  }
  return parsePortMapping(String(entry), createId);
};

const parseVolumeMapping = (mapping, fallbackName, createId) => {
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
    if (parts.length >= 2) [source, target] = parts;
    else if (parts.length === 1) {
      [target] = parts;
      source = `${fallbackName}-data`;
    }
  }
  const isBind = source.startsWith("/") || source.startsWith("./") || source.startsWith("../") || source.startsWith("~") || /^[A-Za-z]:\//.test(source);
  return { id: createId(), kind: isBind ? "bind" : "volume", source, target, readOnly };
};

const parseVolumeEntry = (entry, fallbackName, createId) => {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const source = normalizeWindowsPath(entry.source !== undefined && entry.source !== null ? String(entry.source) : "");
    let kind = "volume";
    if (entry.type === "bind") kind = "bind";
    else if (entry.type !== "volume" && source) {
      kind = source.startsWith("/") || source.startsWith("./") || source.startsWith("../") || source.startsWith("~") || /^[A-Za-z]:\//.test(source) ? "bind" : "volume";
    }
    return {
      id: createId(),
      kind,
      source,
      target: entry.target !== undefined && entry.target !== null ? String(entry.target) : "",
      readOnly: Boolean(entry.read_only),
    };
  }
  return parseVolumeMapping(String(entry), fallbackName, createId);
};

const parseHealthcheck = (health) => {
  if (!health || !health.test) return null;
  let cmd = "";
  if (Array.isArray(health.test)) {
    if (String(health.test[0] || "").toUpperCase() === "NONE") {
      return { type: "none", disable: true, port: 80, cmd: "", interval: health.interval || "30s", timeout: health.timeout || "5s", retries: Number(health.retries) || 3, startPeriod: health.start_period || "10s" };
    }
    cmd = health.test[0] === "CMD-SHELL" ? health.test[1] || "" : health.test.slice(1).join(" ");
  } else if (typeof health.test === "string") {
    cmd = health.test;
  }
  const httpMatch = cmd.match(/curl\s+-f\s+http:\/\/localhost:(\d+)/i);
  const tcpMatch = cmd.match(/nc\s+-z\s+localhost\s+(\d+)/i);
  return { type: httpMatch ? "http" : tcpMatch ? "tcp" : "cmd", disable: false, port: Number(httpMatch?.[1] || tcpMatch?.[1] || 80), cmd, interval: health.interval || "30s", timeout: health.timeout || "5s", retries: Number(health.retries) || 3, startPeriod: health.start_period || "10s" };
};

const parseDependsOn = (dependsOn) => {
  if (Array.isArray(dependsOn)) return { names: dependsOn.map((name) => String(name)), config: {} };
  if (dependsOn && typeof dependsOn === "object") {
    const names = Object.keys(dependsOn);
    const config = {};
    names.forEach((name) => {
      const value = dependsOn[name];
      if (value && typeof value === "object" && !Array.isArray(value)) config[name] = { ...value };
    });
    return { names, config };
  }
  return { names: [], config: {} };
};

const normalizeRestartValue = (value) => {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text) return "";
  return text === "no" || text === "always" || text === "unless-stopped" || /^on-failure(?::\d+)?$/.test(text) ? text : "";
};

export const importComposeYaml = (text, createId = () => crypto.randomUUID()) => {
  const cleaned = sanitizeYamlWindowsPaths(text);
  const doc = yamlLoad(cleaned);
  const entries = Object.entries(doc?.services || {});
  const services = entries.map(([serviceName, svc], index) => {
    const image = svc.image || "";
    const containerName = svc.container_name || serviceName || imageBaseName(image);
    const service = createService(image, createId);
    service.containerNameMode = "custom";
    service.containerName = containerName;
    service.serviceName = serviceName || containerName;
    service.color = serviceColors[index % serviceColors.length];
    service.restart = normalizeRestartValue(svc.restart);
    const importedNetworkMode = typeof svc.network_mode === "string" ? svc.network_mode : "";
    service.networkMode = importedNetworkMode === "bridge" || importedNetworkMode === "host" ? importedNetworkMode : "ports";
    service.rawNetworkMode = service.networkMode === "ports" ? importedNetworkMode : "";
    service.rawBuild = svc.build !== undefined ? svc.build : null;
    service.ports = Array.isArray(svc.ports) ? svc.ports.map((entry) => parsePortEntry(entry, createId)) : [];
    service.volumes = Array.isArray(svc.volumes) ? svc.volumes.map((entry) => parseVolumeEntry(entry, containerName, createId)) : [];
    service.env = Array.isArray(svc.environment)
      ? svc.environment.map((item) => {
          const raw = String(item);
          const splitIndex = raw.indexOf("=");
          return { id: createId(), key: splitIndex >= 0 ? raw.slice(0, splitIndex) : raw, value: splitIndex >= 0 ? raw.slice(splitIndex + 1) : "", isNull: false };
        })
      : svc.environment && typeof svc.environment === "object"
        ? Object.entries(svc.environment).map(([key, value]) => ({ id: createId(), key, value: value === null || value === undefined ? "" : String(value), isNull: value === null || value === undefined }))
        : [];
    const health = parseHealthcheck(svc.healthcheck);
    if (health) service.health = health;
    service.privileged = Boolean(svc.privileged);
    if (typeof svc.user === "string" && svc.user.includes(":")) {
      const [uidRaw = "", gidRaw = ""] = svc.user.split(":");
      const uid = Number(uidRaw);
      const gid = Number(gidRaw);
      service.userId = Number.isFinite(uid) ? uid : null;
      service.groupId = gidRaw === "" ? null : Number.isFinite(gid) ? gid : null;
    } else if (typeof svc.user === "string" && /^\d+$/.test(svc.user.trim())) {
      service.userId = Number(svc.user.trim());
    } else if (typeof svc.user === "number") {
      service.userId = svc.user;
    }
    if (Array.isArray(svc.command)) {
      service.commandList = svc.command.map((item) => String(item));
      service.command = "";
    } else {
      service.command = svc.command ? String(svc.command) : "";
    }
    const dependsOn = parseDependsOn(svc.depends_on);
    service.dependsOn = dependsOn.names;
    service.dependsOnConfig = dependsOn.config;
    return service;
  });
  return { cleaned, services };
};

const formatYamlDoubleQuoted = (value) => JSON.stringify(String(value ?? ""));
const formatYamlKey = (value) => formatYamlDoubleQuoted(String(value ?? ""));
const formatYamlScalar = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return formatYamlDoubleQuoted(value);
};

const appendYamlNode = (lines, indent, value) => {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return lines.push(`${pad}[]`);
    value.forEach((item) => {
      if (item !== null && typeof item === "object") {
        lines.push(`${pad}-`);
        appendYamlNode(lines, indent + 2, item);
      } else {
        lines.push(`${pad}- ${formatYamlScalar(item)}`);
      }
    });
    return;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return lines.push(`${pad}{}`);
    entries.forEach(([key, nested]) => {
      if (nested !== null && typeof nested === "object") {
        lines.push(`${pad}${formatYamlKey(key)}:`);
        appendYamlNode(lines, indent + 2, nested);
      } else if (nested === null || nested === undefined) {
        lines.push(`${pad}${formatYamlKey(key)}:`);
      } else {
        lines.push(`${pad}${formatYamlKey(key)}: ${formatYamlScalar(nested)}`);
      }
    });
    return;
  }
  lines.push(`${pad}${formatYamlScalar(value)}`);
};

const buildHealthcheck = (service) => {
  const health = service.health;
  if (health.type === "none") return health.disable ? { disable: true, test: ["NONE"] } : null;
  let cmd = health.cmd;
  if (health.type === "http") cmd = `curl -f http://localhost:${health.port} || exit 1`;
  else if (health.type === "tcp") cmd = `nc -z localhost ${health.port} || exit 1`;
  if (!String(cmd || "").trim()) return null;
  return { disable: false, test: ["CMD-SHELL", cmd], interval: health.interval || "30s", timeout: health.timeout || "5s", retries: Number(health.retries) || 3, start_period: health.startPeriod || "10s" };
};

export const generateComposeYaml = (services) => {
  if (!services.length) return "";
  const lines = ['version: "3.8"', "services:"];
  const volumeNames = new Set();
  services.forEach((service) => {
    const name = service.serviceName || service.containerName || imageBaseName(service.image);
    lines.push(`  ${formatYamlKey(name)}:`);
    if (service.image) lines.push(`    image: ${formatYamlDoubleQuoted(service.image)}`);
    if (service.rawBuild !== null && service.rawBuild !== undefined) {
      if (typeof service.rawBuild === "object") {
        lines.push("    build:");
        appendYamlNode(lines, 6, service.rawBuild);
      } else lines.push(`    build: ${formatYamlScalar(service.rawBuild)}`);
    }
    if (service.containerName) lines.push(`    container_name: ${formatYamlDoubleQuoted(service.containerName)}`);
    const restart = normalizeRestartValue(service.restart);
    if (restart) lines.push(`    restart: ${restart}`);
    if (service.networkMode === "bridge") lines.push("    network_mode: bridge");
    else if (service.networkMode === "host") lines.push("    network_mode: host");
    else if (service.rawNetworkMode) lines.push(`    network_mode: ${formatYamlScalar(service.rawNetworkMode)}`);
    if (service.networkMode === "ports" && !service.rawNetworkMode && service.ports.length) {
      const ports = service.ports.filter((port) => port.container);
      if (ports.length) {
        lines.push("    ports:");
        ports.forEach((port) => {
          const hostIp = port.hostIp && port.hostIp.includes(":") && !port.hostIp.startsWith("[") ? `[${port.hostIp}]` : port.hostIp || "";
          const hasHost = port.host !== "" && port.host !== null && port.host !== undefined;
          const suffix = port.protocol && port.protocol !== "tcp" ? `/${port.protocol}` : "";
          lines.push(`      - "${hasHost && hostIp ? `${hostIp}:` : ""}${hasHost ? `${port.host}:` : ""}${port.container}${suffix}"`);
        });
      }
    }
    const volumes = service.volumes.filter((volume) => volume.target);
    if (volumes.length) {
      lines.push("    volumes:");
      volumes.forEach((volume) => {
        const mode = volume.readOnly ? ":ro" : "";
        if (volume.kind === "volume") {
          if (volume.source) {
            volumeNames.add(volume.source);
            lines.push(`      - "${volume.source}:${volume.target}${mode}"`);
          } else lines.push(`      - "${volume.target}${mode}"`);
        } else {
          const source = normalizeWindowsPath(volume.source);
          if (source) lines.push(`      - "${source}:${volume.target}${mode}"`);
        }
      });
    }
    const deps = Array.isArray(service.dependsOn) ? service.dependsOn.filter((dep) => services.some((item) => (item.serviceName || item.containerName) === dep)) : [];
    if (deps.length) {
      const config = service.dependsOnConfig && typeof service.dependsOnConfig === "object" ? service.dependsOnConfig : {};
      const isObject = deps.some((dep) => config[dep] && typeof config[dep] === "object" && Object.keys(config[dep]).length);
      lines.push("    depends_on:");
      if (isObject) deps.forEach((dep) => {
        const item = config[dep];
        if (item && typeof item === "object" && Object.keys(item).length) {
          lines.push(`      ${formatYamlKey(dep)}:`);
          Object.entries(item).forEach(([key, value]) => lines.push(`        ${formatYamlKey(key)}: ${formatYamlScalar(value)}`));
        } else lines.push(`      ${formatYamlKey(dep)}: {}`);
      });
      else deps.forEach((dep) => lines.push(`      - ${formatYamlDoubleQuoted(dep)}`));
    }
    if (service.command && service.command.trim()) lines.push(`    command: ${formatYamlDoubleQuoted(service.command.trim())}`);
    else if (Array.isArray(service.commandList) && service.commandList.length) lines.push(`    command: [${service.commandList.map(formatYamlDoubleQuoted).join(", ")}]`);
    if (service.privileged) lines.push("    privileged: true");
    if (Number.isFinite(service.userId) && Number.isFinite(service.groupId)) lines.push(`    user: "${service.userId}:${service.groupId}"`);
    else if (Number.isFinite(service.userId)) lines.push(`    user: "${service.userId}"`);
    const env = service.env.filter((item) => item.key && !String(item.key).startsWith("="));
    if (env.length) {
      lines.push("    environment:");
      if (env.some((item) => item.isNull)) env.forEach((item) => lines.push(item.isNull ? `      ${formatYamlKey(item.key)}:` : `      ${formatYamlKey(item.key)}: ${formatYamlDoubleQuoted(item.value)}`));
      else env.map((item) => `${item.key}=${item.value}`).forEach((item) => lines.push(`      - ${formatYamlDoubleQuoted(item)}`));
    }
    const healthcheck = buildHealthcheck(service);
    if (healthcheck) {
      lines.push("    healthcheck:");
      if (healthcheck.disable) lines.push('      test: ["NONE"]');
      else {
        lines.push(`      test: [${formatYamlDoubleQuoted(healthcheck.test[0])}, ${formatYamlDoubleQuoted(healthcheck.test[1])}]`);
        lines.push(`      interval: ${healthcheck.interval}`);
        lines.push(`      timeout: ${healthcheck.timeout}`);
        lines.push(`      retries: ${healthcheck.retries}`);
        lines.push(`      start_period: ${healthcheck.start_period}`);
      }
    }
  });
  if (volumeNames.size) {
    lines.push("volumes:");
    volumeNames.forEach((name) => lines.push(`  ${formatYamlKey(name)}: {}`));
  }
  return lines.join("\n");
};
