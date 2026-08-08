<template>
  <section class="panel panel--wide yaml-panel">
    <div class="panel__intro">
      <h2>YAML 展示区</h2>
      <p>右侧可直接编辑，点击刷新后同步到左侧。</p>
    </div>
    <div class="compose-output">
      <div class="compose-editor">
        <div class="line-numbers" :style="lineNumberStyle">
          <div class="line-numbers__inner" :style="{ transform: `translateY(-${lineScrollTop}px)` }"><span
              v-for="line in lineNumbers" :key="line">{{ line }}</span></div>
        </div>
        <textarea ref="yamlArea" aria-label="Compose YAML" :value="modelValue" @input="onInput"
          @scroll="lineScrollTop = $event.target.scrollTop" wrap="off"></textarea>
      </div>
    </div>
    <div class="actions">
      <button class="button button--primary" @click="$emit('refresh')" :disabled="!modelValue">刷新</button>
      <button class="button button--ghost" @click="$emit('download')" :disabled="!modelValue">下载 YAML</button>
    </div>
  </section>
</template>

<script>
export default {
  props: { modelValue: { type: String, required: true } },
  emits: ["update:modelValue", "dirty", "refresh", "download"],
  data() { return { lineNumberStyle: {}, lineScrollTop: 0 }; },
  computed: { lineNumbers() { const lines = this.modelValue ? this.modelValue.split("\n").length : 1; return Array.from({ length: lines }, (_, index) => index + 1); } },
  mounted() { this.updateLineNumberSize(); window.addEventListener("resize", this.updateLineNumberSize); },
  beforeUnmount() { window.removeEventListener("resize", this.updateLineNumberSize); },
  methods: {
    onInput(event) { this.$emit("update:modelValue", event.target.value); this.$emit("dirty"); this.$nextTick(this.updateLineNumberSize); },
    updateLineNumberSize() { const area = this.$refs.yamlArea; if (area) this.lineNumberStyle = { height: `${area.clientHeight}px` }; },
  },
};
</script>

<style scoped>
.yaml-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
}

.yaml-panel .compose-output,
.yaml-panel .compose-editor {
  height: 100%;
}

.yaml-panel .compose-output {
  overflow: hidden;
}

.yaml-panel textarea {
  height: 100%;
  max-height: none;
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
</style>
