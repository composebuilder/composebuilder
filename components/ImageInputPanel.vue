<template>
  <section class="panel panel--grid">
    <div class="panel__intro">
      <h2>镜像输入</h2>
      <p>支持一行一个镜像名称，或用逗号分隔。添加后可逐个配置。</p>
    </div>
    <div class="field">
      <label for="images">镜像名称</label>
      <textarea id="images" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" placeholder="例如：nginx:latest, redis:7 或 mysql:8"></textarea>
    </div>
    <p class="hint">需要导入现有配置时，请直接编辑 YAML 并点击刷新按钮。</p>
    <div class="actions">
      <button class="button button--primary" @click="$emit('add-images', modelValue)">添加镜像</button>
      <button class="button button--ghost" @click="$emit('clear-all')" :disabled="!hasServices">清空全部</button>
    </div>
  </section>
</template>

<script>
export default {
  props: { modelValue: { type: String, required: true }, hasServices: { type: Boolean, required: true } },
  emits: ["update:modelValue", "add-images", "clear-all"],
};
</script>
