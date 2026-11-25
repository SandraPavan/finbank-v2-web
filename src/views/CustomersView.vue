<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { Customer, IssuedCredential } from '../api/api';
import ModalDialog from '../components/ModalDialog.vue';
import ProblemMessage from '../components/ProblemMessage.vue';
import { useSession } from '../session/session';
import { usePages } from '../support/pages';
import { type Problem, useProblemHandler } from '../support/problems';

const props = defineProps<{ workspaceId: string }>();
const session = useSession();
const handle = useProblemHandler();
const { items, more, loaded, problem, busy, loadMore } = usePages((offset) => session.api.customers(props.workspaceId, offset));

const alias = ref<string | null>(null);
/** Estados alterados nesta tela, por cliente. */
const changed = ref<Record<string, Customer['status']>>({});
const pending = shallowRef<{ action: 'disable' | 'reset'; customer: Customer } | null>(null);
const working = ref(false);
const actionProblem = ref<Problem | null>(null);
/** Única cópia na tela: some ao fechar, navegar ou sair. */
const issued = shallowRef<IssuedCredential | null>(null);
const copied = ref(false);
const copyButton = ref<HTMLButtonElement | null>(null);
let alive = true;

onMounted(async () => {
  try {
    const found = await session.api.workspace(props.workspaceId);
    alias.value = found.alias;
  } catch {
    // A listagem, feita em paralelo, mostra a falha.
  }
});
onUnmounted(() => {
  alive = false;
  issued.value = null;
});

const statusOf = (customer: Customer): Customer['status'] => changed.value[customer.customerId] ?? customer.status;

function ask(action: 'disable' | 'reset', customer: Customer): void {
  actionProblem.value = null;
  pending.value = { action, customer };
}

async function perform(work: () => Promise<void>): Promise<void> {
  if (working.value) {
    return;
  }
  working.value = true;
  actionProblem.value = null;
  try {
    await work();
  } catch (error) {
    pending.value = null;
    actionProblem.value = await handle(error);
  } finally {
    working.value = false;
  }
}

function setStatus(customer: Customer, status: Customer['status']): Promise<void> {
  return perform(async () => {
    const current = await session.api.setCustomerStatus(props.workspaceId, customer.customerId, status);
    changed.value = { ...changed.value, [customer.customerId]: current };
    pending.value = null;
  });
}

async function toggle(customer: Customer): Promise<void> {
  if (statusOf(customer) === 'ACTIVE') {
    ask('disable', customer);
  } else {
    await setStatus(customer, 'ACTIVE');
  }
}

async function confirm(): Promise<void> {
  const request = pending.value;
  if (request === null) {
    return;
  }
  if (request.action === 'disable') {
    await setStatus(request.customer, 'DISABLED');
    return;
  }
  await perform(async () => {
    const credential = await session.api.resetCustomerPassword(props.workspaceId, request.customer.customerId);
    if (alive) {
      issued.value = credential;
      copied.value = false;
      await nextTick();
      copyButton.value?.focus();
    }
  });
}

function close(): void {
  pending.value = null;
  issued.value = null;
}

async function copy(): Promise<void> {
  if (issued.value !== null) {
    try {
      await navigator.clipboard.writeText(issued.value.temporaryCredential);
      copied.value = true;
    } catch {
      copied.value = false;
    }
  }
}

const when = (iso: string): string => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
</script>

<template>
  <h1 tabindex="-1">Clientes</h1>
  <p v-if="alias !== null" data-testid="alias">Turma: {{ alias }}</p>
  <ProblemMessage :problem="problem" />
  <ProblemMessage :problem="actionProblem" />
  <p v-if="loaded && items.length === 0" data-testid="empty">Nenhum cliente neste workspace.</p>
  <table v-if="items.length > 0" data-testid="customers">
    <caption class="sr-only">Clientes do workspace</caption>
    <thead>
      <tr><th scope="col">E-mail</th><th scope="col">Estado</th><th scope="col">Ações</th></tr>
    </thead>
    <tbody>
      <tr v-for="customer in items" :key="customer.customerId" data-testid="customer">
        <th scope="row">{{ customer.email }}</th>
        <td data-testid="customer-status">{{ statusOf(customer) === 'ACTIVE' ? 'Ativo' : 'Desativado' }}</td>
        <td>
          <div class="actions">
            <button type="button" class="secondary" data-testid="toggle-status" @click="toggle(customer)">
              {{ statusOf(customer) === 'ACTIVE' ? 'Desativar' : 'Reativar' }}<span class="sr-only"> {{ customer.email }}</span>
            </button>
            <button type="button" class="secondary" data-testid="issue-credential" @click="ask('reset', customer)">
              Emitir credencial temporária<span class="sr-only"> para {{ customer.email }}</span>
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
  <button v-if="more" type="button" class="secondary" data-testid="load-more" :aria-disabled="busy" @click="loadMore">Carregar mais</button>
  <p><RouterLink :to="{ name: 'workspaces' }" data-testid="workspaces-link">Voltar para workspaces</RouterLink></p>

  <ModalDialog v-if="pending !== null" :title="issued !== null ? 'Credencial temporária' : 'Confirmar'" :busy="working" @close="close">
    <template v-if="issued === null">
      <p v-if="pending.action === 'disable'">Desativar {{ pending.customer.email }}? As sessões serão encerradas.</p>
      <p v-else>Emitir credencial para {{ pending.customer.email }}? A senha e as sessões atuais deixam de valer agora.</p>
      <div class="actions">
        <button type="button" data-testid="confirm" :aria-disabled="working" @click="confirm">Confirmar</button>
        <button type="button" class="secondary" data-testid="cancel" :aria-disabled="working" @click="working || close()">Cancelar</button>
      </div>
    </template>
    <template v-else>
      <p class="credential" data-testid="credential">{{ issued.temporaryCredential }}</p>
      <p role="status">Copie agora: ela não será mostrada de novo. Vale até {{ when(issued.expiresAt) }}.</p>
      <div class="actions">
        <button ref="copyButton" type="button" data-testid="copy" @click="copy">{{ copied ? 'Copiada' : 'Copiar' }}</button>
        <button type="button" class="secondary" data-testid="close" @click="close">Fechar</button>
      </div>
    </template>
  </ModalDialog>
</template>
