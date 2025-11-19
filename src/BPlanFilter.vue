<script setup lang="ts">
  import type { VcsAction, VcsUiApp } from '@vcmap/ui';
  import {
    getDefaultPrimaryColor,
    NotificationType,
    VcsCheckbox,
    VcsDatePicker,
    VcsExtent,
    VcsFormButton,
    VcsFormSection,
    VcsLabel,
    VcsSelect,
    VcsTextField,
  } from '@vcmap/ui';
  import { computed, inject, onMounted, onUnmounted, ref, toRaw } from 'vue';
  import {
    VContainer,
    VDivider,
    VRow,
    VCol,
    VListItem,
  } from 'vuetify/components';
  import type { CreateFeatureSession } from '@vcmap/core';
  import {
    alreadyTransformedToMercator,
    GeometryType,
    mercatorProjection,
    startCreateFeatureSession,
    VectorLayer,
    VectorStyleItem,
  } from '@vcmap/core';
  import { Color } from '@vcmap-cesium/engine';
  import Feature from 'ol/Feature.js';
  import { Polygon } from 'ol/geom.js';
  import { getLogger } from '@vcsuite/logger';
  import { type PlanQuery } from './xplanAPI.js';
  import type { XplanPlugin } from './index.js';
  import { name } from '../package.json';
  import { bplanFilterWindowId, getEmptyFilter } from './defaultOptions.js';

  const app = inject<VcsUiApp>('vcsApp')!;
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  const filterOptions = ref<PlanQuery>(
    plugin.getOverviewFilter() || getEmptyFilter(plugin.config),
  );
  const color = app.uiConfig.config.primaryColor || getDefaultPrimaryColor(app);
  const layer = new VectorLayer({
    name: 'xplan-spatial-query-layer',
    projection: mercatorProjection.toJSON(),
    style: new VectorStyleItem({
      fill: {
        color: Color.fromCssColorString(color)
          .withAlpha(0.3)
          .toCssColorString(),
      },
      stroke: {
        color,
        width: 2,
      },
    }),
  });
  let createFeatureSession: CreateFeatureSession<GeometryType.BBox> | undefined;
  const loading = ref(false);

  onMounted(async () => {
    app.layers.add(layer);
    const coordinates = filterOptions.value.bbox?.coordinates;
    if (coordinates) {
      const geometry = new Polygon([
        [
          [coordinates[0], coordinates[1]],
          [coordinates[0], coordinates[3]],
          [coordinates[2], coordinates[3]],
          [coordinates[2], coordinates[1]],
          [coordinates[0], coordinates[1]],
        ],
      ]);
      geometry.set('_vcsGeomType', GeometryType.BBox);
      geometry[alreadyTransformedToMercator] = true;
      layer.addFeatures([new Feature(geometry)]);
    }
    await layer.activate();
  });
  onUnmounted(() => {
    createFeatureSession?.stop();
    app.layers.remove(layer);
    layer.deactivate();
    layer.destroy();
  });

  const headerActions: VcsAction[] = [
    {
      name: 'xplan.filter.spatial',
      title: 'xplan.filter.spatial',
      icon: '$vcsBoundingBox',
      callback(): void {
        layer.removeAllFeatures();
        filterOptions.value.bbox = undefined;
        createFeatureSession = startCreateFeatureSession(
          app,
          layer,
          GeometryType.BBox,
        );
        createFeatureSession.creationFinished.addEventListener((f) => {
          const coordinates = f?.getGeometry()?.getExtent();
          if (coordinates) {
            filterOptions.value.bbox = {
              coordinates,
              projection: mercatorProjection.toJSON(),
            };
          }
          createFeatureSession?.stop();
          createFeatureSession = undefined;
        });
      },
    },
    {
      name: 'xplan.filter.reset',
      title: 'xplan.filter.reset',
      icon: '$vcsReturn',
      callback(): void {
        filterOptions.value = getEmptyFilter(plugin.config);
        layer.removeAllFeatures();
      },
    },
  ];

  const rechtsstandItems = [
    { value: '1000', title: 'Aufstellungsbeschluss' },
    { value: '2000', title: 'Entwurf' },
    { value: '2100', title: 'FruehzeitigeBehoerdenBeteiligung' },
    { value: '2200', title: 'FruehzeitigeOeffentlichkeitsBeteiligung' },
    { value: '2300', title: 'BehoerdenBeteiligung' },
    { value: '2400', title: 'OeffentlicheAuslegung' },
    { value: '3000', title: 'Satzung' },
    { value: '4000', title: 'InkraftGetreten' },
    { value: '4500', title: 'TeilweiseUntergegangen' },
    { value: '5000', title: 'Untergegangen' },
  ];

  const rechtsstandIsAllSelected = computed(
    () => filterOptions.value.rechtsstand?.length === rechtsstandItems.length,
  );

  function selectAllRechtsstand(): void {
    if (rechtsstandIsAllSelected.value) {
      filterOptions.value.rechtsstand = [];
    } else {
      filterOptions.value.rechtsstand = rechtsstandItems.map((i) => i.value);
    }
  }

  async function sendRequest(): Promise<void> {
    if (
      plugin.config.xplanBoxServices?.length === 0 ||
      !plugin.config.xplanBoxUrl
    ) {
      throw new Error('wfs urls are missing!');
    }

    try {
      loading.value = true;
      await plugin.setOverviewFilter(toRaw(filterOptions.value));

      app.windowManager.remove(bplanFilterWindowId);
    } catch (error) {
      app.notifier.add({
        type: NotificationType.ERROR,
        message: 'xplan.administration.error.requestPlans',
      });
      getLogger(name).error(
        'Failed to request plans with following error: ',
        error,
      );
    } finally {
      loading.value = false;
    }
  }
</script>

<template>
  <VcsFormSection
    heading="xplan.filter.heading"
    :header-actions="headerActions"
  >
    <template v-if="filterOptions.bbox">
      <VcsExtent v-model="filterOptions.bbox" disabled />
      <v-divider />
    </template>
    <v-container class="px-1 py-0">
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="xplan-filter-gemeinde">{{
            $st('xplan.filter.gemeinde')
          }}</VcsLabel>
        </v-col>
        <v-col>
          <VcsTextField
            id="xplan-filter-gemeinde"
            v-model="filterOptions.gemeinde"
            :placeholder="$st('xplan.filter.gemeindePlaceholder')"
            clearable
            @keyup.enter="sendRequest"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="xplan-filter-number">{{
            $st('xplan.filter.number')
          }}</VcsLabel>
        </v-col>
        <v-col>
          <VcsTextField
            id="xplan-filter-number"
            v-model="filterOptions.number"
            :placeholder="$st('xplan.filter.numberPlaceholder')"
            clearable
            @keyup.enter="sendRequest"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="xplan-filter-name">{{
            $st('xplan.filter.name')
          }}</VcsLabel>
        </v-col>
        <v-col>
          <VcsTextField
            id="xplan-filter-name"
            v-model="filterOptions.name"
            :placeholder="$st('xplan.filter.namePlaceholder')"
            clearable
            @keyup.enter="sendRequest"
          />
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsLabel html-for="xplan-filter-rechtsstand">{{
            $st('xplan.filter.rechtsstand')
          }}</VcsLabel>
        </v-col>
        <v-col>
          <VcsSelect
            id="xplan-filter-rechtsstand"
            v-model="filterOptions.rechtsstand"
            :items="rechtsstandItems"
            multiple
            :placeholder="$st('xplan.filter.rechtsstandPlaceholder')"
          >
            <template #prepend-item>
              <v-list-item
                :title="$st('xplan.filter.selectAll')"
                @click="selectAllRechtsstand"
              >
                <template #prepend>
                  <VcsCheckbox
                    :model-value="rechtsstandIsAllSelected"
                    class="py-0 pr-1"
                  />
                </template>
              </v-list-item>
              <v-divider />
            </template>
          </VcsSelect>
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col>
          <VcsCheckbox
            :model-value="!!filterOptions.inkrafttretensDatum"
            label="xplan.filter.inkrafttretensDatum"
            @update:model-value="
              (v: boolean) => {
                if (v) {
                  filterOptions.inkrafttretensDatum = new Date();
                } else {
                  filterOptions.inkrafttretensDatum = undefined;
                }
              }
            "
          />
        </v-col>
        <v-col>
          <VcsDatePicker
            v-model="filterOptions.inkrafttretensDatum"
            :disabled="!filterOptions.inkrafttretensDatum"
          />
        </v-col>
      </v-row>
    </v-container>
    <v-divider />
    <div class="d-flex align-center justify-end px-2 pb-1 pt-2">
      <VcsFormButton
        :loading="loading"
        variant="filled"
        class="mr-2"
        @click="sendRequest"
      >
        {{ $st('xplan.filter.apply') }}</VcsFormButton
      >
      <VcsFormButton @click="app.windowManager.remove(bplanFilterWindowId)">
        {{ $st('xplan.filter.cancel') }}</VcsFormButton
      >
    </div>
  </VcsFormSection>
</template>
