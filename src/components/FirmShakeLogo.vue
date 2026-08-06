<template>
  <component
    :is="linkToHome ? 'button' : 'span'"
    :type="linkToHome ? 'button' : undefined"
    :class="[
      'firmshake-logo',
      `firmshake-logo--${size}`,
      { 'firmshake-logo--link': linkToHome },
    ]"
    :aria-label="linkToHome ? 'Go to Browse' : undefined"
    @click="onClick"
  >
    <img
      src="/logo.png"
      alt=""
      class="firmshake-logo__img"
      width="32"
      height="32"
    />
  </component>
</template>

<script setup lang="ts">
import { useIonRouter } from '@ionic/vue';

const props = withDefaults(
  defineProps<{
    linkToHome?: boolean;
    /** toolbar: header (~26–30px); brand: auth/landing hero */
    size?: 'toolbar' | 'brand';
  }>(),
  {
    linkToHome: false,
    size: 'toolbar',
  },
);

const ionRouter = useIonRouter();

function onClick() {
  if (!props.linkToHome) {
    return;
  }
  ionRouter.navigate('/tabs/home', 'root', 'replace');
}
</script>

<style scoped>
.firmshake-logo {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  line-height: 0;
}

.firmshake-logo--link {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
}

.firmshake-logo--link:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.85);
  outline-offset: 2px;
  border-radius: 8px;
}

.firmshake-logo__img {
  display: block;
  object-fit: contain;
}

.firmshake-logo--toolbar .firmshake-logo__img {
  width: 1.65rem;
  height: 1.65rem;
}

.firmshake-logo--brand .firmshake-logo__img {
  width: 3.25rem;
  height: 3.25rem;
}

@media (min-width: 768px) {
  .firmshake-logo--toolbar .firmshake-logo__img {
    width: 1.85rem;
    height: 1.85rem;
  }

  .firmshake-logo--brand .firmshake-logo__img {
    width: 4rem;
    height: 4rem;
  }
}
</style>
