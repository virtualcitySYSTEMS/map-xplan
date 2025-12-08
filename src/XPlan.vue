<script setup lang="ts">
  import { inject, onMounted, onUnmounted, watch } from 'vue';
  import {
    VSheet,
    VTabs,
    VTab,
    VTabsWindow,
    VTabsWindowItem,
    VTooltip,
  } from 'vuetify/components';
  import type { VcsUiApp } from '@vcmap/ui';
  import { VectorStyleItem } from '@vcmap/core';
  import XPlanOverview from './XPlanOverview.vue';
  import XPlanAddedPlans from './XPlanAddedPlans.vue';
  import type { XplanPlugin } from './index.js';
  import { name } from '../package.json';
  import { bplanFilterWindowId } from './defaultOptions.js';
  import { getDefaultPlanStyle } from './layerHelper.js';

  const app = inject<VcsUiApp>('vcsApp')!;
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  function updateStyle(isOverview: boolean): void {
    plugin.config.xplanBoxServices.forEach((service) => {
      const style = getDefaultPlanStyle(service, isOverview);
      const layer = plugin.getLayerForService(service);
      layer.setStyle(new VectorStyleItem(style));
    });
  }

  onMounted(() => {
    if (plugin.currentTab.value === 'overview') {
      plugin.planLayers.forEach((l) => {
        l.visibility = true;
      });
      updateStyle(true);
    }
  });

  watch(plugin.currentTab, () => {
    plugin.planLayers.forEach((layer) => {
      if (plugin.currentTab.value === 'added') {
        layer.visibility = false;
        if (app.windowManager.has(bplanFilterWindowId)) {
          app.windowManager.remove(bplanFilterWindowId);
        }
        updateStyle(false);
      } else {
        layer.visibility = true;
        updateStyle(true);
      }
    });
  });

  onUnmounted(() => {
    plugin.planLayers.forEach((l) => {
      l.visibility = false;
    });
    updateStyle(false);
  });
</script>

<template>
  <v-sheet>
    <v-tabs
      v-model="plugin.currentTab.value"
      density="compact"
      fixed-tabs
      color="primary"
    >
      <v-tab value="overview"
        >{{ $st('xplan.bplans.overview')
        }}<v-tooltip activator="parent" location="top">
          {{ $st('xplan.bplans.overviewTooltip') }}
        </v-tooltip></v-tab
      >
      <v-tab value="added">{{ $st('xplan.bplans.added') }}</v-tab>
    </v-tabs>
    <v-tabs-window v-model="plugin.currentTab.value">
      <v-tabs-window-item value="overview">
        <XPlanOverview />
      </v-tabs-window-item>
      <v-tabs-window-item value="added">
        <XPlanAddedPlans />
      </v-tabs-window-item>
    </v-tabs-window>
  </v-sheet>
</template>
