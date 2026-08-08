<template>
  <header class="hero">
    <div class="hero__content">
      <p class="hero__eyebrow">ComposeBuilder</p>
      <h1>用图形化方式快速拼装你的 docker-compose.yml</h1>
      <p class="hero__subtitle">输入镜像，配置容器，立刻生成合并后的 Compose 配置文件。</p>
      <div class="hero__meta">
        <span>文档：<a href="https://www.blazesnow.com/composebuilder" target="_blank"
            rel="noopener noreferrer">https://www.blazesnow.com/composebuilder</a></span>
        <span>镜像：<a href="https://hub.docker.com/r/composebuilder/composebuilder" target="_blank"
            rel="noopener noreferrer">composebuilder/composebuilder</a></span>
        <span>前端架构：Vue 3</span>
        <span>当前版本：v{{ version }}</span>
      </div>
    </div>
    <div class="hero__art" aria-hidden="true">
      <div class="orb orb--one"></div>
      <div class="orb orb--two"></div>
      <div class="orb orb--three"></div>
    </div>
  </header>
</template>

<script>
export default {
  props: {
    version: { type: String, required: true },
  },
};
</script>

<style scoped>
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

h1 {
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
  animation: hero-float 12s ease-in-out infinite;
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

@keyframes hero-float {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-20px);
  }
}

@media (max-width: 720px) {
  .hero {
    padding: 22px;
  }
}
</style>
