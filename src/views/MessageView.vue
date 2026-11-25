<script setup lang="ts">
defineProps<{ title: string; message: string; retry?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <h1 tabindex="-1">{{ title }}</h1>
  <p data-testid="message">{{ message }}</p>
  <p><button v-if="retry" type="button" data-testid="retry" @click="$emit('retry')">Tentar novamente</button></p>
  <p><RouterLink :to="{ name: 'home' }">Ir para o início</RouterLink></p>
</template>
