<script setup lang="ts">
import ProblemMessage from '../components/ProblemMessage.vue';
import { useSession } from '../session/session';
import { usePages } from '../support/pages';

const session = useSession();
const { items, more, loaded, problem, busy, loadMore } = usePages((offset) => session.api.workspaces(offset));
</script>

<template>
  <h1 tabindex="-1">Workspaces</h1>
  <ProblemMessage :problem="problem" />
  <p v-if="loaded && items.length === 0" data-testid="empty">Você ainda não tem workspaces. Peça o vínculo a quem opera o ambiente.</p>
  <ul v-if="items.length > 0" data-testid="workspaces">
    <li v-for="workspace in items" :key="workspace.workspaceId">
      <RouterLink :to="{ name: 'customers', params: { workspaceId: workspace.workspaceId } }" data-testid="workspace">
        {{ workspace.alias ?? 'Sem código' }}<span class="sr-only"> ({{ workspace.workspaceId }})</span>
      </RouterLink>
    </li>
  </ul>
  <button v-if="more" type="button" class="secondary" data-testid="load-more" :aria-disabled="busy" @click="loadMore">Carregar mais</button>
</template>
