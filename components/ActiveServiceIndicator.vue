<template>
  <section class="panel panel--wide panel--compact editor-panel" v-if="service">
    <h3 class="image-scroll" :class="{ 'image-scroll--auto': isOverflow }" ref="title">
      <span v-if="isOverflow">正在编辑：{{ title }} · 正在编辑：{{ title }}</span>
      <span v-else>正在编辑：{{ title }}</span>
    </h3>
  </section>
</template>

<script>
export default {
  props: { service: { type: Object, default: null } },
  data() { return { isOverflow: false }; },
  computed: { title() { return this.service?.serviceName || "待生成"; } },
  watch: { service: { deep: true, handler() { this.measure(); } } },
  mounted() { window.addEventListener("resize", this.measure); this.measure(); },
  beforeUnmount() { window.removeEventListener("resize", this.measure); },
  methods: { measure() { this.$nextTick(() => { const el = this.$refs.title; this.isOverflow = Boolean(el && el.scrollWidth > el.clientWidth); }); } },
};
</script>

<style scoped>
.editor-panel { display: grid; align-content: center; min-height: 0; text-align: left; }
.editor-panel h3 { margin: 0; font-family: var(--font-title); font-size: 1.1rem; }
.image-scroll { max-width: 100%; overflow-x: auto; white-space: nowrap; scrollbar-width: thin; min-width: 0; }
.image-scroll--auto { overflow: hidden; position: relative; }
.image-scroll--auto span { display: inline-block; padding-right: 32px; animation: active-marquee 10s linear infinite; }
.image-scroll--auto:hover span { animation-play-state: paused; }
@keyframes active-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
</style>
