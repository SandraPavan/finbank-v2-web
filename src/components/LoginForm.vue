<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { SessionInfo } from '../api/api';
import { useSession } from '../session/session';
import { useTakeReturn } from '../support/entry';
import { type Problem, problemOf } from '../support/problems';
import { TEXTS } from '../texts';
import ProblemMessage from './ProblemMessage.vue';
import TextField from './TextField.vue';

const props = defineProps<{ help: string; login: (email: string, password: string) => Promise<SessionInfo> }>();
const session = useSession();
const router = useRouter();
const takeReturn = useTakeReturn();

const email = ref('');
const password = ref('');
const emailError = ref<string | null>(null);
const passwordError = ref<string | null>(null);
const problem = ref<Problem | null>(null);
const busy = ref(false);
const emailField = ref<InstanceType<typeof TextField> | null>(null);
const passwordField = ref<InstanceType<typeof TextField> | null>(null);

async function submit(): Promise<void> {
  if (busy.value) {
    return;
  }
  problem.value = null;
  session.note(null);
  emailError.value = email.value.trim() === '' ? TEXTS.required : null;
  passwordError.value = password.value === '' ? TEXTS.required : null;
  if (emailError.value !== null || passwordError.value !== null) {
    await nextTick();
    (emailError.value !== null ? emailField : passwordField).value?.focus();
    return;
  }
  busy.value = true;
  const typed = password.value;
  password.value = '';
  try {
    const info = await props.login(email.value, typed);
    session.enter(info);
    await router.replace(info.passwordChangeRequired ? { name: 'recovery' } : takeReturn(info.profile));
  } catch (error) {
    problem.value = problemOf(error);
    await nextTick();
    passwordField.value?.focus();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <p v-if="session.state.notice !== null" class="notice" role="status" data-testid="notice">{{ session.state.notice }}</p>
  <ProblemMessage :problem="problem" />
  <form novalidate data-testid="login-form" @submit.prevent="submit">
    <TextField id="email" ref="emailField" v-model="email" label="E-mail" type="email" autocomplete="username" :error="emailError" />
    <TextField
      id="password"
      ref="passwordField"
      v-model="password"
      label="Senha ou credencial temporária"
      type="password"
      autocomplete="current-password"
      :error="passwordError"
    />
    <button type="submit" data-testid="submit" :aria-disabled="busy">Entrar</button>
  </form>
  <p class="hint">{{ help }}</p>
</template>
