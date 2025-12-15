import type { ProjectionOptions } from '@vcmap/core';
import type { PlanQuery, XplanBoxService } from './xplanAPI';
import { defaultStyles } from './cubeStyles.js';

export const xplanWindowId = 'xplan-window-id';
export const bplanFilterWindowId = 'xplan-filter-window-id';

export const RECHTSSTAND_VALUES = [
  '1000',
  '2000',
  '2100',
  '2200',
  '2250',
  '2300',
  '2400',
  '3000',
  '4000',
  '4500',
  '45000',
  '45001',
  '5000',
  '50000',
  '50001',
] as const;
export type Rechtsstand = (typeof RECHTSSTAND_VALUES)[number];

export const RECHTSSTAND_NAME: Record<Rechtsstand, string> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '1000': 'Aufstellungsbeschluss',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2000': 'ImVerfahren',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2100': 'FruehzeitigeBehoerdenBeteiligung',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2200': 'FruehzeitigeOeffentlichkeitsBeteiligung',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2250': 'Entwurfsbeschluss',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2300': 'BehoerdenBeteiligung',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2400': 'OeffentlicheAuslegung',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '3000': 'Satzung',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '4000': 'InKraftGetreten',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '4500': 'TeilweiseUntergegangen',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '45000': 'TeilweiseAufgehoben',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '45001': 'TeilweiseAusserKraft',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '5000': 'Untergegangen',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '50000': 'Aufgehoben',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '50001': 'AusserKraft',
};

export const PLAN_ART_VALUES = [
  '1000',
  '10000',
  '10001',
  '10002',
  '3000',
  '3100',
  '4000',
  '40000',
  '40001',
  '40002',
  '5000',
  '7000',
  '9999',
] as const;
export type PlanArt = (typeof PLAN_ART_VALUES)[number];

export const DEFAULT_STOREY_ATTRIBUTE_PRIORITY = [
  'Z',
  'Zmax',
  'Zmin',
  'Zzwingend',
  'Z_Ausn',
] as const;
export type StoreyAttribute =
  (typeof DEFAULT_STOREY_ATTRIBUTE_PRIORITY)[number];
export const HOEHENBEZUG_VALUES = [
  'EMPTY',
  '1000',
  '1100',
  '1200',
  '2000',
  '2500',
  '3000',
  '3500',
  '4000',
] as const;
export type Hoehenbezug = (typeof HOEHENBEZUG_VALUES)[number];
export const HOEHENBEZUG_NAME: Record<Hoehenbezug, string> = {
  EMPTY: 'Keine Angabe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '1000': 'Absolut NHN',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '1100': 'Absolut NN',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '1200': 'Absolut DHHN',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2000': 'Relativ Gelände-Oberkante',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2500': 'Relativ Gehweg-Oberkante',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '3000': 'Relativ Bezugshöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '3500': 'Relativ Straße',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '4000': 'Relativ Erdgeschoss-Fußbodenhöhe',
};
export const BEZUGSPUNKT_VALUES = [
  'EMPTY',
  '1000',
  '2000',
  '3000',
  '3500',
  '4000',
  '4500',
  '5000',
  '5500',
  '6000',
  '6500',
  '6600',
] as const;
export type Bezugspunkt = (typeof BEZUGSPUNKT_VALUES)[number];
export const BEZUGSPUNKT_NAME: Record<Bezugspunkt, string> = {
  EMPTY: 'Keine Angabe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '1000': 'Traufhöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '2000': 'Firsthöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '3000': 'Oberkante',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '3500': 'Lichte Höhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '4000': 'Sockelhöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '4500': 'Erdgeschoss-Fußbodenhöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '5000': 'Höhe baulicher Anlagen',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '5500': 'Unterkante',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '6000': 'Gebäudehöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '6500': 'Wandhöhe',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '6600': 'Geländeoberkante',
};

export const BEZUGSPUNKT_RELATION = [
  'height',
  'groundFloor',
  'terrain',
] as const;
export type BezugspunktConfig = {
  bezugspunkt: Bezugspunkt;
  relation: (typeof BEZUGSPUNKT_RELATION)[number];
};
export const DEFAULT_BEZUGSPUNKT_PRIORITY: BezugspunktConfig[] = [
  { bezugspunkt: 'EMPTY', relation: 'height' },
  { bezugspunkt: '5000', relation: 'height' },
  { bezugspunkt: '6000', relation: 'height' },
  { bezugspunkt: '6500', relation: 'height' },
  { bezugspunkt: '1000', relation: 'height' },
  { bezugspunkt: '2000', relation: 'height' },
  { bezugspunkt: '3000', relation: 'height' },
  { bezugspunkt: '3500', relation: 'height' },
  { bezugspunkt: '4500', relation: 'groundFloor' },
  { bezugspunkt: '4000', relation: 'groundFloor' },
  { bezugspunkt: '5500', relation: 'terrain' },
  { bezugspunkt: '6600', relation: 'terrain' },
];
export const DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY = [
  'h',
  'hMax',
  'hMin',
  'hZwingend',
] as const;
export type HeightAttribute =
  (typeof DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY)[number];
/**
 * attributes added to the balloon from the BTF
 */
export const ADDITIONAL_ATTRIBUTES = [
  'allgArtDerBaulNutzung',
  'besondereArtDerBaulNutzung',
  'GFZ',
  'GRZ',
  'BMZ',
  'bauweise',
  'bebauungsArt',
] as const;

export const TERRAIN_LEVEL_METHOD_VALUES = ['min', 'max', 'average'] as const;
export type TerrainLevelMethod = (typeof TERRAIN_LEVEL_METHOD_VALUES)[number];

export type CubeCreationOptions = {
  storeyAttributePriority: StoreyAttribute[];
  heightAttributePriority: HeightAttribute[];
  bezugspunktPriority: BezugspunktConfig[];
  defaultStoreyHeight: number;
  terrainLevelMethod: TerrainLevelMethod;
};

export function getDefaultCubeCreationOptions(): CubeCreationOptions {
  return {
    storeyAttributePriority: [...DEFAULT_STOREY_ATTRIBUTE_PRIORITY],
    heightAttributePriority: [...DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY],
    bezugspunktPriority: structuredClone(DEFAULT_BEZUGSPUNKT_PRIORITY),
    defaultStoreyHeight: 3,
    terrainLevelMethod: 'average',
  };
}

export enum BPPlanListAttribute {
  NAME = 'name',
  NUMMER = 'nummer',
}

export type Style3dOptions = Record<XplanBoxService, string>;

export type XplanConfig = {
  projection: ProjectionOptions;
  bpPlanListAttribute: BPPlanListAttribute;
  additionalStyles3d: string[];
  defaultStyle3d: Style3dOptions;
  xplanBoxUrl: string;
  xplanBoxServices: XplanBoxService[];
  filterInitiallyOpen: boolean;
  cubeCreationOptions: CubeCreationOptions;
  minZIndex: number;
};

export default function getDefaultOptions(): XplanConfig {
  return {
    projection: {
      epsg: 'EPSG:25832',
      proj4: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',
    },
    bpPlanListAttribute: BPPlanListAttribute.NAME,
    xplanBoxUrl: '',
    xplanBoxServices: ['pre', 'current'],
    filterInitiallyOpen: true,
    additionalStyles3d: [],
    defaultStyle3d: {
      pre: defaultStyles.pre.name!,
      current: defaultStyles.current.name!,
      archive: defaultStyles.archive.name!,
    },
    cubeCreationOptions: getDefaultCubeCreationOptions(),
    minZIndex: 10,
  };
}

export function getMergedConfig(config: XplanConfig): XplanConfig {
  const defaultConfig = getDefaultOptions();
  return {
    ...defaultConfig,
    ...config,
    defaultStyle3d: {
      ...defaultConfig.defaultStyle3d,
      ...config.defaultStyle3d,
    },
    cubeCreationOptions: {
      ...defaultConfig.cubeCreationOptions,
      ...config.cubeCreationOptions,
    },
  };
}

function getDefaultFilterOptions(): PlanQuery {
  return {
    gemeinde: undefined,
    number: undefined,
    name: undefined,
    rechtsstand: [],
    planArt: ['1000', '10000', '10001', '10002', '3000', '3100'],
    inkrafttretensDatum: undefined,
    startIndex: 0,
    count: 10,
    sortBy: BPPlanListAttribute.NAME,
    sortOrder: 'ASC',
  };
}

export function getEmptyFilter(config: XplanConfig): PlanQuery {
  return {
    ...getDefaultFilterOptions(),
    sortBy: config.bpPlanListAttribute,
  };
}

export function getDefaultPageSizes(): Record<XplanBoxService, number> {
  return {
    current: 10,
    pre: 5,
    archive: 5,
  };
}

/**
 * Determines the page size for each service.
 * Since a longer list offers the greatest advantage in the "current" service,
 * the page size of the missing services is added to "current."
 * @param services The services configured
 * @returns Page sizes for each passed in service
 */
export function getPageSizesFor(
  services: XplanBoxService[],
): Partial<Record<XplanBoxService, number>> {
  const defaultPageSizes = getDefaultPageSizes();
  const pageSizes: Partial<Record<XplanBoxService, number>> = {};
  services.forEach((service) => {
    pageSizes[service] = defaultPageSizes[service];
    if (service === 'current') {
      if (!services.includes('pre')) {
        pageSizes[service] += defaultPageSizes.pre;
      }
      if (!services.includes('archive')) {
        pageSizes[service] += defaultPageSizes.archive;
      }
    }
  });
  return pageSizes;
}
