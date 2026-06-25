import {
  markVolatile,
  VectorLayer,
  VectorStyleItem,
  WMSLayer,
  type Layer,
  type VectorStyleItemOptions,
  CesiumMap,
  mercatorProjection,
  type Projection,
  type VectorStyleItemFill,
} from '@vcmap/core';
import { type CesiumTerrainProvider } from '@vcmap-cesium/engine';
import {
  getPluginAssetUrl,
  NotificationType,
  type FeatureInfoViewOptions,
  type FillLegendRow,
  type StyleLegendItem,
  type VcsUiApp,
} from '@vcmap/ui';
import {
  type Plan,
  type XplanBoxService,
  xplanFeatureTypeSymbol,
  load3dFeatures,
} from './xplanAPI.js';
import type { XplanPlugin } from './index.js';
import { name } from '../package.json';
import {
  ADDITIONAL_ATTRIBUTES,
  BEZUGSPUNKT_NAME,
  HOEHENBEZUG_NAME,
} from './defaultOptions.js';
import { defaultStyles, predefinedStyles } from './cubeStyles.js';
import type { PlanIframeWmsFeatureInfoViewOptions } from './planIframeWmsFeatureInfoView.js';
import CubeFeatureInfoView, {
  CALCULATED_HEIGHT_ATTRIBUTES,
} from './cubeFeatureInfoView.js';
import PlanIframeWmsFeatureInfoView from './planIframeWmsFeatureInfoView.js';

function createPlanLegend(
  style: VectorStyleItemOptions,
  service: XplanBoxService,
): StyleLegendItem {
  const row: FillLegendRow = {
    type: 'FillLegendRow',
    fill: style.fill as VectorStyleItemFill,
    stroke: style.stroke as object,
    title: `xplan.bplans.${service}`,
  };
  return {
    type: 'StyleLegendItem',
    colNr: 1,
    rows: [row],
  };
}

export function getDefaultPlanStyle(
  service: XplanBoxService,
  legend?: boolean,
): VectorStyleItemOptions {
  const styles: Record<XplanBoxService, VectorStyleItemOptions> = {
    current: {
      name: 'Geltungsbereich-current',
      fill: {
        color: [255, 234, 227, 0.7],
      },
      stroke: {
        color: [77, 77, 77, 1],
        width: 2,
      },
    },
    pre: {
      name: 'Geltungsbereich-pre',
      fill: {
        color: [255, 255, 202, 0.7],
      },
      stroke: {
        color: [77, 77, 77, 1],
        width: 2,
      },
    },
    archive: {
      name: 'Geltungsbereich-archive',
      fill: {
        color: [220, 220, 220, 0.7],
      },
      stroke: {
        color: [77, 77, 77, 1],
        width: 2,
      },
    },
  };
  const style = styles[service];
  if (legend) {
    style.properties = {
      legend: [createPlanLegend(style, service)],
    };
  }
  return styles[service];
}

export const featureInfoClassMap = new Map<
  string,
  typeof PlanIframeWmsFeatureInfoView | typeof CubeFeatureInfoView
>([
  [PlanIframeWmsFeatureInfoView.className, PlanIframeWmsFeatureInfoView],
  [CubeFeatureInfoView.className, CubeFeatureInfoView],
]);

export const featureInfos = {
  plan: {
    type: PlanIframeWmsFeatureInfoView.className,
    name: 'xplan-planIframeWms',
    parameters: { QUERY_LAYERS: 'bp_plan', LAYERS: 'bp_plan' },
    window: {
      state: {
        headerTitle: 'xplan.bplans.featureInfoTitle',
      },
      position: {
        height: '100%',
        maxHeight: '100%',
        width: '30%',
        maxWidth: '30%',
      },
    },
  } satisfies PlanIframeWmsFeatureInfoViewOptions,
  plan3d: {
    type: CubeFeatureInfoView.className,
    name: 'xplan-cube-feature-info',
    attributeKeys: [...CALCULATED_HEIGHT_ATTRIBUTES, ...ADDITIONAL_ATTRIBUTES],
    valueMapping: {
      heightBezugspunkt: BEZUGSPUNKT_NAME,
      groundBezugspunkt: BEZUGSPUNKT_NAME,
      heightHoehenbezug: HOEHENBEZUG_NAME,
      groundHoehenbezug: HOEHENBEZUG_NAME,
      allgArtDerBaulNutzung: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1000: 'Wohnbaufläche',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        2000: 'Gemischte Baufläche',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        3000: 'Gewerbliche Baufläche',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        4000: 'Sonderbaufläche',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        9999: 'Sonstige Baufläche',
      },
      besondereArtDerBaulNutzung: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1000: 'Kleinsiedlungsgebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1100: 'Reines Wohngebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1200: 'Allgemeines Wohngebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1300: 'Besonderes Wohngebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1400: 'Dorfgebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1450: 'Dörfliches Wohngebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1500: 'Mischgebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1550: 'Urbanes Gebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1600: 'Kerngebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1700: 'Gewerbegebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1800: 'Industriegebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        2000: 'Sondergebiet Erholung',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        2100: 'Sonstiges Sondergebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        3000: 'Wochenendhausgebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        4000: 'Sondergebiet',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        9999: 'Sonstiges Gebiet',
      },
      bauweise: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1000: 'Offene Bauweise',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        2000: 'Geschlossene Bauweise',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        3000: 'Abweichende Bauweise',
      },
      bebauungsArt: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        1000: 'Einzelhäuser',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        2000: 'Doppelhäuser',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        3000: 'Hausgruppen',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        4000: 'Einzel- oder Doppelhäuser',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        5000: 'Einzelhäuser oder Hausgruppen',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        6000: 'Doppelhäuser oder Hausgruppen',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        7000: 'Reihenhäuser',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        8000: 'Einzel-, Doppelhäuser und Hausgruppen',
      },
    },
    window: {
      state: {
        headerTitle: 'xplan.bplans.plan3d',
      },
      position: {
        width: '400px',
      },
    },
  } satisfies FeatureInfoViewOptions,
  plan2d: {
    type: PlanIframeWmsFeatureInfoView.className,
    name: 'xplan-iframeWms_plan2d',
    parameters: {
      FEATURE_COUNT: '100',
      QUERY_LAYERS: 'BP_Planvektor',
      LAYERS: 'BP_Planvektor',
    },
    window: {
      state: {
        headerTitle: 'xplan.bplans.featureInfoTitle',
      },
      position: {
        height: '100%',
        maxHeight: '100%',
        width: '30%',
        maxWidth: '30%',
      },
    },
  } satisfies PlanIframeWmsFeatureInfoViewOptions,
};

export function createPlanLayer(
  service: XplanBoxService,
  projection: Projection,
): VectorLayer {
  const layer = new VectorLayer({
    projection,
    style: new VectorStyleItem(getDefaultPlanStyle(service)),
    properties: {
      featureInfo: featureInfos.plan.name,
      title: 'xplan.bplans.plan2d',
    },
    vectorProperties: {
      classificationType: 'terrain',
    },
    zIndex: 1000,
  });
  markVolatile(layer);
  return layer;
}

export const xplanBPlanSymbol: unique symbol = Symbol('XplanBPlan');
export const xplanServiceSymbol: unique symbol = Symbol('XplanService');
export type Xplan2dLayer = WMSLayer & {
  [xplanBPlanSymbol]: Plan;
  [xplanServiceSymbol]: XplanBoxService;
};

export async function addPlan2dLayer(
  app: VcsUiApp,
  plan: Plan,
  service: XplanBoxService,
  zIndex: number,
): Promise<void> {
  const plugin = app.plugins.getByKey(name) as XplanPlugin;
  const layer = new WMSLayer({
    name: `${plan.getId()}_2d`,
    url: plan[xplanFeatureTypeSymbol].wmsUrl,
    version: '1.3.0',
    layers: 'BP_Planvektor',
    parameters: {
      TRANSPARENT: 'true',
      FORMAT: 'image/png',
    },
    featureInfo: {
      responseType: 'text/html',
      featureInfoFormat: 'WMSGetFeatureInfo',
      htmlPositionFeatureTitle: plan.get('nummer'),
      extent: {
        coordinates: plan.getGeometry()?.getExtent(),
        projection: mercatorProjection.toJSON(),
      },
    },
    properties: {
      featureInfo: featureInfos.plan2d.name,
      title: plan.get(plugin.config.bpPlanListAttribute),
    },
    zIndex,
  }) as Xplan2dLayer;
  layer[xplanBPlanSymbol] = plan;
  layer[xplanServiceSymbol] = service;
  app.layers.add(layer);
  await layer.activate();
}

export function removePlan2dLayer(app: VcsUiApp, plan: Plan): void {
  const layer = app.layers.getByKey(`${plan.getId()}_2d`);
  if (layer) {
    layer.deactivate();
    app.layers.remove(layer);
    layer.destroy();
  }
}

export function isXplan2dLayer(layer: Layer): layer is Xplan2dLayer {
  return (
    xplanBPlanSymbol in layer &&
    xplanServiceSymbol in layer &&
    layer.name.includes('_2d')
  );
}

export type Xplan3dLayer = VectorLayer & {
  [xplanBPlanSymbol]: Plan;
  [xplanServiceSymbol]: XplanBoxService;
};

export async function addPlan3dLayer(
  app: VcsUiApp,
  plan: Plan,
  service: XplanBoxService,
): Promise<void> {
  const cesiumMap = app.maps.getByType(CesiumMap.className)[0] as CesiumMap;
  if (!cesiumMap) {
    throw new Error('No CesiumMap available in the application');
  }
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  const activeTerrainProvider = cesiumMap.getScene()?.globe.terrainProvider;
  if (!activeTerrainProvider) {
    throw new Error('No active terrain provider in the CesiumMap');
  }

  const defaultVegetationModelUrl =
    getPluginAssetUrl(
      app,
      name,
      'plugin-assets/Tilia_tomentosa__Middle-aged-Lollipop.glb',
    ) || undefined;
  const { cubes, vegetation } = await load3dFeatures(
    plan,
    activeTerrainProvider as CesiumTerrainProvider,
    plugin.projection,
    plugin.cubeCreationOptions,
    plugin.config.vegetationCreationOptions,
    defaultVegetationModelUrl,
    {
      onUnassignedGrundstuecke() {
        app.notifier.add({
          message: 'xplan.administration.error.noBaugebiet',
          type: NotificationType.INFO,
          title: plan.get(plugin.config.bpPlanListAttribute),
        });
      },
    },
  );

  if (cubes.length || vegetation.length) {
    const { additionalStyles3d, defaultStyle3d } = plugin.config;
    const layer = new VectorLayer({
      projection: mercatorProjection.toJSON(),
      name: `${plan.getId()}_3d`,
      style: app.styles.getByKey(defaultStyle3d[service]),
      properties: {
        title: plan.get(plugin.config.bpPlanListAttribute),
        availableStyles: [
          defaultStyles[service].name,
          ...predefinedStyles.map((s) => s.name),
          ...additionalStyles3d,
        ],
        featureInfo: featureInfos.plan3d.name,
      },
    }) as Xplan3dLayer;
    layer[xplanBPlanSymbol] = plan;
    layer[xplanServiceSymbol] = service;
    app.layers.add(layer);
    cubes.forEach((f) => {
      f.set('title', 'xplan.bplans.plan3d');
    });
    layer.addFeatures(cubes);
    layer.addFeatures(vegetation);
  }
}

export function removePlan3dLayer(app: VcsUiApp, plan: Plan): void {
  const layer = app.layers.getByKey(`${plan.getId()}_3d`);
  if (layer) {
    layer.deactivate();
    app.layers.remove(layer);
    layer.destroy();
  }
}

export function isXplan3dLayer(layer: Layer): layer is Xplan3dLayer {
  return (
    xplanBPlanSymbol in layer &&
    xplanServiceSymbol in layer &&
    layer.name.endsWith('_3d')
  );
}
