<script setup lang="ts">
  import { VIcon, VSheet } from 'vuetify/components';
  import { VcsFormSection, VcsTable, VcsDataTable } from '@vcmap/ui';
  import type {
    CalculatedHeights,
    HoehenAttributeRow,
    MetricsOfStructuralUse,
    StoreyAttributeRow,
    TypeOfStructuralUse,
  } from './cubeFeatureInfoView';
  import { BEZUGSPUNKT_NAME, HOEHENBEZUG_NAME } from './defaultOptions';

  const props = defineProps<{
    attributes: object;
    featureId: string;
    layerName: string;
    layerProperties: object;
    tags: object;
    calculatedHeights: CalculatedHeights;
    storeyRows: StoreyAttributeRow[];
    hoehenRows: HoehenAttributeRow[];
    metricsOfStructuralUse: MetricsOfStructuralUse;
    typeOfStructuralUse: TypeOfStructuralUse;
  }>();

  const commonHeaders = {
    from: {
      title: 'xplan.featureInfo.from',
      key: 'from',
      value: (v: StoreyAttributeRow | HoehenAttributeRow): string =>
        v.from === 'BP_BaugebietsTeilFlaeche' ? 'BTF' : 'UGF',
      sortable: false,
      width: '12%',
    },
    attribute: {
      title: 'xplan.featureInfo.attribute',
      key: 'attribute',
      sortable: false,
      width: '15%',
    },
    selected: {
      title: 'xplan.featureInfo.selected',
      key: 'selected',
      align: 'center',
      sortable: false,
      width: '80px',
    },
  };

  const rowHeaders = [
    commonHeaders.from,
    commonHeaders.attribute,
    {
      title: 'xplan.featureInfo.value',
      key: 'value',
      sortable: false,
      width: '11%',
    },
    {
      title: 'xplan.featureInfo.bezugspunkt',
      key: 'bezugspunkt',
      value: (v: HoehenAttributeRow): string => BEZUGSPUNKT_NAME[v.bezugspunkt],
      sortable: false,
    },
    {
      title: 'xplan.featureInfo.hoehenbezug',
      key: 'hoehenbezug',
      value: (v: HoehenAttributeRow): string => HOEHENBEZUG_NAME[v.hoehenbezug],
      sortable: false,
    },
    commonHeaders.selected,
  ];

  const storeyHeaders = [
    commonHeaders.from,
    commonHeaders.attribute,
    {
      title: 'xplan.featureInfo.value',
      key: 'value',
      sortable: false,
    },
    commonHeaders.selected,
  ];

  const keyHeader = { key: 'key', width: '50%' };
  const valueHeader = { key: 'value', width: '50%' };
</script>

<template>
  <v-sheet>
    <VcsFormSection heading="xplan.featureInfo.calcHeights">
      <VcsTable
        :attributes="props.calculatedHeights"
        :show-searchbar="false"
        :hide-default-header="true"
        :key-header="keyHeader"
        :value-header="valueHeader"
      />
    </VcsFormSection>
    <VcsFormSection
      v-if="props.hoehenRows.length > 0"
      heading="xplan.featureInfo.hoehenRows"
    >
      <vcs-data-table
        :headers="rowHeaders"
        :items="props.hoehenRows"
        :show-searchbar="false"
        :items-per-page="-1"
        :items-per-page-array="[props.hoehenRows.length]"
      >
        <template #item.selected="{ value }">
          <v-icon v-if="value" size="small" color="success"
            >mdi-check-circle</v-icon
          >
        </template>
      </vcs-data-table>
    </VcsFormSection>
    <VcsFormSection
      v-if="props.storeyRows.length > 0"
      heading="xplan.featureInfo.storeyRows"
    >
      <vcs-data-table
        :headers="storeyHeaders"
        :items="props.storeyRows"
        :show-searchbar="false"
        :items-per-page="-1"
        :items-per-page-array="[props.storeyRows.length]"
      >
        <template #item.selected="{ value }">
          <v-icon v-if="value" size="small" color="success"
            >mdi-check-circle</v-icon
          >
        </template>
      </vcs-data-table>
    </VcsFormSection>
    <VcsFormSection heading="xplan.featureInfo.metricsOfStructuralUse">
      <VcsTable
        :attributes="props.metricsOfStructuralUse"
        :show-searchbar="false"
        :hide-default-header="true"
        :key-header="keyHeader"
        :value-header="valueHeader"
      />
    </VcsFormSection>
    <VcsFormSection heading="xplan.featureInfo.typeOfStructuralUse">
      <VcsTable
        :attributes="props.typeOfStructuralUse"
        :show-searchbar="false"
        :hide-default-header="true"
        :key-header="keyHeader"
        :value-header="valueHeader"
      />
    </VcsFormSection>
  </v-sheet>
</template>

<style scoped>
  :deep(table) {
    width: 100%;
    table-layout: fixed;
  }
</style>
