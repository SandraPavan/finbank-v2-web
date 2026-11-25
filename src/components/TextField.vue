<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  autocomplete: string;
  error?: string | null;
  hint?: string;
}>();
const model = defineModel<string>({ required: true });
const input = ref<HTMLInputElement | null>(null);
const described = computed(() =>
  [props.hint === undefined ? null : `${props.id}-hint`, props.error ? `${props.id}-error` : null].filter((v) => v !== null).join(' ') || undefined,
);

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      ref="input"
      v-model="model"
      :type="type ?? 'text'"
      :name="id"
      :autocomplete="autocomplete"
      autocapitalize="none"
      spellcheck="false"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="described"
      :data-testid="`field-${id}`"
    />
    <p v-if="hint !== undefined" :id="`${id}-hint`" class="hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="field-error" role="alert" :data-testid="`error-${id}`">{{ error }}</p>
  </div>
</template>
