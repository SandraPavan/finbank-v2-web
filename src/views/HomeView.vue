<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import TextField from '../components/TextField.vue';
import { ALIAS } from '../support/alias';
import { useSession } from '../session/session';
import { TEXTS } from '../texts';

const session = useSession();
const router = useRouter();
const alias = ref('');
const error = ref<string | null>(null);
const field = ref<InstanceType<typeof TextField> | null>(null);

async function submit(): Promise<void> {
  const value = alias.value.trim();
  error.value = ALIAS.test(value) ? null : TEXTS.aliasInvalid;
  if (error.value !== null) {
    await nextTick();
    field.value?.focus();
    return;
  }
  await router.push({ name: 'customer-login', params: { alias: value } });
}
</script>

<template>
  <h1 tabindex="-1">Entrar no FinBank V2</h1>
  <p v-if="session.state.notice !== null" class="notice" role="status" data-testid="notice">{{ session.state.notice }}</p>
  <form novalidate data-testid="alias-form" @submit.prevent="submit">
    <TextField id="alias" ref="field" v-model="alias" label="Código da turma" autocomplete="off" :error="error" />
    <button type="submit" data-testid="submit">Continuar</button>
  </form>
  <p><RouterLink :to="{ name: 'facilitator-login' }" data-testid="facilitator-link">Sou facilitador</RouterLink></p>
</template>
