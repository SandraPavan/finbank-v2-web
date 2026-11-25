import { onMounted, onUnmounted, type Ref, ref, shallowRef } from 'vue';
import type { Page } from '../api/api';
import { type Problem, useProblemHandler } from './problems';

export interface PagedList<T> {
  readonly items: Ref<readonly T[]>;
  readonly more: Ref<boolean>;
  readonly loaded: Ref<boolean>;
  readonly problem: Ref<Problem | null>;
  readonly busy: Ref<boolean>;
  loadMore(): Promise<void>;
}

/** Lista paginada da API; respostas que chegam depois de a tela sair são descartadas. */
export function usePages<T>(fetchPage: (offset: number) => Promise<Page<T>>): PagedList<T> {
  const items = shallowRef<readonly T[]>([]);
  const next = ref<number | null>(0);
  const more = ref(false);
  const loaded = ref(false);
  const busy = ref(false);
  const problem = ref<Problem | null>(null);
  const handle = useProblemHandler();
  let alive = true;

  async function loadMore(): Promise<void> {
    if (busy.value || next.value === null) {
      return;
    }
    busy.value = true;
    problem.value = null;
    try {
      const page = await fetchPage(next.value);
      if (alive) {
        items.value = [...items.value, ...page.items];
        next.value = page.nextOffset;
        more.value = page.nextOffset !== null;
        loaded.value = true;
      }
    } catch (error) {
      if (alive) {
        const shown = await handle(error);
        problem.value = shown;
        more.value = shown !== null;
      }
    } finally {
      busy.value = false;
    }
  }

  onMounted(loadMore);
  onUnmounted(() => {
    alive = false;
  });
  return { items, more, loaded, problem, busy, loadMore };
}
