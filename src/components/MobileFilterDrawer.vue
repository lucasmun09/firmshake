<template>
  <div
    class="mobile-filter-drawer"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div
      class="mobile-filter-drawer__track"
      :style="{ transform: `translateX(-${translateIndex * 100}%)` }"
    >
      <div class="mobile-filter-drawer__panel">
        <slot name="root" :push="pushPanel" />
      </div>
      <div
        v-for="panelId in panelIds"
        :key="panelId"
        class="mobile-filter-drawer__panel"
      >
        <slot
          :name="`panel-${panelId}`"
          :pop="popPanel"
          :pop-all="resetPanels"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';

const stack = defineModel<string[]>('stack', { default: () => [] });

const slots = useSlots();

const panelIds = computed(() =>
  Object.keys(slots)
    .filter((name) => name.startsWith('panel-'))
    .map((name) => name.slice('panel-'.length))
    .sort(),
);

const translateIndex = computed(() => {
  if (!stack.value.length) {
    return 0;
  }

  const activeId = stack.value[stack.value.length - 1];
  const idx = panelIds.value.indexOf(activeId);
  return idx >= 0 ? idx + 1 : 0;
});

let touchStartX = 0;

function pushPanel(id: string) {
  if (!panelIds.value.includes(id)) {
    return;
  }
  stack.value = [...stack.value, id];
}

function popPanel() {
  if (!stack.value.length) {
    return;
  }
  stack.value = stack.value.slice(0, -1);
}

function resetPanels() {
  stack.value = [];
}

function onTouchStart(event: TouchEvent) {
  touchStartX = event.touches[0]?.clientX ?? 0;
}

function onTouchEnd(event: TouchEvent) {
  if (!stack.value.length) {
    return;
  }

  const touchEndX = event.changedTouches[0]?.clientX ?? 0;
  const deltaX = touchEndX - touchStartX;

  if (deltaX > 72) {
    popPanel();
  }
}
</script>

<style scoped>
.mobile-filter-drawer {
  overflow-x: hidden;
  overflow-y: visible;
  width: 100%;
  min-height: 0;
}

.mobile-filter-drawer__track {
  display: flex;
  width: 100%;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.mobile-filter-drawer__panel {
  flex: 0 0 100%;
  width: 100%;
  min-width: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
