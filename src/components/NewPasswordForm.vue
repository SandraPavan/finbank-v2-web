<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { fitsPolicy } from '../support/password';
import type { Problem } from '../support/problems';
import { TEXTS } from '../texts';
import ProblemMessage from './ProblemMessage.vue';
import TextField from './TextField.vue';

const props = defineProps<{
  askCurrent: boolean;
  policy: string;
  /** Devolve o que mostrar, ou null se concluiu. */
  save: (current: string, next: string) => Promise<Problem | null>;
}>();

const current = ref('');
const next = ref('');
const repeat = ref('');
const errors = ref<{ current: string | null; next: string | null; repeat: string | null }>({ current: null, next: null, repeat: null });
const problem = ref<Problem | null>(null);
const busy = ref(false);
const currentField = ref<InstanceType<typeof TextField> | null>(null);
const nextField = ref<InstanceType<typeof TextField> | null>(null);
const repeatField = ref<InstanceType<typeof TextField> | null>(null);

async function focusFirst(): Promise<void> {
  await nextTick();
  if (errors.value.current !== null) {
    currentField.value?.focus();
  } else if (errors.value.next !== null) {
    nextField.value?.focus();
  } else if (errors.value.repeat !== null) {
    repeatField.value?.focus();
  }
}

async function submit(): Promise<void> {
  if (busy.value) {
    return;
  }
  problem.value = null;
  errors.value = {
    current: props.askCurrent && current.value === '' ? TEXTS.required : null,
    next: fitsPolicy(next.value) ? null : props.policy,
    repeat: next.value === repeat.value ? null : TEXTS.passwordsDiffer,
  };
  if (Object.values(errors.value).some((e) => e !== null)) {
    await focusFirst();
    return;
  }
  busy.value = true;
  const typed = { current: current.value, next: next.value };
  current.value = '';
  next.value = '';
  repeat.value = '';
  try {
    const result = await props.save(typed.current, typed.next);
    if (result?.message === TEXTS.currentPasswordInvalid) {
      errors.value.current = result.message;
    } else if (result?.message === TEXTS.passwordPolicy) {
      errors.value.next = props.policy;
    } else {
      problem.value = result;
    }
    if (result !== null) {
      await focusFirst();
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ProblemMessage :problem="problem" />
  <form novalidate data-testid="password-form" @submit.prevent="submit">
    <TextField
      v-if="askCurrent"
      id="current-password"
      ref="currentField"
      v-model="current"
      label="Senha atual"
      type="password"
      autocomplete="current-password"
      :error="errors.current"
    />
    <TextField
      id="new-password"
      ref="nextField"
      v-model="next"
      label="Nova senha"
      type="password"
      autocomplete="new-password"
      :hint="TEXTS.passwordHint"
      :error="errors.next"
    />
    <TextField
      id="repeat-password"
      ref="repeatField"
      v-model="repeat"
      label="Repita a nova senha"
      type="password"
      autocomplete="new-password"
      :error="errors.repeat"
    />
    <button type="submit" data-testid="submit" :aria-disabled="busy">Salvar</button>
  </form>
</template>
