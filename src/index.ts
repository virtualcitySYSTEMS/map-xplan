import {
  NotificationType,
  type CollectionManager,
  type PluginConfigEditor,
  type VcsPlugin,
  type VcsUiApp,
} from '@vcmap/ui';
import {
  markVolatile,
  Projection,
  VcsEvent,
  volatileModuleId,
  type VectorLayer,
} from '@vcmap/core';
import { ref, type Ref } from 'vue';
import { getLogger } from '@vcsuite/logger';
import equal from 'fast-deep-equal';
import { name, version, mapVersion } from '../package.json';
import getDefaultOptions, {
  type CubeCreationOptions,
  getMergedConfig,
  getPageSizesFor,
  type Style3dOptions,
  type XplanConfig,
} from './defaultOptions.js';
import { createNavbarButton } from './createNavbarButton.js';
import {
  createAddedPlansCollectionManager,
  createOverviewCollectionManager,
} from './collectionManagerHelper.js';
import {
  createPlanLayer,
  featureInfoClassMap,
  featureInfos,
} from './layerHelper.js';
import { getAllCubeStyles } from './cubeStyles.js';
import createContextMenu from './createContextMenu.js';
import {
  getHits,
  getPlanFeatures,
  SUPPORTED_XPLAN_VERSIONS,
  type Plan,
  type PlanQuery,
  type XplanBoxService,
} from './xplanAPI';
import ConfigEditor from './configEditor/ConfigEditor.vue';
import de from './i18n/de.js';
import en from './i18n/en.js';

type PluginState = Record<never, never>;

export type XplanPlugin = VcsPlugin<XplanConfig, PluginState> & {
  readonly config: XplanConfig;
  readonly overviewCollectionManager: CollectionManager;
  readonly addedPlansCollectionManager: CollectionManager;
  readonly planLayers: VectorLayer[];
  getLayerForService(service: XplanBoxService): VectorLayer;
  readonly currentTab: Ref<XplanTab>;
  readonly projection: Projection;
  readonly cubeCreationOptions: CubeCreationOptions;
  setOverviewFilter(filter: PlanQuery): Promise<void>;
  getOverviewFilter(): PlanQuery | undefined;
  readonly overviewFilterChanged: VcsEvent<PlanQuery>;
};

export type XplanTab = 'overview' | 'added';

export default function xplanPlugin(customConfig: XplanConfig): XplanPlugin {
  let app: VcsUiApp | undefined;
  const config = getMergedConfig(customConfig);
  const cubeCreationOptions = structuredClone(config.cubeCreationOptions);
  let addedPlansCollectionManager: CollectionManager | undefined;
  let overviewCollectionManager: CollectionManager | undefined;
  const planLayers = new Map<XplanBoxService, VectorLayer>();
  let removeNavbarButton: (() => void) | undefined;
  const currentTab = ref<XplanTab>('overview');
  let currentFilter: PlanQuery | undefined;
  const overviewFilterChanged = new VcsEvent<PlanQuery>();
  let removeContextMenu: (() => void) | undefined;
  const projection = new Projection(config.projection);

  return {
    get config(): XplanConfig {
      return config;
    },
    get overviewCollectionManager(): CollectionManager {
      if (overviewCollectionManager) {
        return overviewCollectionManager;
      } else {
        throw new Error(
          'overviewCollectionManager not available yet. Initialize plugin first.',
        );
      }
    },
    get addedPlansCollectionManager(): CollectionManager {
      if (addedPlansCollectionManager) {
        return addedPlansCollectionManager;
      } else {
        throw new Error(
          'addedPlansCollectionManager not available yet. Initialize plugin first.',
        );
      }
    },
    get planLayers(): VectorLayer[] {
      return [...planLayers.values()];
    },
    get projection(): Projection {
      return projection;
    },
    get currentTab(): Ref<XplanTab> {
      return currentTab;
    },
    cubeCreationOptions,
    async setOverviewFilter(query: PlanQuery): Promise<void> {
      const pageSizes = getPageSizesFor(config.xplanBoxServices);
      const promises =
        overviewCollectionManager?.componentIds.map(async (service) => {
          const pageSize = pageSizes[service as XplanBoxService];
          const collectionComponent = overviewCollectionManager?.get(service);
          if (collectionComponent) {
            const hits = await getHits(
              config.xplanBoxUrl,
              service as XplanBoxService,
              query,
            );
            collectionComponent.setPagination({
              async getItems(
                startIndex: number,
                count: number,
              ): Promise<{ items: Plan[]; total: number }> {
                const items = await getPlanFeatures(
                  config.xplanBoxUrl,
                  service as XplanBoxService,
                  {
                    ...query,
                    count,
                    startIndex,
                  },
                  {
                    onUnsupportedXplanVersion(plan) {
                      app?.notifier.add({
                        message: app.vueI18n.t(
                          'xplan.administration.error.unsupportedXplanVersion',
                          {
                            xplanVersion: plan.get('xpVersion'),
                            supportedVersions:
                              SUPPORTED_XPLAN_VERSIONS.join(', '),
                          },
                        ),
                        type: NotificationType.ERROR,
                        title: plan.get(config.bpPlanListAttribute),
                      });
                    },
                    onErrorReadingFeatures() {
                      app?.notifier.add({
                        message: app.vueI18n.t(
                          'xplan.administration.error.errorReadingFeatures',
                          { service: app.vueI18n.t(`xplan.bplans.${service}`) },
                        ),
                        type: NotificationType.ERROR,
                        title: `xplan.administration.error.errorReadingFeaturesTitle`,
                      });
                    },
                  },
                );
                return {
                  items,
                  total: items.length ? hits : 0,
                };
              },
              defaultPageSize: pageSize,
            });
            return collectionComponent.pagination.value!.initialize();
          }
          return Promise.resolve();
        }) ?? [];

      await Promise.all(promises);
      currentFilter = query;
      overviewFilterChanged.raiseEvent(query);
    },
    getOverviewFilter(): PlanQuery | undefined {
      return structuredClone(currentFilter);
    },
    overviewFilterChanged,
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    async initialize(vcsUiApp: VcsUiApp): Promise<void> {
      app = vcsUiApp;

      Object.values(featureInfos).forEach((featureInfo) => {
        const CTOR = featureInfoClassMap.get(featureInfo.type);
        if (CTOR) {
          const instance = new CTOR(featureInfo);
          markVolatile(instance);
          app?.featureInfo.add(instance);
        } else {
          getLogger(name).error(`Constructor for ${featureInfo.type} missing`);
        }
      });
      await app.styles.parseItems(getAllCubeStyles(), volatileModuleId);

      await Promise.all(
        config.xplanBoxServices.map(async (service) => {
          const layer = createPlanLayer(service, projection);
          planLayers.set(service, layer);
          vcsUiApp.layers.add(layer);
          await layer.activate();
        }),
      );
      addedPlansCollectionManager = createAddedPlansCollectionManager(
        app,
        this,
      );
      overviewCollectionManager = createOverviewCollectionManager(
        app,
        this,
        addedPlansCollectionManager,
      );
      removeNavbarButton = createNavbarButton(app);
      removeContextMenu = createContextMenu(app, this);
    },
    destroy(): void {
      Object.values(featureInfos).forEach((featureInfo) => {
        const item = app?.featureInfo.getByKey(featureInfo.name);
        if (item) {
          app?.featureInfo.remove(item);
        }
      });
      removeNavbarButton?.();
      removeContextMenu?.();
      planLayers.forEach((l) => {
        l.deactivate();
        app?.layers.remove(l);
        l.destroy();
      });
      planLayers.clear();
      getAllCubeStyles().forEach((style) => {
        const item = app?.styles.getByKey(style.name);
        if (item) {
          app?.styles.remove(item);
        }
      });
    },
    getLayerForService(service: XplanBoxService): VectorLayer {
      const layer = planLayers.get(service);
      if (!layer) {
        throw new Error(`No layer found for service ${service}`);
      }
      return layer;
    },
    getConfigEditors(): PluginConfigEditor<object>[] {
      return [
        {
          component: ConfigEditor,
          title: 'xplan.editor.title',
          infoUrlCallback: app?.getHelpUrlCallback(
            '/components/plugins/xplanToolConfig.html',
            'app-configurator',
          ),
        },
      ];
    },
    toJSON(): XplanConfig {
      const defaultOptions = getDefaultOptions();
      const mergedConfig = this.config as XplanConfig;

      const serialized: Partial<XplanConfig> = {};

      if (mergedConfig.projection.epsg !== defaultOptions.projection.epsg) {
        serialized.projection = structuredClone(mergedConfig.projection);
      }

      if (
        mergedConfig.bpPlanListAttribute !== defaultOptions.bpPlanListAttribute
      ) {
        serialized.bpPlanListAttribute = mergedConfig.bpPlanListAttribute;
      }

      if (mergedConfig.additionalStyles3d.length) {
        serialized.additionalStyles3d = [...mergedConfig.additionalStyles3d];
      }

      const serializedDefaultStyle3d: Partial<Style3dOptions> = {};
      mergedConfig.xplanBoxServices.forEach((service) => {
        if (
          mergedConfig.defaultStyle3d[service] !==
          defaultOptions.defaultStyle3d[service]
        ) {
          serializedDefaultStyle3d[service] =
            mergedConfig.defaultStyle3d[service];
        }
      });
      if (Object.keys(serializedDefaultStyle3d).length) {
        serialized.defaultStyle3d = serializedDefaultStyle3d as Style3dOptions;
      }

      if (mergedConfig.xplanBoxUrl) {
        serialized.xplanBoxUrl = mergedConfig.xplanBoxUrl;
      }

      if (
        !equal(mergedConfig.xplanBoxServices, defaultOptions.xplanBoxServices)
      ) {
        serialized.xplanBoxServices = [...mergedConfig.xplanBoxServices];
      }

      if (
        mergedConfig.filterInitiallyOpen !== defaultOptions.filterInitiallyOpen
      ) {
        serialized.filterInitiallyOpen = mergedConfig.filterInitiallyOpen;
      }

      if (
        !equal(
          mergedConfig.vegetationCreationOptions,
          defaultOptions.vegetationCreationOptions,
        )
      ) {
        serialized.vegetationCreationOptions = structuredClone(
          mergedConfig.vegetationCreationOptions,
        );
      }

      const serializedCubeOptions: Partial<CubeCreationOptions> = {};
      if (
        !equal(
          mergedConfig.cubeCreationOptions.bezugspunktPriority,
          defaultOptions.cubeCreationOptions.bezugspunktPriority,
        )
      ) {
        serializedCubeOptions.bezugspunktPriority = [
          ...mergedConfig.cubeCreationOptions.bezugspunktPriority,
        ];
      }

      if (
        !equal(
          mergedConfig.cubeCreationOptions.heightAttributePriority,
          defaultOptions.cubeCreationOptions.heightAttributePriority,
        )
      ) {
        serializedCubeOptions.heightAttributePriority = [
          ...mergedConfig.cubeCreationOptions.heightAttributePriority,
        ];
      }

      if (
        !equal(
          mergedConfig.cubeCreationOptions.storeyAttributePriority,
          defaultOptions.cubeCreationOptions.storeyAttributePriority,
        )
      ) {
        serializedCubeOptions.storeyAttributePriority = [
          ...mergedConfig.cubeCreationOptions.storeyAttributePriority,
        ];
      }

      if (
        mergedConfig.cubeCreationOptions.defaultStoreyHeight !==
        defaultOptions.cubeCreationOptions.defaultStoreyHeight
      ) {
        serializedCubeOptions.defaultStoreyHeight =
          mergedConfig.cubeCreationOptions.defaultStoreyHeight;
      }

      if (
        mergedConfig.cubeCreationOptions.terrainLevelMethod !==
        defaultOptions.cubeCreationOptions.terrainLevelMethod
      ) {
        serializedCubeOptions.terrainLevelMethod =
          mergedConfig.cubeCreationOptions.terrainLevelMethod;
      }

      if (Object.keys(serializedCubeOptions).length) {
        serialized.cubeCreationOptions =
          serializedCubeOptions as CubeCreationOptions;
      }

      return serialized as XplanConfig;
    },
    i18n: {
      en,
      de,
    },
  };
}
