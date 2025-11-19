import { vcsLayerName, type InteractionEvent } from '@vcmap/core';
import type { VcsUiApp, VcsAction } from '@vcmap/ui';
import type { XplanPlugin } from './index.js';
import { name } from '../package.json';
import {
  xplanFeatureTypeSymbol,
  type Plan,
  type XplanBoxService,
} from './xplanAPI.js';
import {
  isXplan2dLayer,
  isXplan3dLayer,
  xplanBPlanSymbol,
} from './layerHelper.js';

export default function createContextMenu(
  app: VcsUiApp,
  plugin: XplanPlugin,
): () => void {
  function contextMenuHandler(event: InteractionEvent): VcsAction[] {
    const entries: VcsAction[] = [];

    if (!event.position || !event.feature) {
      return [];
    }

    let plan: Plan | undefined;
    const isPlan = xplanFeatureTypeSymbol in event.feature;
    if (isPlan) {
      plan = event.feature as Plan;
    } else {
      const layer = app.layers.getByKey(
        event.feature?.[vcsLayerName] ||
          event.feature?.getProperty('features')?.[0]?.[vcsLayerName],
      );
      if (layer && (isXplan2dLayer(layer) || isXplan3dLayer(layer))) {
        plan = layer[xplanBPlanSymbol];
      }
    }

    if (plan) {
      const service = plugin.overviewCollectionManager?.componentIds.find(
        (id) => plugin.overviewCollectionManager.get(id)!.collection.has(plan),
      ) as XplanBoxService;
      const addedPlansCollection =
        plugin.addedPlansCollectionManager?.get(service)?.collection;
      if (addedPlansCollection?.has(plan)) {
        entries.push({
          name: 'xplan.bplans.removePlan',
          title: 'xplan.bplans.removePlan',
          icon: 'mdi-map-check-outline',
          callback(): void {
            addedPlansCollection?.remove(plan);
          },
        });
      } else if (addedPlansCollection) {
        entries.push({
          name: 'xplan.bplans.addPlan',
          title: 'xplan.bplans.addPlan',
          icon: '$vcsPlus',
          callback(): void {
            addedPlansCollection.add(plan);
          },
        });
      }
    }
    return entries;
  }

  app.contextMenuManager.addEventHandler(contextMenuHandler, name);
  return (): void => {
    app.contextMenuManager.removeHandler(contextMenuHandler);
  };
}
