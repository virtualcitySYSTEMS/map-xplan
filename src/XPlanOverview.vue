<script setup lang="ts">
  import type { VcsAction, VcsUiApp } from '@vcmap/ui';
  import {
    CollectionManagerComponent,
    VcsActionButtonList,
    VcsTreeviewSearchbar,
  } from '@vcmap/ui';
  import { inject, onMounted, onUnmounted, provide, reactive, ref } from 'vue';
  import { getLogger } from '@vcsuite/logger';
  import type { XplanPlugin } from './index.js';
  import { name } from '../package.json';
  import { getFilterWindowComponent } from './createNavbarButton.js';
  import {
    bplanFilterWindowId,
    BPPlanListAttribute,
  } from './defaultOptions.js';

  const FILTER_DEBOUNCE = 400;

  const app = inject<VcsUiApp>('vcsApp')!;
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  const searchKey =
    plugin.config.bpPlanListAttribute === BPPlanListAttribute.NUMMER
      ? 'number'
      : 'name';
  const search = ref(plugin.getOverviewFilter()?.name);
  const searchLoading = ref(false);
  const searchbarWrapperRef = ref<HTMLElement | null>(null);

  provide('collectionManager', plugin.overviewCollectionManager);

  const filterAction: VcsAction = reactive({
    name: 'xplan.filter.heading',
    title: 'xplan.filter.heading',
    icon: 'mdi-filter',
    active: app.windowManager.has(bplanFilterWindowId),
    callback(): void {
      if (app.windowManager.has(bplanFilterWindowId)) {
        app.windowManager.remove(bplanFilterWindowId);
      } else {
        app.windowManager.add(getFilterWindowComponent(), name);
      }
    },
  });

  const filterWindowListener = [
    app.windowManager.added.addEventListener((w) => {
      if (w.id === bplanFilterWindowId) {
        filterAction.active = true;
      }
    }),
    app.windowManager.removed.addEventListener((w) => {
      if (w.id === bplanFilterWindowId) {
        filterAction.active = false;
      }
    }),
  ];

  let searchTimeout: NodeJS.Timeout | undefined;
  function updateFilter(value: string): void {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      searchLoading.value = true;
      const query = plugin.getOverviewFilter();
      plugin
        .setOverviewFilter({ ...query, [searchKey]: value })
        .catch(() => {
          getLogger(name).error('setting filter failed');
        })
        .finally(() => {
          searchTimeout = undefined;
          searchLoading.value = false;
        });
    }, FILTER_DEBOUNCE);
  }

  plugin.overviewFilterChanged.addEventListener((query) => {
    if (filterAction.active && search.value !== query[searchKey]) {
      search.value = query[searchKey];
    }
  });

  onUnmounted(() => {
    filterWindowListener.forEach((l) => {
      l();
    });
    clearTimeout(searchTimeout);
  });

  // focus the search bar once mounted so users can immediately start typing
  onMounted(() => {
    const input = searchbarWrapperRef.value?.querySelector(
      'input',
    ) as HTMLInputElement | null;
    input?.focus();
  });
</script>

<template>
  <div>
    <div ref="searchbarWrapperRef">
      <VcsTreeviewSearchbar
        v-model="search"
        :disabled="filterAction.active"
        :placeholder="`xplan.filter.searchbar${plugin.config.bpPlanListAttribute}`"
        :loading="searchLoading"
        @update:model-value="updateFilter"
      >
        <!-- @vue-ignore component seems to not expose slot typings -->
        <template #append>
          <VcsActionButtonList :actions="[filterAction]" class="ml-2" />
        </template>
      </VcsTreeviewSearchbar>
    </div>
    <CollectionManagerComponent />
  </div>
</template>
