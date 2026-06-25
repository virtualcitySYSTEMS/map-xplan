<script setup lang="ts">
  import {
    computed,
    inject,
    onUnmounted,
    reactive,
    ref,
    toRaw,
    watch,
    watchEffect,
  } from 'vue';
  import {
    createModalAction,
    VcsActionList,
    VcsFormButton,
    VcsFormSection,
    VcsLabel,
    VcsList,
    VcsSelect,
    VcsTextField,
  } from '@vcmap/ui';
  import type { VcsAction, VcsUiApp } from '@vcmap/ui';
  import {
    VCard,
    VCardActions,
    VCardText,
    VCol,
    VContainer,
    VDialog,
    VForm,
    VRow,
    VDivider,
    VIcon,
  } from 'vuetify/components';
  import type {
    Gegenstand,
    VegetationCreationOptions,
    XpRechtsstand,
  } from '../defaultOptions.js';
  import {
    GEGENSTAND_NAME,
    GEGENSTAND_VALUES,
    XP_RECHTSSTAND_NAME,
    XP_RECHTSSTAND_VALUES,
  } from '../defaultOptions.js';
  import { name } from '../../package.json';

  const modelValue = defineModel<VegetationCreationOptions[]>({
    required: true,
  });

  const app = inject<VcsUiApp>('vcsApp')!;

  function createEmptyVegetation(): Partial<VegetationCreationOptions> {
    return {
      gegenstand: undefined,
      modelUrl: undefined,
      rechtsstand: [],
    };
  }

  const isValid = ref(true);
  const editingIndex = ref<number | undefined>();
  const draft = ref<Partial<VegetationCreationOptions> | undefined>();

  const requiredRule = (v?: string | number | unknown[]): true | string => {
    if (v === null || v === undefined) {
      return 'components.validation.required';
    }
    if (Array.isArray(v)) {
      return v.length > 0 || 'components.validation.required';
    }
    if (typeof v === 'string') {
      return v.trim().length > 0 || 'components.validation.required';
    }
    return true;
  };

  function getUnusedRechtsstandForGegenstand(
    gegenstand: Gegenstand,
  ): XpRechtsstand[] {
    const usedRechtsstand = new Set(
      modelValue.value
        .filter(
          (item, index) =>
            item.gegenstand === gegenstand && index !== editingIndex.value,
        )
        .flatMap((item) => item.rechtsstand),
    );
    return XP_RECHTSSTAND_VALUES.filter((value) => !usedRechtsstand.has(value));
  }

  const rechtsstandItems = computed(() => {
    const unusedRechtsstand = draft.value?.gegenstand
      ? getUnusedRechtsstandForGegenstand(draft.value.gegenstand)
      : [...XP_RECHTSSTAND_VALUES];
    return unusedRechtsstand.map((value) => ({
      value,
      title: XP_RECHTSSTAND_NAME[value],
    }));
  });

  const dialogTitle = computed(() => ({
    action:
      editingIndex.value === undefined
        ? 'xplan.editor.add'
        : 'xplan.editor.edit',
    gegenstandName: draft.value?.gegenstand
      ? GEGENSTAND_NAME[draft.value.gegenstand]
      : '',
  }));

  function openAdd(gegenstand: Gegenstand): void {
    editingIndex.value = undefined;
    draft.value = { ...createEmptyVegetation(), gegenstand };
  }

  function openEdit(index: number): void {
    editingIndex.value = index;
    draft.value = structuredClone(toRaw(modelValue.value[index]));
  }

  function closeDialog(): void {
    draft.value = undefined;
    editingIndex.value = undefined;
  }

  function apply(): void {
    if (!isValid.value) {
      return;
    }
    const entry = structuredClone(
      toRaw(draft.value as VegetationCreationOptions),
    );
    if (editingIndex.value === undefined) {
      modelValue.value = [...modelValue.value.map((v) => toRaw(v)), entry];
    } else {
      modelValue.value = modelValue.value
        .toSpliced(editingIndex.value, 1, entry)
        .map((v) => toRaw(v));
    }
    closeDialog();
  }

  const gegenstandSelectActions: VcsAction[] = reactive([]);
  let modalAction: VcsAction | undefined;

  watchEffect(() => {
    gegenstandSelectActions.length = 0;
    const newActions = GEGENSTAND_VALUES.filter(
      (gegenstand) => getUnusedRechtsstandForGegenstand(gegenstand).length > 0,
    ).map((gegenstand) => ({
      name: GEGENSTAND_NAME[gegenstand],
      async callback(): Promise<void> {
        openAdd(gegenstand);
        if (modalAction?.active) {
          await modalAction.callback();
        }
      },
    }));
    gegenstandSelectActions.push(...newActions);
  });

  const { action: addAction, destroy: destroyAddAction } = createModalAction(
    {
      name: 'xplan.editor.add',
      icon: '$vcsPlus',
      title: 'xplan.editor.add',
    },
    {
      component: VcsActionList,
      position: { width: 200 },
      props: { actions: gegenstandSelectActions },
    },
    app,
    name,
  );
  modalAction = addAction;
  watch(gegenstandSelectActions, () => {
    addAction.disabled = !gegenstandSelectActions.length;
  });

  onUnmounted(destroyAddAction);

  const vegetationItems = computed(() =>
    modelValue.value.map((item, index) => ({
      name: `vegetation-${index}`,
      title: GEGENSTAND_NAME[item.gegenstand],
      subtitle: item.rechtsstand.map((r) => XP_RECHTSSTAND_NAME[r]).join(', '),
      actions: [
        {
          name: 'edit',
          title: 'xplan.editor.edit',
          icon: '$vcsEdit',
          callback(): void {
            openEdit(index);
          },
        },
        {
          name: 'remove',
          title: 'xplan.editor.remove',
          icon: 'mdi-delete',
          callback(): void {
            modelValue.value = modelValue.value
              .filter((_, i) => i !== index)
              .map((v) => toRaw(v));
          },
        },
      ],
    })),
  );
</script>

<template>
  <VcsFormSection
    heading="xplan.editor.vegetation.heading"
    :header-actions="[addAction]"
  >
    <VcsList v-if="vegetationItems.length" :items="vegetationItems">
      <template #item.subtitle="{ item }">
        {{ item.subtitle }}
      </template>
    </VcsList>
    <div v-else class="pa-2">{{ $st('collectionManager.empty') }}</div>
    <v-dialog
      :model-value="!!draft"
      width="400"
      @update:model-value="closeDialog"
    >
      <v-card v-if="draft">
        <div class="pa-2">
          <h3 class="d-flex align-center text-primary">
            <v-icon class="mr-1 text-primary">mdi-tree-outline</v-icon>
            <span class="font-weight-bold"
              >{{ $st(dialogTitle.action) }}:
              {{ dialogTitle.gegenstandName }}</span
            >
          </h3>
        </div>
        <v-divider />
        <v-card-text class="pa-0">
          <v-form v-model="isValid" @submit.prevent="apply">
            <v-container class="px-1 py-1">
              <v-row no-gutters>
                <v-col>
                  <VcsLabel html-for="xplan-vegetation-rechtsstand" required>
                    {{ $st('xplan.editor.vegetation.rechtsstand') }}
                  </VcsLabel>
                </v-col>
                <v-col>
                  <VcsSelect
                    id="xplan-vegetation-rechtsstand"
                    v-model="draft.rechtsstand"
                    :items="rechtsstandItems"
                    multiple
                    :placeholder="
                      $st('xplan.editor.vegetation.rechtsstandPlaceholder')
                    "
                    :rules="[requiredRule]"
                  />
                </v-col>
              </v-row>
              <v-row no-gutters>
                <v-col>
                  <VcsLabel
                    :help-text="$st('xplan.editor.vegetation.modelUrlHelp')"
                    html-for="xplan-vegetation-modelUrl"
                  >
                    {{ $st('xplan.editor.vegetation.modelUrl') }}
                  </VcsLabel>
                </v-col>
                <v-col>
                  <VcsTextField
                    id="xplan-vegetation-modelUrl"
                    v-model="draft.modelUrl"
                    clearable
                    :placeholder="
                      $st('xplan.editor.vegetation.modelUrlPlaceholder')
                    "
                    @keydown.enter.stop.prevent="apply"
                  />
                </v-col>
              </v-row>
            </v-container>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <VcsFormButton variant="filled" :disabled="!isValid" @click="apply">
            {{ $st('components.apply') }}
          </VcsFormButton>
          <VcsFormButton @click="closeDialog">
            {{ $st('components.cancel') }}
          </VcsFormButton>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </VcsFormSection>
</template>
