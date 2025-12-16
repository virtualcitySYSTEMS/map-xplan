import { reactive, ref, watch } from 'vue';
import {
  CesiumMap,
  Collection,
  Extent,
  mercatorProjection,
  vcsLayerName,
  Viewpoint,
  type VectorLayer,
} from '@vcmap/core';
import {
  CollectionManager,
  createStateRefAction,
  createZoomToFeatureAction,
  getDefaultPrimaryColor,
  getHighlightStyle,
  getStateFromLayer,
  StateActionState,
  type CollectionComponentClass,
  type VcsAction,
  type VcsListItem,
  type VcsUiApp,
} from '@vcmap/ui';
import type { Coordinate } from 'ol/coordinate.js';
import type { MultiPolygon, Polygon } from 'ol/geom.js';
import type Feature from 'ol/Feature.js';
import { name } from '../package.json';
import type { XplanPlugin } from './index.js';
import { type Plan, type XplanBoxService } from './xplanAPI.js';
import {
  addPlan2dLayer,
  addPlan3dLayer,
  removePlan2dLayer,
  removePlan3dLayer,
} from './layerHelper.js';

async function handleSelectionChange(
  app: VcsUiApp,
  layer: VectorLayer,
  curr: VcsListItem[],
  prev: VcsListItem[],
): Promise<void> {
  if (prev.length > 0) {
    const prevFeature = layer.getFeatureById(prev[0].name);
    if (prev.length === 1 && app.featureInfo.selectedFeature === prevFeature) {
      app.featureInfo.clearFeature();
    } else if (prev.length > 1) {
      layer.featureVisibility.clearHighlighting();
    }
  }

  if (curr.length === 1) {
    const feature = layer.getFeatureById(curr[0].name);
    if (feature && feature !== app.featureInfo.selectedFeature) {
      let position: Coordinate | undefined;
      const geometry = feature.getGeometry() as
        | MultiPolygon
        | Polygon
        | undefined;
      if (geometry) {
        position = geometry.getClosestPoint(geometry.getFirstCoordinate());
      }
      await app.featureInfo.selectFeature(feature, position);
    }
  } else if (curr.length > 1) {
    const toHighlightEntries = curr.map((item) => {
      const feature = layer.getFeatureById(item.name);
      return [
        item.name,
        getHighlightStyle(
          feature!,
          layer,
          app.uiConfig.config.primaryColor ?? getDefaultPrimaryColor(app),
        ),
      ];
    });
    layer.featureVisibility.highlight(Object.fromEntries(toHighlightEntries));
  }
}

function createZoomToSelectionAction(
  app: VcsUiApp,
  collectionComponent: CollectionComponentClass,
): { action: VcsAction; destroy: () => void } {
  const action: VcsAction = reactive({
    name: 'xplan.bplans.zoomToSelection',
    async callback(): Promise<void> {
      const selected = collectionComponent.selection.value;
      if (selected.length === 0) {
        return;
      }
      const coordinates = [Infinity, Infinity, -Infinity, -Infinity];
      selected.forEach((item) => {
        const feature = collectionComponent.collection.getByKey(
          item.name,
        ) as Feature;
        const geom = feature?.getGeometry();
        if (geom) {
          const [x1, y1, x2, y2] = geom.getExtent();
          coordinates[0] = Math.min(coordinates[0], x1);
          coordinates[1] = Math.min(coordinates[1], y1);
          coordinates[2] = Math.max(coordinates[2], x2);
          coordinates[3] = Math.max(coordinates[3], y2);
        }
      });
      const vp = Viewpoint.createViewpointFromExtent(
        new Extent({ coordinates, projection: mercatorProjection }),
      );
      if (vp) {
        await app.maps.activeMap?.gotoViewpoint(vp);
      }
    },
  });

  const watcher = watch(collectionComponent.selection, (curr) => {
    action.disabled = !curr.length;
  });
  return {
    action,
    destroy(): void {
      watcher();
    },
  };
}

function createChangeLayerStateAction(layer: VectorLayer): {
  action: VcsAction;
  destroy: () => void;
} {
  const stateRef = ref(getStateFromLayer(layer));
  const listener = layer.stateChanged.addEventListener(() => {
    stateRef.value = getStateFromLayer(layer);
  });
  const { action, destroy } = createStateRefAction(
    'xplan.bplans.toggleLayerState',
    stateRef,
    () => {
      if (stateRef.value !== StateActionState.INACTIVE) {
        layer.deactivate();
      } else {
        // eslint-disable-next-line no-void
        void layer.activate();
      }
    },
  );

  return {
    action,
    destroy(): void {
      listener();
      destroy();
    },
  };
}

export function createBPlanCollectionManager(
  plugin: XplanPlugin,
): CollectionManager {
  const collectionManager = new CollectionManager();
  plugin.config.xplanBoxServices.forEach((id) => {
    const collection = new Collection('id_');
    collectionManager.add(
      {
        id,
        title: `xplan.bplans.${id}`,
        collection,
        selectable: true,
        limit: 20,
      },
      name,
    );
  });

  return collectionManager;
}

function createAddPlanAction(
  addedPlansCollectionComponent: CollectionComponentClass,
  plan: Plan,
): { action: VcsAction; destroy: () => void } {
  const addedPlansCollection =
    addedPlansCollectionComponent.collection as unknown as Collection<Plan>;
  const action: VcsAction = reactive({
    name: 'xplan.bplans.addPlan',
    title: addedPlansCollection.hasKey(plan.getId())
      ? 'xplan.bplans.removePlan'
      : 'xplan.bplans.addPlan',
    icon: addedPlansCollection.hasKey(plan.getId())
      ? 'mdi-map-check-outline'
      : '$vcsPlus',
    callback(): void {
      if (addedPlansCollection.hasKey(plan.getId())) {
        const addedPlan = addedPlansCollection.getByKey(plan.getId());
        if (addedPlan) {
          addedPlansCollection.remove(addedPlan);
        }
      } else {
        addedPlansCollection.add(plan);
      }
    },
  });
  const listeners = [
    addedPlansCollection?.added.addEventListener((p) => {
      if (p.getId() === plan.getId()) {
        action.icon = 'mdi-map-check-outline';
        action.title = 'xplan.bplans.removePlan';
      }
    }),
    addedPlansCollection?.removed.addEventListener((p) => {
      if (p.getId() === plan.getId()) {
        action.icon = '$vcsPlus';
        action.title = 'xplan.bplans.addPlan';
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

function createAddSelectedAction(
  collectionComponent: CollectionComponentClass<Plan>,
  addedPlansCollectionComponent: CollectionComponentClass<Plan>,
): { action: VcsAction; destroy: () => void } {
  const action: VcsAction = reactive({
    name: 'xplan.bplans.addSelected',
    disabled: true,
    callback(): void {
      const addedPlansCollection = addedPlansCollectionComponent.collection;
      collectionComponent.selection.value.forEach((item) => {
        const feature = collectionComponent.collection.getByKey(item.name)!;
        if (!addedPlansCollection.hasKey(feature.getId())) {
          addedPlansCollection.add(feature);
        }
      });
    },
  });
  const watcher = watch(collectionComponent.selection, (curr) => {
    action.disabled = !curr.length;
  });
  return {
    action,
    destroy(): void {
      watcher();
    },
  };
}

function createRemoveSelectedAction(
  collectionComponent: CollectionComponentClass,
  addedPlansCollectionComponent: CollectionComponentClass,
): { action: VcsAction; destroy: () => void } {
  const action: VcsAction = reactive({
    name: 'xplan.bplans.removeSelected',
    disabled: true,
    callback(): void {
      const addedPlansCollection = addedPlansCollectionComponent.collection;
      collectionComponent.selection.value.forEach((item) => {
        const feature = addedPlansCollection.getByKey(item.name);
        if (feature) {
          addedPlansCollection.remove(feature);
        }
      });
    },
  });
  const watcher = watch(collectionComponent.selection, (curr) => {
    action.disabled = !curr.length;
  });
  return {
    action,
    destroy(): void {
      watcher();
    },
  };
}

export function createOverviewCollectionManager(
  app: VcsUiApp,
  plugin: XplanPlugin,
  addedPlansManager: CollectionManager,
): CollectionManager {
  const overviewManager = createBPlanCollectionManager(plugin);
  const destroyActionMap = new Map<string, () => void>();
  overviewManager.addMappingFunction(
    () => true,
    (plan: Plan, { id }, listItem) => {
      listItem.title = plan.get(plugin.config.bpPlanListAttribute);
      const zoomToFeatureAction = createZoomToFeatureAction(
        { name: 'xplan.bplans.zoomToPlan' },
        plan,
        app.maps,
      );
      if (zoomToFeatureAction) {
        listItem.actions.push(zoomToFeatureAction);
      }

      const addedPlansCollectionComponent = addedPlansManager.get(id)!;
      const { action: addPlanAction, destroy: destroyAction } =
        createAddPlanAction(addedPlansCollectionComponent, plan);
      destroyActionMap.set(listItem.name, destroyAction);
      listItem.actions.push(addPlanAction);
    },
    name,
  );

  const listeners: (() => void)[] = [];
  overviewManager.componentIds.forEach((id) => {
    const collectionComponent = overviewManager.get(id)!;
    const { collection } = collectionComponent;
    const layer = plugin.getLayerForService(id as XplanBoxService);

    collectionComponent.open.value = true;

    const removed = collection.removed.addEventListener((plan) => {
      const planId = String((plan as Plan).getId());
      if (planId) {
        destroyActionMap.get(planId)?.();
        destroyActionMap.delete(planId);
        layer.removeFeaturesById([planId]);
        if (app.featureInfo.selectedFeature?.getId() === planId) {
          app.featureInfo.clearSelection();
        }
      }
    });
    const added = collection.added.addEventListener((plan) => {
      layer.addFeatures([plan as Plan]);
    });

    const selectionWatcher = watch(
      collectionComponent.selection,
      handleSelectionChange.bind(undefined, app, layer),
    );

    const updateTitle = (): void => {
      const { pagination } = collectionComponent;
      collectionComponent.title.value = pagination.value
        ? `${app.vueI18n.t(`xplan.bplans.${id}`)}: ${pagination.value.totalCount} ${app.vueI18n.t('xplan.bplans.plans')}`
        : `xplan.bplans.${id}`;
    };

    const paginationWatcher = watch(
      collectionComponent.pagination,
      async (pagination) => {
        if (pagination) {
          await pagination.initialize();
          updateTitle();
        }
      },
    );
    const localeWatcher = watch(app.vueI18n.locale, updateTitle);

    const { action: zoomToSelectionAction, destroy: destroyZoomToSelection } =
      createZoomToSelectionAction(app, collectionComponent);
    const { action: changeLayerStateAction, destroy: destroyLayerStateAction } =
      createChangeLayerStateAction(layer);
    const addedPlansCollectionComponent = addedPlansManager.get(id)!;
    const { action: addSelectedAction, destroy: destroyAddAction } =
      createAddSelectedAction(
        collectionComponent as unknown as CollectionComponentClass<Plan>,
        addedPlansCollectionComponent as unknown as CollectionComponentClass<Plan>,
      );
    const { action: removeSelectedAction, destroy: destroyRemoveAction } =
      createRemoveSelectedAction(
        collectionComponent,
        addedPlansCollectionComponent,
      );
    collectionComponent.addActions([
      { action: zoomToSelectionAction, owner: name },
      { action: changeLayerStateAction, owner: name },
      { action: addSelectedAction, owner: name },
      { action: removeSelectedAction, owner: name },
    ]);

    listeners.push(
      added,
      removed,
      destroyAddAction,
      destroyRemoveAction,
      selectionWatcher,
      paginationWatcher,
      localeWatcher,
      destroyZoomToSelection,
      destroyLayerStateAction,
    );
  });

  listeners.push(
    app.featureInfo.featureChanged.addEventListener((feature) => {
      if (plugin.planLayers.some((l) => l.name === feature?.[vcsLayerName])) {
        overviewManager.componentIds.forEach((id) => {
          const collectionComponent = overviewManager.get(id)!;
          const item = collectionComponent.getListItemForItem(feature);
          if (
            item &&
            !(
              collectionComponent.selection.value.length === 1 &&
              collectionComponent.selection.value.includes(item)
            )
          ) {
            collectionComponent.selection.value = [item];
          }
        });
      }
    }),
  );

  const originalDestroy = overviewManager.destroy.bind(overviewManager);
  overviewManager.destroy = function destroy(): void {
    originalDestroy();
    listeners.forEach((l) => {
      l();
    });
    destroyActionMap.forEach((cb) => {
      cb();
    });
  };

  return overviewManager;
}

export function createAddedPlansCollectionManager(
  app: VcsUiApp,
  plugin: XplanPlugin,
): CollectionManager {
  const addedPlansManager = createBPlanCollectionManager(plugin);

  const defered3dLayers = new Map<Plan, () => Promise<void>>();
  const listeners: (() => void)[] = [
    app.maps.mapActivated.addEventListener(async (map) => {
      if (map instanceof CesiumMap) {
        await Promise.allSettled(
          defered3dLayers.entries().map(async ([plan, cb]) => {
            defered3dLayers.delete(plan);
            await cb();
          }),
        );
      }
    }),
  ];

  (addedPlansManager.componentIds as XplanBoxService[]).forEach((id) => {
    const { collection } = addedPlansManager.get(id)!;
    const added = collection.added.addEventListener(async (plan) => {
      const zIndex = [...plugin.config.xplanBoxServices].reverse().indexOf(id);
      await addPlan2dLayer(
        app,
        plan as Plan,
        id,
        zIndex + plugin.config.minZIndex,
      );
      if (app.maps.activeMap instanceof CesiumMap) {
        await addPlan3dLayer(app, plan as Plan, id);
      } else {
        defered3dLayers.set(plan as Plan, async () => {
          await addPlan3dLayer(app, plan as Plan, id);
        });
      }
    });
    const removed = collection.removed.addEventListener((plan) => {
      removePlan2dLayer(app, plan as Plan);
      if (defered3dLayers.has(plan as Plan)) {
        defered3dLayers.delete(plan as Plan);
      } else {
        removePlan3dLayer(app, plan as Plan);
      }
      const items = [...app.clippingPolygons].filter((cp) =>
        cp.name.includes(String((plan as Plan).getId())),
      );
      items.forEach((item) => {
        app.clippingPolygons.remove(item);
      });
    });
    listeners.push(added, removed);
  });

  const originalDestroy = addedPlansManager.destroy.bind(addedPlansManager);
  addedPlansManager.destroy = function destroy(): void {
    originalDestroy();
    listeners.forEach((l) => {
      l();
    });
    defered3dLayers.clear();
  };

  return addedPlansManager;
}
