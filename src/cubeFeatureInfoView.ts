import {
  AbstractFeatureInfoView,
  type FeatureInfoEvent,
  type FeatureInfoProps,
  type FeatureInfoViewOptions,
} from '@vcmap/ui';
import type { Layer } from '@vcmap/core';
import type { Feature } from 'ol';
import { is } from '@vcsuite/check';
import CubeInfoTable from './CubeInfoTable.vue';
import type { Planinhalt, PlaninhaltType } from './xplanAPI';
import {
  type ADDITIONAL_ATTRIBUTES,
  type Bezugspunkt,
  type Hoehenbezug,
  type HeightAttribute,
  DEFAULT_STOREY_ATTRIBUTE_PRIORITY,
  DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY,
} from './defaultOptions.js';
import {
  parseHoehenangabe,
  type ResolvedHeightAttribute,
  type ResolvedStoreyAttribute,
} from './createCubes.js';

export type CubeFeatureInfoViewProps = FeatureInfoProps & {
  calculatedHeights: CalculatedHeights;
  storeyRows: StoreyAttributeRow[];
  hoehenRows: HoehenAttributeRow[];
  metricsOfStructuralUse: MetricsOfStructuralUse;
  typeOfStructuralUse: TypeOfStructuralUse;
};

export const CALCULATED_HEIGHT_ATTRIBUTES = [
  'olcs_extrudedHeight',
  'olcs_groundLevel',
  'olcs_storeyHeightsAboveGround',
] as const;

export type CalculatedHeights = Record<
  (typeof CALCULATED_HEIGHT_ATTRIBUTES)[number],
  number | undefined
>;

const STOREY_ATTRIBUTES = [
  ...DEFAULT_STOREY_ATTRIBUTE_PRIORITY,
  'Zmin',
  'Z_Staffel',
] as const;

export type StoreyAttributeRow = {
  from: PlaninhaltType;
  attribute: (typeof STOREY_ATTRIBUTES)[number];
  value: string;
  selected: boolean;
};

function getStoreyAttributeRows(feature: Feature): StoreyAttributeRow[] {
  const rows: StoreyAttributeRow[] = [];

  const storeyResolvedFrom = feature.get('storeyResolvedFrom') as
    | PlaninhaltType
    | undefined;

  const baugebiet = feature.get(
    'baugebiet',
  ) as Planinhalt<'BP_BaugebietsTeilFlaeche'>;

  const grundstueck = feature.get('grundstueck') as
    | Planinhalt<'BP_UeberbaubareGrundstuecksFlaeche'>
    | undefined;

  const resolvedStoreyAttribute = feature.get('resolvedStoreyAttribute') as
    | ResolvedStoreyAttribute
    | undefined;

  const rowSelected = (row: StoreyAttributeRow): boolean =>
    resolvedStoreyAttribute?.attribute === row.attribute &&
    storeyResolvedFrom === row.from;

  const setRowFromPlaninhalt = (
    planinhalt: Planinhalt<PlaninhaltType>,
  ): void => {
    const from = planinhalt.type;
    STOREY_ATTRIBUTES.forEach((attribute) => {
      const value = planinhalt.feature.get(attribute) as unknown;
      if (is(value, Number) || is(value, String)) {
        const row = {
          from,
          attribute,
          value: String(value),
          selected: false,
        };
        row.selected = rowSelected(row);
        rows.push(row);
      }
    });
  };

  setRowFromPlaninhalt(baugebiet);
  if (grundstueck) {
    setRowFromPlaninhalt(grundstueck);
  }

  return rows;
}

export type HoehenAttributeRow = {
  from: PlaninhaltType;
  attribute: HeightAttribute;
  bezugspunkt: Bezugspunkt;
  hoehenbezug: Hoehenbezug;
  value: string;
  selected: boolean;
};

function getHoehenAttributeRows(feature: Feature): HoehenAttributeRow[] {
  const rows: HoehenAttributeRow[] = [];

  const baugebiet = feature.get(
    'baugebiet',
  ) as Planinhalt<'BP_BaugebietsTeilFlaeche'>;

  const grundstueck = feature.get('grundstueck') as
    | Planinhalt<'BP_UeberbaubareGrundstuecksFlaeche'>
    | undefined;

  const heightResolvedFrom = feature.get('heightsResolvedFrom') as
    | PlaninhaltType
    | undefined;

  const resolvedHeight = feature.get('resolvedHeightAttribute') as
    | ResolvedHeightAttribute
    | undefined;
  const resolvedGround = feature.get('resolvedGroundAttribute') as
    | ResolvedHeightAttribute
    | undefined;

  const rowSelected = (row: HoehenAttributeRow): boolean => {
    if (heightResolvedFrom === row.from) {
      return (
        (resolvedHeight?.attribute === row.attribute &&
          resolvedHeight?.bezugspunkt === row.bezugspunkt &&
          resolvedHeight?.hoehenbezug === row.hoehenbezug) ||
        (resolvedGround?.attribute === row.attribute &&
          resolvedGround?.bezugspunkt === row.bezugspunkt &&
          resolvedGround?.hoehenbezug === row.hoehenbezug)
      );
    }

    return false;
  };

  const setRowFromPlaninhalt = (
    planinhalt: Planinhalt<PlaninhaltType>,
  ): void => {
    const from = planinhalt.type;
    const hoehenangabe = planinhalt.feature.get('hoehenangabe') as unknown;
    const hArray = Array.isArray(hoehenangabe) ? hoehenangabe : [hoehenangabe];
    hArray
      .map((angabe) => parseHoehenangabe(angabe))
      .forEach((parsed) => {
        if (parsed) {
          DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY.forEach((attribute) => {
            const value = parsed[attribute];
            if (value != null) {
              const row = {
                from,
                attribute,
                bezugspunkt: parsed.bezugspunkt || 'EMPTY',
                hoehenbezug: parsed.hoehenbezug || 'EMPTY',
                value: String(value),
                selected: false,
              };
              row.selected = rowSelected(row);
              rows.push(row);
            }
          });
        }
      });
  };
  setRowFromPlaninhalt(baugebiet);
  if (grundstueck) {
    setRowFromPlaninhalt(grundstueck);
  }
  return rows;
}

const METRICS_OF_STRUCTURAL_USE_ATTRIBUTES = [
  'GRZ',
  'GFZ',
  'BMZ',
] as const satisfies (typeof ADDITIONAL_ATTRIBUTES)[number][];

export type MetricsOfStructuralUse = Record<
  (typeof METRICS_OF_STRUCTURAL_USE_ATTRIBUTES)[number],
  number | undefined
>;

const TYPE_OF_STRUCTURAL_USE_ATTRIBUTES = [
  'allgArtDerBaulNutzung',
  'besondereArtDerBaulNutzung',
  'bauweise',
  'bebauungsArt',
] as const satisfies (typeof ADDITIONAL_ATTRIBUTES)[number][];

export type TypeOfStructuralUse = Record<
  (typeof TYPE_OF_STRUCTURAL_USE_ATTRIBUTES)[number],
  number | undefined
>;

export default class CubeFeatureInfoView extends AbstractFeatureInfoView {
  static get className(): string {
    return 'CubeFeatureInfoView';
  }

  constructor(options: FeatureInfoViewOptions) {
    super(options, CubeInfoTable);
  }

  getProperties(
    featureInfo: FeatureInfoEvent,
    layer: Layer,
  ): CubeFeatureInfoViewProps {
    const properties = super.getProperties(featureInfo, layer);
    const attributes = properties.attributes as Record<string, unknown>;

    const calculatedHeights = Object.fromEntries(
      CALCULATED_HEIGHT_ATTRIBUTES.map((a) => {
        let value: number | string | undefined;
        if (a === 'olcs_storeyHeightsAboveGround') {
          value = (attributes[a] as number[] | undefined)?.join('; ');
        } else if (Number.isFinite(attributes[a])) {
          value = Math.round((attributes[a] as number) * 100) / 100;
        } else {
          value = attributes[a] as number | undefined;
        }
        return [`xplan.featureInfo.${a}`, value];
      }),
    ) as CalculatedHeights;
    const metricsOfStructuralUse = Object.fromEntries(
      METRICS_OF_STRUCTURAL_USE_ATTRIBUTES.map((a) => [
        a,
        attributes[a] as number | undefined,
      ]),
    ) as MetricsOfStructuralUse;
    const typeOfStructuralUse = Object.fromEntries(
      TYPE_OF_STRUCTURAL_USE_ATTRIBUTES.map((a) => [
        `xplan.featureInfo.${a}`,
        attributes[a] as number | undefined,
      ]),
    ) as TypeOfStructuralUse;

    return {
      ...properties,
      tags: {},
      calculatedHeights,
      storeyRows: getStoreyAttributeRows(
        featureInfo.feature as unknown as Feature,
      ),
      hoehenRows: getHoehenAttributeRows(
        featureInfo.feature as unknown as Feature,
      ),
      metricsOfStructuralUse,
      typeOfStructuralUse,
    };
  }
}
