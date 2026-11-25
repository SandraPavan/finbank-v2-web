<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import type { Problem } from '../support/problems';
import { TEXTS } from '../texts';

const props = defineProps<{ problem: Problem | null }>();
const remaining = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function stop(): void {
  clearInterval(timer);
  timer = undefined;
}

watch(
  () => props.problem,
  (problem) => {
    stop();
    remaining.value = problem?.waitSeconds ?? 0;
    if (remaining.value > 0) {
      timer = setInterval(() => {
        remaining.value -= 1;
        if (remaining.value <= 0) {
          stop();
        }
      }, 1000);
    }
  },
  { immediate: true },
);
onUnmounted(stop);
</script>

<template>
  <div v-if="problem !== null" class="problem" data-testid="problem">
    <!-- Anunciado uma vez; a contagem visível não é relida a cada segundo. -->
    <p role="alert" :class="{ 'sr-only': problem.waitSeconds !== null }">{{ problem.message }}</p>
    <p v-if="problem.waitSeconds !== null" aria-hidden="true" data-testid="countdown">{{ TEXTS.rateLimited(Math.max(remaining, 0)) }}</p>
  </div>
</template>
