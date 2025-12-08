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
  import {
    computed,
    inject,
    onMounted,
    onUnmounted,
    reactive,
    ref,
    toRaw,
    watch,
  } from 'vue';
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
  import type { XplanBoxService, PlanQuery } from './xplanAPI.js';
  import type { XplanPlugin } from './index.js';
  import { name } from '../package.json';
  import type { Rechtsstand } from './defaultOptions.js';
  import {
    bplanFilterWindowId,
    getEmptyFilter,
    RECHTSSTAND_NAME,
  } from './defaultOptions.js';

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
  const createFeatureSession = ref<
    CreateFeatureSession<GeometryType.BBox> | undefined
  >();
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
    createFeatureSession.value?.stop();
    app.layers.remove(layer);
    layer.deactivate();
    layer.destroy();
  });

  function createResetAction(type: 'attribute' | 'spatial'): VcsAction {
    return {
      name: 'xplan.filter.reset',
      title: 'xplan.filter.reset',
      icon: '$vcsReturn',
      callback(): void {
        const emptyFilter = getEmptyFilter(plugin.config);
        if (type === 'spatial') {
          filterOptions.value.bbox = emptyFilter.bbox;
          layer.removeAllFeatures();
        } else if (type === 'attribute') {
          const currentBBox = structuredClone(toRaw(filterOptions.value.bbox));
          filterOptions.value = { ...emptyFilter, bbox: currentBBox };
        }
      },
    };
  }
  const spatialFilterAction = reactive<VcsAction>({
    name: 'xplan.filter.spatial',
    title: 'xplan.filter.spatial',
    icon: '$vcsBoundingBox',
    active: !!createFeatureSession.value,
    callback(): void {
      if (createFeatureSession.value) {
        createFeatureSession.value?.stop();
        createFeatureSession.value = undefined;
      } else {
        layer.removeAllFeatures();
        filterOptions.value.bbox = undefined;
        createFeatureSession.value = startCreateFeatureSession(
          app,
          layer,
          GeometryType.BBox,
        );
        createFeatureSession.value.creationFinished.addEventListener((f) => {
          const coordinates = f?.getGeometry()?.getExtent();
          if (coordinates) {
            filterOptions.value.bbox = {
              coordinates,
              projection: mercatorProjection.toJSON(),
            };
          }
          createFeatureSession.value?.stop();
          createFeatureSession.value = undefined;
        });
      }
    },
  });

  watch(createFeatureSession, () => {
    spatialFilterAction.active = !!createFeatureSession.value;
  });

  const spatialHeaderActions: VcsAction[] = [
    spatialFilterAction,
    createResetAction('spatial'),
  ];

  const rechtsstandStructure: Record<XplanBoxService, Rechtsstand[]> = {
    pre: ['1000', '2000', '2100', '2200', '2250', '2300', '2400'],
    current: ['3000', '4000', '4500', '45000', '45001'],
    archive: ['5000', '50000', '50001'],
  };
  const rechtsstandItems = plugin.config.xplanBoxServices.map((key) => ({
    value: key,
    title: `xplan.bplans.${key}`,
  }));

  const rechtsstandIsAllSelected = computed(
    () =>
      filterOptions.value.rechtsstand &&
      filterOptions.value.rechtsstand.length >=
        plugin.config.xplanBoxServices.flatMap(
          (service) => rechtsstandStructure[service],
        ).length,
  );

  function selectAllRechtsstand(): void {
    if (rechtsstandIsAllSelected.value) {
      filterOptions.value.rechtsstand = [];
    } else {
      filterOptions.value.rechtsstand = [
        ...plugin.config.xplanBoxServices.flatMap(
          (service) => rechtsstandStructure[service],
        ),
      ];
    }
  }

  const selectedRechtsstand = computed({
    get(): XplanBoxService[] {
      const selected: XplanBoxService[] = [];
      const buckets = new Map<XplanBoxService, Rechtsstand[]>();
      filterOptions.value.rechtsstand?.forEach((value) => {
        (Object.keys(rechtsstandStructure) as XplanBoxService[]).forEach(
          (key) => {
            if (rechtsstandStructure[key].includes(value as Rechtsstand)) {
              if (buckets.has(key)) {
                buckets.get(key)?.push(value as Rechtsstand);
              } else {
                buckets.set(key, [value as Rechtsstand]);
              }
            }
          },
        );
      });
      buckets.forEach((value, key) => {
        if (value.length === rechtsstandStructure[key].length) {
          selected.push(key);
        }
      });
      return selected;
    },
    set(value: XplanBoxService[]) {
      const rechtsstaende: Rechtsstand[] = [];
      value.forEach((service) => {
        rechtsstaende.push(...rechtsstandStructure[service]);
      });
      filterOptions.value.rechtsstand = rechtsstaende;
    },
  });

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
  <div>
    <VcsFormSection
      heading="xplan.filter.spatial"
      :header-actions="spatialHeaderActions"
    >
      <VcsExtent
        v-if="filterOptions.bbox"
        v-model="filterOptions.bbox"
        disabled
      />
      <div v-else class="pa-2">
        {{ $st('xplan.filter.spatialDescription') }}
      </div>
    </VcsFormSection>
    <VcsFormSection
      heading="xplan.filter.attribute"
      :header-actions="[createResetAction('attribute')]"
    >
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
            <VcsLabel html-for="xplan-filter-rechtsstand"
              >{{ $st('xplan.filter.rechtsstand') }}
              <template #help>
                <div
                  v-for="(service, index) in plugin.config.xplanBoxServices"
                  :key="service"
                >
                  <h3>{{ $st(`xplan.bplans.${service}`) }}:</h3>
                  <ul>
                    <li
                      v-for="rechtsstand in rechtsstandStructure[service]"
                      :key="rechtsstand"
                    >
                      {{ RECHTSSTAND_NAME[rechtsstand] }}
                    </li>
                  </ul>
                  <br
                    v-if="index !== plugin.config.xplanBoxServices.length - 1"
                  />
                </div>
              </template>
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              id="xplan-filter-rechtsstand"
              v-model="selectedRechtsstand"
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
  </div>
</template>
