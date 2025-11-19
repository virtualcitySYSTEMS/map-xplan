<script setup lang="ts">
  import { computed, inject, onUnmounted, ref, toRaw, watch } from 'vue';
  import type {
    ItemMovedEvent,
    VcsAction,
    VcsDraggableItem,
    VcsUiApp,
  } from '@vcmap/ui';
  import {
    createModalAction,
    VcsActionButtonList,
    VcsActionList,
    VcsList,
    VcsSelect,
  } from '@vcmap/ui';
  import type { BezugspunktConfig } from '../defaultOptions.js';
  import { BEZUGSPUNKT_NAME, BEZUGSPUNKT_RELATION } from '../defaultOptions.js';
  import { name } from '../../package.json';

  const app = inject<VcsUiApp>('vcsApp')!;

  const modelValue = defineModel<(string | BezugspunktConfig)[]>({
    required: true,
  });
  const props = defineProps<{
    title: string;
    defaultPriority: readonly (string | BezugspunktConfig)[];
  }>();

  function isBezugspunkt(
    item: string | BezugspunktConfig,
  ): item is BezugspunktConfig {
    return typeof item === 'object' && 'bezugspunkt' in item;
  }

  function sameItem(
    originalItem: string | BezugspunktConfig,
    dragItem: VcsDraggableItem,
  ): boolean {
    const priorityName = isBezugspunkt(originalItem)
      ? originalItem.bezugspunkt
      : originalItem;
    return priorityName === dragItem.name;
  }

  function handleItemMove(movedEvent: ItemMovedEvent): void {
    const { targetItem, item, position } = movedEvent;
    const priorityArray = structuredClone(toRaw(modelValue.value));

    const itemIndex = priorityArray.findIndex((i) => sameItem(i, item));
    if (itemIndex !== -1) {
      const [entry] = priorityArray.splice(itemIndex, 1);
      const targetIndex = priorityArray.findIndex((i) =>
        sameItem(i, targetItem),
      );
      const offset = position === 1 ? 1 : 0;
      priorityArray.splice(targetIndex + offset, 0, entry);
      modelValue.value = priorityArray;
    }
  }

  const priorityItems = computed(() => {
    return modelValue.value.map((item) => ({
      name: isBezugspunkt(item) ? item.bezugspunkt : item,
      title: isBezugspunkt(item) ? BEZUGSPUNKT_NAME[item.bezugspunkt] : item,
      reference: item,
      actions: [
        {
          name: 'removeItem',
          title: 'xplan.editor.remove',
          icon: 'mdi-delete',
          callback(): void {
            modelValue.value = modelValue.value
              .filter((i) => {
                if (isBezugspunkt(i) && isBezugspunkt(item)) {
                  return i.bezugspunkt !== item.bezugspunkt;
                } else {
                  return i !== item;
                }
              })
              .map((i) => toRaw(i));
          },
        },
      ],
    }));
  });

  const resetAction = {
    name: 'xplan.editor.resetPriority',
    title: 'xplan.editor.resetPriority',
    icon: '$vcsReturn',
    callback(): void {
      modelValue.value = structuredClone(props.defaultPriority) as string[];
    },
  };

  const removedItems = computed(() =>
    props.defaultPriority.filter(
      (i) =>
        !modelValue.value.find((item) => {
          if (isBezugspunkt(item) && isBezugspunkt(i)) {
            return item.bezugspunkt === i.bezugspunkt;
          } else {
            return i === item;
          }
        }),
    ),
  );

  const proprityListActions = ref<VcsAction[]>([]);
  let destroyModalAction: undefined | (() => void);
  watch(
    removedItems,
    () => {
      destroyModalAction?.();

      const { action: addItemAction, destroy } = createModalAction(
        {
          name: 'xplan.editor.add',
          title: 'xplan.editor.add',
          icon: '$vcsPlus',
          disabled: !removedItems.value.length,
        },
        {
          component: VcsActionList,
          props: {
            actions: removedItems.value.map((item) => ({
              name: isBezugspunkt(item)
                ? BEZUGSPUNKT_NAME[item.bezugspunkt]
                : item,
              async callback(): Promise<void> {
                modelValue.value = structuredClone(
                  toRaw(modelValue.value),
                ).concat(item);
                await addItemAction.callback();
              },
            })),
          },
        },
        app,
        name,
      );
      destroyModalAction = destroy;

      proprityListActions.value = [addItemAction, resetAction];
    },
    { immediate: true },
  );

  onUnmounted(() => {
    destroyModalAction?.();
  });
</script>

<template>
  <VcsList
    :title="props.title"
    :items="priorityItems"
    draggable
    :actions="proprityListActions"
    @item-moved="handleItemMove"
  >
    <template v-if="isBezugspunkt(modelValue[0])" #item.append="{ item }">
      <div class="d-flex flex-direction-column pr-6">
        <VcsSelect
          v-model="item.reference.relation"
          :items="
            BEZUGSPUNKT_RELATION.map((i) => ({
              value: i,
              title: `xplan.editor.${i}`,
            }))
          "
          width="198"
        />
        <VcsActionButtonList :actions="item.actions" />
      </div>
    </template>
  </VcsList>
</template>
