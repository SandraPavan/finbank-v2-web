<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{ title: string; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
let opener: HTMLElement | null = null;

// Modal nativo: prende o foco. Ao fechar, ele volta a quem abriu.
onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  const target = opener;
  queueMicrotask(() => target?.isConnected && target.focus());
});

function cancel(): void {
  if (!props.busy) {
    emit('close');
  }
}
</script>

<template>
  <dialog ref="dialog" aria-labelledby="dialog-title" data-testid="dialog" @cancel.prevent="cancel">
    <h2 id="dialog-title">{{ title }}</h2>
    <slot />
  </dialog>
</template>
