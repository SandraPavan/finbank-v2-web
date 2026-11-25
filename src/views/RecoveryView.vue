<script setup lang="ts">
import { useRouter } from 'vue-router';
import NewPasswordForm from '../components/NewPasswordForm.vue';
import { useSession } from '../session/session';
import { useTakeReturn } from '../support/entry';
import { type Problem, useProblemHandler } from '../support/problems';
import { TEXTS } from '../texts';

const session = useSession();
const router = useRouter();
const takeReturn = useTakeReturn();
const handle = useProblemHandler();

async function save(_current: string, next: string): Promise<Problem | null> {
  try {
    const info = await session.api.completeRecovery(next);
    session.enter(info);
    await router.replace(takeReturn(info.profile));
    return null;
  } catch (error) {
    return handle(error);
  }
}
</script>

<template>
  <h1 tabindex="-1">Defina uma nova senha</h1>
  <p>Você entrou com uma credencial temporária. Escolha uma senha para continuar.</p>
  <NewPasswordForm :ask-current="false" :policy="TEXTS.recoveryPolicy" :save="save" />
</template>
