<script setup lang="ts">
  import { inject, ref } from 'vue';
  import { VSheet, VDivider, VIcon } from 'vuetify/components';
  import type { VcsUiApp, VcsAction } from '@vcmap/ui';
  import { VcsRadio, VcsActionButtonList } from '@vcmap/ui';
  import type { Collection, VectorLayer } from '@vcmap/core';
  import { name } from '../package.json';
  import type { XplanPlugin } from './index.js';
  import type { Plan, XplanBoxService } from './xplanAPI.js';
  import { predefinedStyles, defaultStyles } from './cubeStyles.js';

  const app = inject<VcsUiApp>('vcsApp')!;
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  const props = defineProps<{ service: XplanBoxService }>();
  const emit = defineEmits(['close']);

  function getRadioItems(): { value: string; label: string }[] {
    const additionalStyles = plugin.config.additionalStyles3d
      .map((styleName) => app.styles.getByKey(styleName))
      .filter((s) => !!s);
    return [
      defaultStyles[props.service],
      ...predefinedStyles,
      ...additionalStyles,
    ].map((style) => ({
      value: style.name!,
      label: (style.properties?.title as string) || style.name!,
    }));
  }

  function getLayers3d(): VectorLayer[] {
    const collection = plugin.addedPlansCollectionManager?.get(props.service)
      ?.collection as Collection<Plan> | undefined;
    if (!collection) {
      return [];
    }
    return [...collection]
      .map(
        (plan) =>
          app.layers.getByKey(`${plan.getId()}_3d`) as VectorLayer | undefined,
      )
      .filter((layer) => !!layer);
  }

  function getCommonStyle(layers: VectorLayer[]): string | undefined {
    const styleNames = layers.map((l) => l.style.name);
    const styleSet = new Set(styleNames);
    return styleSet.size <= 1 ? styleSet.values().next().value : undefined;
  }

  const radioItems = getRadioItems();
  const layers3d = getLayers3d();
  const commonStyle = ref(getCommonStyle(layers3d));

  function setStyle(styleName: string): void {
    const style = app.styles.getByKey(styleName);
    if (style) {
      layers3d.forEach((l) => {
        l.setStyle(style);
      });
    }
    emit('close');
  }

  const actions: VcsAction[] = [
    {
      name: 'components.close',
      title: 'components.close',
      icon: 'mdi-close-thick',
      callback(): void {
        emit('close');
      },
    },
  ];
</script>

<template>
  <v-sheet>
    <div class="py-2 px-2 d-flex justify-space-between">
      <h3 class="d-flex align-center text-primary">
        <v-icon class="mr-1 text-primary"> mdi-palette-swatch-variant </v-icon>
        <span class="font-weight-bold">
          {{ $st(`xplan.bplans.${props.service}`) }}:
          {{ $st(`xplan.bplans.styleAll3d`) }}
        </span>
      </h3>
      <VcsActionButtonList :actions="actions" />
    </div>
    <v-divider />
    <VcsRadio
      :model-value="commonStyle"
      :items="radioItems"
      class="pa-2"
      @update:model-value="setStyle"
    />
  </v-sheet>
</template>
