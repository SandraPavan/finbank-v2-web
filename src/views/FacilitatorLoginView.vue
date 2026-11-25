<script setup lang="ts">
import LoginForm from '../components/LoginForm.vue';
import { useSession } from '../session/session';

const session = useSession();
const login = (email: string, password: string) => session.api.loginFacilitator(email, password);
</script>

<template>
  <h1 tabindex="-1">Entrar como facilitador</h1>
  <LoginForm :login="login" help="Esqueceu a senha? Peça uma credencial temporária a quem opera o ambiente." />
  <p><RouterLink :to="{ name: 'home' }" data-testid="home-link">Ir para o início</RouterLink></p>
</template>
