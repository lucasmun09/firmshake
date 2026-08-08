<template>
  <div class="browse-card-skeleton breathing" aria-hidden="true">
    <div class="browse-card-skeleton__overlay">
      <div class="line title-line" />
      <div class="line meta-line" />
    </div>
  </div>
</template>

<style scoped>
.browse-card-skeleton {
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.08));
  position: relative;
  overflow: hidden;
}

.browse-card-skeleton__overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28%;
  min-height: 2.75rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0.4rem 0.5rem;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.35) 0%,
    rgba(0, 0, 0, 0.12) 70%,
    transparent 100%
  );
}

.line {
  height: 0.55rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
  margin-bottom: 0.35rem;
}

.title-line {
  width: 78%;
}

.meta-line {
  width: 55%;
  margin-bottom: 0;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 0.75;
  }
}

.breathing {
  animation: breathe 1.6s ease-in-out infinite;
}
</style>
