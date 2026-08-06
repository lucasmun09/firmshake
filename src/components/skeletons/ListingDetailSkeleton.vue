<template>
  <div class="listing-detail-skeleton">
    <div class="hero-skeleton breathing" />
    <div class="line title-line breathing" />
    <div class="line price-line breathing" />
    <div class="line seller-line breathing" />
    <div class="line body-line breathing" />
    <div class="line body-line short breathing" />
  </div>
</template>

<style scoped>
.listing-detail-skeleton {
  padding: 1rem 0;
}

.hero-skeleton {
  width: 100%;
  height: min(50dvh, 320px);
  border-radius: 12px;
  margin-bottom: 1rem;
}

.line {
  height: 14px;
  border-radius: 7px;
  margin-bottom: 0.75rem;
}

.title-line {
  width: 75%;
  height: 22px;
}

.price-line {
  width: 30%;
}

.seller-line {
  width: 45%;
}

.body-line {
  width: 100%;
}

.body-line.short {
  width: 80%;
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
  background: var(--ion-color-step-150);
}
</style>
