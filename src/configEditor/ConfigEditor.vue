<script setup lang="ts">
  import type { VcsUiApp } from '@vcmap/ui';
  import {
    AbstractConfigEditor,
    VcsCheckbox,
    VcsFormSection,
    VcsLabel,
    VcsProjection,
    VcsSelect,
    VcsTextField,
  } from '@vcmap/ui';
  import { computed, inject, ref, toRaw, watch } from 'vue';
  import { VContainer, VRow, VCol, VDivider } from 'vuetify/components';
  import type { XplanConfig } from '../defaultOptions.js';
  import {
    BPPlanListAttribute,
    DEFAULT_BEZUGSPUNKT_PRIORITY,
    DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY,
    DEFAULT_STOREY_ATTRIBUTE_PRIORITY,
    getMergedConfig,
    TERRAIN_LEVEL_METHOD_VALUES,
  } from '../defaultOptions.js';
  import { XPLAN_BOX_SERVICES } from '../xplanAPI.js';
  import {
    predefinedStyles,
    defaultStyles,
    getAllCubeStyles,
  } from '../cubeStyles.js';
  import PriorityList from './PriorityList.vue';
  import VegetationSettings from './VegetationSettings.vue';

  const app = inject<VcsUiApp>('vcsApp')!;

  const props = defineProps<{
    getConfig: () => XplanConfig;
    setConfig: (config: XplanConfig) => void;
  }>();

  const config = props.getConfig();
  const localConfig = ref<XplanConfig>(getMergedConfig(config));
  const allCubeStyles = getAllCubeStyles();
  const additionalStyleItems = [...app.styles]
    .filter((s) => !allCubeStyles.map((style) => style.name).includes(s.name))
    .map((s) => ({ value: s.name, title: s.properties?.title || s.name }));
  const defaultStyleItems = computed(() => {
    return [
      ...getAllCubeStyles().map((s) => ({
        value: s.name!,
        title: s.properties?.title || s.name,
      })),
      ...localConfig.value.additionalStyles3d.map((styleName) => {
        const item = app.styles.getByKey(styleName)!;
        return {
          value: item.name,
          title: item.properties.title || item.name,
        };
      }),
    ];
  });
  watch(
    () => localConfig.value.additionalStyles3d,
    (value) => {
      localConfig.value.xplanBoxServices.forEach((service) => {
        if (
          ![...value, ...predefinedStyles.map((s) => s.name)].includes(
            localConfig.value.defaultStyle3d[service],
          )
        ) {
          localConfig.value.defaultStyle3d[service] =
            defaultStyles[service].name!;
        }
      });
    },
  );

  const requiredRule = (v?: string | number): true | string => {
    if (v === null || v === undefined) {
      return 'components.validation.required';
    }
    if (Array.isArray(v)) {
      return v.length > 0 || 'components.validation.required';
    }
    if (typeof v === 'number') {
      return !Number.isNaN(v) || 'components.validation.required';
    }
    return v.trim().length > 0 || 'components.validation.required';
  };

  const positiveNumberRule = (v?: string | number): true | string => {
    if (v === null || v === undefined || v === '') {
      return 'components.validation.required';
    }
    const num = Number(v);
    if (Number.isNaN(num)) {
      return 'xplan.editor.validation.number';
    }
    return num > 0 || 'xplan.editor.validation.positive';
  };

  const submit = (): void => {
    const c = structuredClone(toRaw(localConfig.value));
    c.xplanBoxServices.sort((a, b) => {
      return XPLAN_BOX_SERVICES.indexOf(a) - XPLAN_BOX_SERVICES.indexOf(b);
    });
    props.setConfig(c);
  };
</script>

<template>
  <AbstractConfigEditor
    v-if="localConfig"
    v-bind="{ ...$attrs, ...$props }"
    @submit="submit"
  >
    <VcsFormSection heading="appConfigurator.settings.general.title">
      <v-container class="py-0 px-1">
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-backend">
              {{ $st('xplan.editor.backend') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              id="xplan-editor-backend"
              :model-value="'xPlanBox'"
              :items="['xPlanBox']"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-url" required>
              {{ $st('xplan.editor.url') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsTextField
              id="xplan-editor-url"
              v-model="localConfig.xplanBoxUrl"
              clearable
              :placeholder="$st('xplan.editor.urlPlaceholder')"
              :rules="[requiredRule]"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-services" required>
              {{ $st('xplan.editor.services') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              id="xplan-editor-services"
              v-model="localConfig.xplanBoxServices"
              :items="
                XPLAN_BOX_SERVICES.map((i) => ({
                  value: i,
                  title: `xplan.bplans.${i}`,
                }))
              "
              multiple
              :placeholder="$st('xplan.editor.servicesPlaceholder')"
              :rules="[requiredRule]"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-listAttribute">
              {{ $st('xplan.editor.listAttribute') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              id="xplan-editor-listAttribute"
              v-model="localConfig.bpPlanListAttribute"
              :items="Object.values(BPPlanListAttribute)"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col>
            <VcsCheckbox
              v-model="localConfig.filterInitiallyOpen"
              label="xplan.editor.filterInitiallyOpen"
            />
          </v-col>
        </v-row>
      </v-container>
    </VcsFormSection>
    <VcsFormSection heading="xplan.editor.crs">
      <VcsProjection
        v-model="localConfig.projection"
        required
        hide-alias
        class="px-1 py-0"
        :rules="[requiredRule]"
      />
    </VcsFormSection>
    <VcsFormSection heading="xplan.editor.settings3d">
      <v-container class="px-1 py-0">
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-additionalStyles3d">
              {{ $st('xplan.editor.additionalStyles3d') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              v-model="localConfig.additionalStyles3d"
              :items="additionalStyleItems"
              multiple
              :placeholder="$st('xplan.editor.additionalStyles3dPlaceholder')"
            />
          </v-col>
        </v-row>
        <v-row
          v-for="service in localConfig.xplanBoxServices"
          :key="service"
          no-gutters
        >
          <v-col>
            <VcsLabel :html-for="`xplan-editor-defaultStyle3d-${service}`">
              {{ $st('xplan.editor.defaultStyle3d') }}:
              {{ $st(`xplan.bplans.${service}`) }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              :id="`xplan-editor-defaultStyle3d-${service}`"
              v-model="localConfig.defaultStyle3d[service]"
              :items="defaultStyleItems"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-defaultStoreyHeight" required>
              {{ $st('xplan.editor.defaultStoreyHeight') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsTextField
              id="xplan-editor-defaultStoreyHeight"
              v-model="localConfig.cubeCreationOptions.defaultStoreyHeight"
              clearable
              :placeholder="$st('xplan.editor.defaultStoreyHeightPlaceholder')"
              type="number"
              unit="m"
              :rules="[positiveNumberRule]"
            />
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="xplan-editor-terrainLevelMethod">
              {{ $st('xplan.editor.terrainLevelMethod') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              v-model="localConfig.cubeCreationOptions.terrainLevelMethod"
              :items="
                TERRAIN_LEVEL_METHOD_VALUES.map((i) => ({
                  value: i,
                  title: `xplan.editor.${i}`,
                }))
              "
            />
          </v-col>
        </v-row>
      </v-container>
    </VcsFormSection>
    <VegetationSettings v-model="localConfig.vegetationCreationOptions" />
    <VcsFormSection heading="xplan.editor.extendedSettings3d" expandable>
      <v-container class="px-1 py-0">
        <v-row no-gutters>
          <v-col>
            <PriorityList
              v-model="localConfig.cubeCreationOptions.heightAttributePriority"
              title="xplan.editor.heightPriority"
              :default-priority="DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY"
            />
          </v-col>
        </v-row>
      </v-container>
      <v-divider />
      <v-container class="px-1 py-0">
        <v-row no-gutters>
          <v-col>
            <PriorityList
              v-model="localConfig.cubeCreationOptions.bezugspunktPriority"
              title="xplan.editor.bezugspunktPriority"
              :default-priority="DEFAULT_BEZUGSPUNKT_PRIORITY"
            />
          </v-col>
        </v-row>
      </v-container>
      <v-divider />
      <v-container class="px-1 py-0">
        <v-row no-gutters>
          <v-col>
            <PriorityList
              v-model="localConfig.cubeCreationOptions.storeyAttributePriority"
              title="xplan.editor.storeyPriority"
              :default-priority="DEFAULT_STOREY_ATTRIBUTE_PRIORITY"
            />
          </v-col>
        </v-row>
      </v-container>
    </VcsFormSection>
  </AbstractConfigEditor>
</template>
