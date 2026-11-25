<script setup lang="ts">
import LoginForm from '../components/LoginForm.vue';
import { useSession } from '../session/session';
import { ALIAS } from '../support/alias';
import { TEXTS } from '../texts';

const props = defineProps<{ alias: string }>();
const session = useSession();
const login = (email: string, password: string) => session.api.loginCustomer(props.alias, email, password);
</script>

<template>
  <h1 tabindex="-1">Entrar</h1>
  <template v-if="ALIAS.test(alias)">
    <p data-testid="alias">Turma: {{ alias }}</p>
    <LoginForm :login="login" help="Esqueceu a senha? Peça uma credencial temporária ao facilitador." />
  </template>
  <p v-else class="problem" role="alert" data-testid="problem">{{ TEXTS.aliasInvalid }}</p>
  <p><RouterLink :to="{ name: 'home' }" data-testid="home-link">Ir para o início</RouterLink></p>
</template>
