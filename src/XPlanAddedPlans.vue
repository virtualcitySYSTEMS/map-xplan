<script setup lang="ts">
  import { VDialog } from 'vuetify/components';
  import type { VcsAction, VcsUiApp } from '@vcmap/ui';
  import {
    ContentTreeCollection,
    createZoomToFeatureAction,
    downloadText,
    GroupContentTreeItem,
    LayerContentTreeItem,
    NodeContentTreeItem,
    VcsHelp,
    VcsTreeview,
    defaultContentTreeComponentId,
  } from '@vcmap/ui';
  import { inject, onUnmounted, reactive, ref } from 'vue';
  import type { Collection } from '@vcmap/core';
  import {
    ClippingPolygonObject,
    mercatorProjection,
    wgs84Projection,
    writeGeoJSON,
    VectorLayer,
  } from '@vcmap/core';
  import type { Coordinate } from 'ol/coordinate.js';
  import type Feature from 'ol/Feature.js';
  import type { XplanPlugin } from './index.js';
  import { name } from '../package.json';
  import type { XplanBoxService, Plan } from './xplanAPI.js';
  import type { Xplan3dLayer } from './layerHelper.js';
  import {
    isXplan2dLayer,
    isXplan3dLayer,
    xplanBPlanSymbol,
    xplanServiceSymbol,
  } from './layerHelper.js';
  import BatchStyleSelector from './BatchStyleSelector.vue';

  const app = inject<VcsUiApp>('vcsApp')!;
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  const contentTree = new ContentTreeCollection(app);

  const hideBuildingsDestroyCallbacks = new Map<string | number, () => void>();
  const isStyleDialogOpen = ref<XplanBoxService | undefined>();

  function addClippingPolygons(plan: Plan): void {
    const coordinates = plan.getGeometry()?.getCoordinates();
    const layerNames = [...app.layers]
      .filter((layer) => layer.className === 'CesiumTilesetLayer')
      .map((layer) => layer.name);
    if (plan.getGeometry()?.getType() === 'Polygon' && coordinates?.[0]) {
      const clippingPolygon = new ClippingPolygonObject({
        name: String(plan.getId()!),
        coordinates: (coordinates as Coordinate[][])[0].map((c) =>
          wgs84Projection.transformFrom(mercatorProjection, c),
        ),
        layerNames,
      });
      app.clippingPolygons.add(clippingPolygon);
      clippingPolygon.activate();
    } else if (
      plan.getGeometry()?.getType() === 'MultiPolygon' &&
      coordinates?.[0][0]
    ) {
      (coordinates as Coordinate[][][]).forEach((polygon, index) => {
        const clippingPolygon = new ClippingPolygonObject({
          name: `${plan.getId()}_${index}`,
          coordinates: polygon[0].map((c) =>
            wgs84Projection.transformFrom(mercatorProjection, c),
          ),
          layerNames,
        });
        app.clippingPolygons.add(clippingPolygon);
        clippingPolygon.activate();
      });
    }
  }

  function removeClippingPolygons(plan: Plan): void {
    const items = [...app.clippingPolygons].filter((cp) =>
      cp.name.includes(String(plan.getId()!)),
    );
    items.forEach((item) => {
      app.clippingPolygons.remove(item);
    });
  }

  const nodeActions = plugin.addedPlansCollectionManager.componentIds.map(
    (service) => ({
      plan3d: reactive<VcsAction>({
        name: 'xplan.bplans.activateAll3d',
        title: 'xplan.bplans.activateAll3d',
        icon: 'mdi-cube-outline',
        active: false,
        async callback(): Promise<void> {
          const layers = (
            [
              ...plugin.addedPlansCollectionManager.get(service)!.collection,
            ] as Plan[]
          ).map((plan) => app.layers.getByKey(`${plan.getId()}_3d`));
          if (this.active) {
            layers.forEach((l) => {
              l?.deactivate();
            });
          } else {
            await Promise.all(layers.map((l) => l?.activate()));
          }
        },
      }),
      exportAll3d: reactive<VcsAction>({
        name: 'xplan.bplans.exportAll3d',
        callback(): void {
          const features: Feature[] = [];
          (
            [
              ...plugin.addedPlansCollectionManager.get(service)!.collection,
            ] as Plan[]
          ).forEach((plan) => {
            const layer = app.layers.getByKey(`${plan.getId()}_3d`) as
              | Xplan3dLayer
              | undefined;
            if (layer) {
              const currentFeatures = layer.getFeatures();
              currentFeatures.forEach((f) => {
                // TODO: Do we need to remove the xplanObject Property??
                // does writeDefaultStyle in the options do the same as setting style from layer?
                // f.setStyle(layer.getStyleOrDefaultStyle().style);
                features.push(f);
              });
            }
          });
          const text = writeGeoJSON(
            {
              features,
            },
            { writeStyle: true, writeDefaultStyle: true },
          );
          downloadText(text, `xplan-${service}-3d.json`);
        },
      }),
      plan2d: reactive<VcsAction>({
        name: 'xplan.bplans.activateAll2d',
        title: 'xplan.bplans.activateAll2d',
        icon: 'mdi-map',
        active: false,
        async callback(): Promise<void> {
          const layers = (
            [
              ...plugin.addedPlansCollectionManager.get(service)!.collection,
            ] as Plan[]
          ).map((plan) => app.layers.getByKey(`${plan.getId()}_2d`));
          if (this.active) {
            layers.forEach((l) => {
              l?.deactivate();
            });
          } else {
            await Promise.all(layers.map((l) => l?.activate()));
          }
        },
      }),
      styleAll3d: reactive<VcsAction>({
        name: 'xplan.bplans.styleAll3d',
        title: 'xplan.bplans.styleAll3d',
        callback(): void {
          isStyleDialogOpen.value = service as XplanBoxService;
        },
      }),
    }),
  );

  function updateNodeLayerActions(): void {
    plugin.addedPlansCollectionManager?.componentIds.forEach((id, index) => {
      const serviceHas3dLayer = [...app.layers].some(
        (l) =>
          xplanServiceSymbol in l &&
          l instanceof VectorLayer &&
          l[xplanServiceSymbol] === id,
      );
      const collection = plugin.addedPlansCollectionManager.get(id)!
        .collection as unknown as Collection<Plan>;
      nodeActions[index].plan2d.active = [...collection].every(
        (plan) => app.layers.getByKey(`${plan.getId()}_2d`)?.active,
      );
      nodeActions[index].plan3d.active = [...collection].every((plan) => {
        const layer3d = app.layers.getByKey(`${plan.getId()}_3d`);
        return !layer3d || layer3d.active;
      });
      nodeActions[index].plan3d.disabled = !serviceHas3dLayer;
      nodeActions[index].exportAll3d.disabled = !serviceHas3dLayer;
      nodeActions[index].styleAll3d.disabled = !serviceHas3dLayer;
    });
  }
  updateNodeLayerActions();

  plugin.addedPlansCollectionManager?.componentIds.forEach((id, index) => {
    const nodeItem = new NodeContentTreeItem(
      {
        name: id,
        title: `xplan.bplans.${id}`,
      },
      app,
    );
    Object.values(nodeActions[index]).forEach((value) => {
      nodeItem.addAction(value);
    });
    nodeItem.addAction({
      name: 'xplan.bplans.removeAll',
      callback(): void {
        plugin.addedPlansCollectionManager?.get(id)?.collection.clear();
      },
    });
    contentTree.add(nodeItem);
  });

  function createHideExistingBuildingsAction(plan: Plan): {
    action: VcsAction;
    destroy: () => void;
  } {
    const action: VcsAction = reactive({
      name: 'xplan.bplans.hideExistingBuildings',
      title: 'xplan.bplans.hideExistingBuildings',
      icon: 'mdi-home-off',
      active: [...app.clippingPolygons].some((cp) =>
        cp.name.includes(String(plan.getId()!)),
      ),
      callback(): void {
        if (this.active) {
          removeClippingPolygons(plan);
        } else {
          addClippingPolygons(plan);
        }
      },
    });
    const listeners = [
      app.clippingPolygons.added.addEventListener((polygon) => {
        if (polygon.name.includes(String(plan.getId()!))) {
          action.active = true;
        }
      }),
      app.clippingPolygons.removed.addEventListener(() => {
        const items = [...app.clippingPolygons].filter((cp) =>
          cp.name.includes(String(plan.getId()!)),
        );
        if (!items.length) {
          action.active = false;
        }
      }),
    ];
    return {
      action,
      destroy(): void {
        listeners.forEach((l) => {
          l();
        });
      },
    };
  }

  function addLayerItem3d(node: string, plan: Plan): void {
    const layerItem3d = new LayerContentTreeItem(
      {
        name: `${node}.${plan.getId()}.3d`,
        title: 'xplan.bplans.plan3d',
        layerName: `${plan.getId()}_3d`,
        icon: 'mdi-cube-outline',
        weight: 0,
      },
      app,
    );
    layerItem3d.addAction({
      name: 'xplan.bplans.export3d',
      callback(): void {
        const layer = app.layers.getByKey(`${plan.getId()}_3d`) as VectorLayer;
        const text = writeGeoJSON({
          features: layer.getFeatures(),
          vcsMeta: layer.getVcsMeta(),
        });
        downloadText(text, 'xplan.json');
      },
    });
    const { action: hideAction, destroy: destroyHideAction } =
      createHideExistingBuildingsAction(plan);
    hideBuildingsDestroyCallbacks.set(plan.getId()!, destroyHideAction);
    layerItem3d.addAction(hideAction);
    contentTree.add(layerItem3d);
  }

  function addPlanToContentTree(plan: Plan, node: string): void {
    const groupItem = new GroupContentTreeItem(
      {
        name: `${node}.${plan.getId()}`,
        title: plan.getProperty(plugin.config.bpPlanListAttribute),
      },
      app,
    );
    const zoomToFeatureAction = createZoomToFeatureAction(
      { name: 'xplan.bplans.zoomToPlan' },
      plan,
      app.maps,
    );
    if (zoomToFeatureAction) {
      groupItem.addAction(zoomToFeatureAction);
    }
    groupItem.addAction({
      name: 'xplan.bplans.removePlan',
      callback(): void {
        plugin.addedPlansCollectionManager?.get(node)?.collection.remove(plan);
      },
    });
    contentTree.add(groupItem);
    contentTree.add(
      new LayerContentTreeItem(
        {
          name: `${node}.${plan.getId()}.2d`,
          title: 'xplan.bplans.plan2d',
          layerName: `${plan.getId()}_2d`,
          icon: 'mdi-map',
          weight: 1,
        },
        app,
      ),
    );
    if (app.layers.getByKey(`${plan.getId()}_3d`)) {
      addLayerItem3d(node, plan);
    }
  }

  plugin.addedPlansCollectionManager?.componentIds.forEach((id) => {
    const collection = plugin.addedPlansCollectionManager?.get(id)?.collection;
    if (collection) {
      [...collection].forEach((plan) => {
        addPlanToContentTree(plan as Plan, id);
      });
    }
  });

  const tree = contentTree.getComputedVisibleTree(
    defaultContentTreeComponentId,
  );

  const listeners: (() => void)[] = [
    ...plugin.addedPlansCollectionManager.componentIds.flatMap((service) => {
      const collection = plugin.addedPlansCollectionManager.get(service)!
        .collection as unknown as Collection<Plan>;
      return [
        collection.added.addEventListener((plan) => {
          addPlanToContentTree(plan, service);
          updateNodeLayerActions();
        }),
        collection.removed.addEventListener((plan) => {
          const items = [...contentTree].filter((item) =>
            item.name.includes(`${plan.getId()}`),
          );
          if (items.length) {
            items.forEach((i) => {
              contentTree.remove(i);
            });
            hideBuildingsDestroyCallbacks.get(plan.getId()!)?.();
            hideBuildingsDestroyCallbacks.delete(plan.getId()!);
            updateNodeLayerActions();
          }
        }),
      ];
    }),
    app.layers.stateChanged.addEventListener(() => {
      updateNodeLayerActions();
    }),
    app.layers.added.addEventListener((layer) => {
      if (isXplan3dLayer(layer)) {
        addLayerItem3d(layer[xplanServiceSymbol], layer[xplanBPlanSymbol]);
        updateNodeLayerActions();
      }
    }),
    app.layers.removed.addEventListener((layer) => {
      if (isXplan2dLayer(layer) || isXplan3dLayer(layer)) {
        updateNodeLayerActions();
      }
    }),
  ];

  onUnmounted(() => {
    listeners.forEach((l) => {
      l();
    });
    hideBuildingsDestroyCallbacks.forEach((value) => {
      value();
    });
  });
</script>

<template>
  <div>
    <VcsTreeview
      v-if="tree && tree.length"
      :items="tree"
      open-all
      open-on-click
      :show-searchbar="true"
      searchbar-placeholder="xplan.bplans.addedSearch"
    />
    <VcsHelp v-else text="xplan.bplans.noAdded" />
    <v-dialog
      :model-value="!!isStyleDialogOpen"
      max-width="400"
      @update:model-value="
        (v) => {
          if (!v) {
            isStyleDialogOpen = undefined;
          }
        }
      "
    >
      <BatchStyleSelector
        :service="isStyleDialogOpen as XplanBoxService"
        @close="isStyleDialogOpen = undefined"
      />
    </v-dialog>
  </div>
</template>
