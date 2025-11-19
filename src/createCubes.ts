import { Feature } from 'ol';
import type { MultiPolygon, Polygon } from 'ol/geom';
import { is, ofLiteralType, oneOf, optional } from '@vcsuite/check';
import {
  Cartographic,
  type CesiumTerrainProvider,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import { getFlatCoordinateReferences, mercatorToCartesian } from '@vcmap/core';
import type {
  GrundstueckIntersection,
  Planinhalt,
  PlaninhaltType,
} from './xplanAPI';
import {
  ADDITIONAL_ATTRIBUTES,
  type Bezugspunkt,
  BEZUGSPUNKT_VALUES,
  DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY,
  DEFAULT_STOREY_ATTRIBUTE_PRIORITY,
  type HeightAttribute,
  HOEHENBEZUG_VALUES,
  type Hoehenbezug,
  type CubeCreationOptions,
  type StoreyAttribute,
  type BezugspunktConfig,
  type TerrainLevelMethod,
} from './defaultOptions.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
type HeightValue = string | { _content_: string };

export type Hoehenangabe = Record<HeightAttribute, number | undefined> & {
  hoehenbezug?: Hoehenbezug;
  bezugspunkt?: Bezugspunkt;
};

function parseHoehenangabeValue(
  value?: string | HeightValue,
): number | undefined {
  let numericValue: number | undefined;
  if (is(value, String)) {
    numericValue = parseFloat(value);
    // eslint-disable-next-line @typescript-eslint/naming-convention
  } else if (is(value, { _content_: String })) {
    // eslint-disable-next-line no-underscore-dangle
    numericValue = parseFloat(value._content_);
  }

  if (Number.isFinite(numericValue)) {
    return numericValue;
  }
  return undefined;
}

/*
 * 1. höhenangaben kann be an array
 * 2. höhenangaben kann be a height or a ground level.
 * 2. if we only have one, take it, check if relative, else get height from terrain
 * 3. if we have TWO we create the difference based on top & bottom
 * 4. if we have more, fail
 * 5. we must have hoehenbezug, else fail
 * 6. we define bezugspunkt if its bottom or top. if missing, we define as top.
 */

// eslint-disable-next-line @typescript-eslint/naming-convention
const heightValuePattern = optional(oneOf(String, { _content_: String }));

export function parseHoehenangabe(angabe: unknown): Hoehenangabe | undefined {
  if (
    is(angabe, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      XP_Hoehenangabe: {
        h: heightValuePattern,
        hMin: heightValuePattern,
        hMax: heightValuePattern,
        hZwingend: heightValuePattern,
        hoehenbezug: optional(ofLiteralType(HOEHENBEZUG_VALUES)),
        bezugspunkt: optional(ofLiteralType(BEZUGSPUNKT_VALUES)),
      },
    })
  ) {
    const hoehenangabeXML = angabe.XP_Hoehenangabe;
    const parsedHoehenangabe: Partial<Hoehenangabe> = {};
    DEFAULT_HEIGHT_ATTRIBUTE_PRIORITY.forEach((attr) => {
      if (attr in hoehenangabeXML) {
        parsedHoehenangabe[attr] = parseHoehenangabeValue(
          hoehenangabeXML[attr],
        );
      }
    });
    parsedHoehenangabe.hoehenbezug = hoehenangabeXML.hoehenbezug;
    parsedHoehenangabe.bezugspunkt = hoehenangabeXML.bezugspunkt;

    return parsedHoehenangabe as Hoehenangabe;
  }
  return undefined;
}

export type ResolvedStoreyAttribute = {
  attribute: StoreyAttribute;
  value: number;
  priority: number;
};

export type ResolvedHeightAttribute = {
  attribute: HeightAttribute;
  bezugspunkt: Bezugspunkt;
  hoehenbezug: Hoehenbezug;
  value: number;
};

type FeatureAttributes = {
  storeyAttribute?: ResolvedStoreyAttribute;
  heightAttributes?: ResolvedHeightAttribute[];
  staffel?: number;
};

type ResolvedAttributes = {
  storeyAttribute?: ResolvedStoreyAttribute;
  heightAttribute?: ResolvedHeightAttribute;
  groundAttribute?: ResolvedHeightAttribute;
  groundLevel: number;
  skirt: number;
};

function getStoreyAttribute(
  feature: Feature,
  attributePriority: StoreyAttribute[],
): ResolvedStoreyAttribute | undefined {
  let property: { attribute: StoreyAttribute; value: unknown } | undefined;
  let priority = 0;
  for (const attribute of attributePriority) {
    const value = feature.get(attribute);
    // Zmax without Zmin is not a valid height attribute
    if (value != null && !(attribute === 'Zmax' && !feature.get('Zmin'))) {
      property = { value, attribute };
      break;
    }
    priority += 1;
  }

  if (property != null) {
    if (is(property.value, Number)) {
      return { attribute: property.attribute, value: property.value, priority };
    } else if (is(property.value, String)) {
      const parsedValue = parseFloat(property.value);
      if (isFinite(parsedValue)) {
        return { attribute: property.attribute, value: parsedValue, priority };
      }
    }
  }
  return undefined;
}

function getHeightAttribute(
  hoehenangabe: Hoehenangabe,
  attributePriority: HeightAttribute[],
): ResolvedHeightAttribute | undefined {
  let property: { attribute: HeightAttribute; value: number } | undefined;
  for (const attribute of attributePriority) {
    const value = hoehenangabe[attribute];
    if (value != null) {
      property = { value, attribute };
      break;
    }
  }

  if (property != null) {
    const height = property.value;
    if (height != null) {
      return {
        attribute: property.attribute,
        value: height,
        bezugspunkt: hoehenangabe.bezugspunkt ?? 'EMPTY',
        hoehenbezug: hoehenangabe.hoehenbezug ?? 'EMPTY',
      };
    }
  }
  return undefined;
}

function getStaffelAttribute(feature: Feature): number | undefined {
  const value = feature.get('Z_Staffel');
  if (is(value, Number)) {
    return value;
  } else if (is(value, String)) {
    const parsedValue = parseFloat(value);
    if (isFinite(parsedValue)) {
      return parsedValue;
    }
  }
  return undefined;
}

async function getFeatureHeight(
  geometry: Polygon | MultiPolygon,
  terrainProvider: CesiumTerrainProvider,
): Promise<Record<TerrainLevelMethod, number>> {
  const flatCoordinates = getFlatCoordinateReferences(geometry);
  const cartographics = flatCoordinates.map((c) =>
    Cartographic.fromCartesian(mercatorToCartesian(c)),
  );
  await sampleTerrainMostDetailed(terrainProvider, cartographics);
  const heights: Record<TerrainLevelMethod, number> = {
    average: 0,
    min: Infinity,
    max: -Infinity,
  };

  for (const c of cartographics) {
    if (c.height != null) {
      heights.average += c.height;
      if (c.height < heights.min) {
        heights.min = c.height;
      }
      if (c.height > heights.max) {
        heights.max = c.height;
      }
    }
  }
  heights.average /= cartographics.length;
  if (!isFinite(heights.min)) {
    heights.min = 0;
  }
  if (!isFinite(heights.max)) {
    heights.max = 0;
  }
  return heights;
}

function isRelativeHoehenbezug(hohenbezug: Hoehenbezug): boolean {
  return ['EMPTY', '2000', '2500', '3000', '3500', '4000'].includes(hohenbezug);
}

function getAssignedHeightAttributes(
  heightAttributes: ResolvedHeightAttribute[],
  heightBezugspunktPriority: BezugspunktConfig[],
  groundBezugspunktPriority: BezugspunktConfig[],
  terrainBezugspunktPriority: BezugspunktConfig[],
): {
  heightAttribute?: ResolvedHeightAttribute;
  groundAttribute?: ResolvedHeightAttribute;
  terrainAttribute?: ResolvedHeightAttribute;
} {
  let heightAttribute: ResolvedHeightAttribute | undefined;
  let groundAttribute: ResolvedHeightAttribute | undefined;
  let terrainAttribute: ResolvedHeightAttribute | undefined;

  for (const config of heightBezugspunktPriority) {
    heightAttribute = heightAttributes.find(
      (h) => h.bezugspunkt === config.bezugspunkt,
    );
    if (heightAttribute) {
      break;
    }
  }

  for (const config of groundBezugspunktPriority) {
    groundAttribute = heightAttributes.find(
      (h) => h.bezugspunkt === config.bezugspunkt,
    );
    if (groundAttribute) {
      break;
    }
  }

  for (const config of terrainBezugspunktPriority) {
    terrainAttribute = heightAttributes.find(
      (h) => h.bezugspunkt === config.bezugspunkt,
    );
    if (terrainAttribute) {
      break;
    }
  }

  return { heightAttribute, groundAttribute, terrainAttribute };
}

function getAttributes(
  feature: Feature,
  options: CubeCreationOptions,
): FeatureAttributes {
  const storeyAttribute = getStoreyAttribute(
    feature,
    options.storeyAttributePriority,
  );
  const staffel = getStaffelAttribute(feature);

  const hoehenangabe = feature.get('hoehenangabe');
  let heightAttributes: ResolvedHeightAttribute[] | undefined;

  if (hoehenangabe != null) {
    const angabenArray = Array.isArray(hoehenangabe)
      ? hoehenangabe
      : [hoehenangabe];

    heightAttributes = angabenArray
      .map((angabe) => {
        const parsedHoehenangabe = parseHoehenangabe(angabe);
        if (parsedHoehenangabe) {
          return getHeightAttribute(
            parsedHoehenangabe,
            options.heightAttributePriority,
          );
        }
        return undefined;
      })
      .filter((h): h is ResolvedHeightAttribute => h != null);

    if (heightAttributes.length === 0) {
      heightAttributes = undefined;
    }
  }

  return {
    storeyAttribute,
    heightAttributes,
    staffel,
  };
}

async function determineHeightProperties(
  feature: Feature<Polygon | MultiPolygon>,
  cesiumTerrainProvider: CesiumTerrainProvider,
  terrainLevelMethod: TerrainLevelMethod,
  featureAttributes: FeatureAttributes,
  heightBezugspunktPriority: BezugspunktConfig[],
  groundBezugspunktPriority: BezugspunktConfig[],
  terrainBezugspunktPriority: BezugspunktConfig[],
): Promise<ResolvedAttributes> {
  const featureHeights = await getFeatureHeight(
    feature.getGeometry() as Polygon | MultiPolygon,
    cesiumTerrainProvider,
  );
  let terrainLevel = featureHeights[terrainLevelMethod];
  let heightAttribute: ResolvedHeightAttribute | undefined;
  let groundAttribute: ResolvedHeightAttribute | undefined;
  let terrainAttribute: ResolvedHeightAttribute | undefined;

  if (featureAttributes.heightAttributes) {
    ({ terrainAttribute, groundAttribute, heightAttribute } =
      getAssignedHeightAttributes(
        featureAttributes.heightAttributes,
        heightBezugspunktPriority,
        groundBezugspunktPriority,
        terrainBezugspunktPriority,
      ));

    if (
      terrainAttribute &&
      !isRelativeHoehenbezug(terrainAttribute.hoehenbezug)
    ) {
      terrainLevel = terrainAttribute.value;
    }

    let groundOffset = 0;
    if (groundAttribute) {
      if (isRelativeHoehenbezug(groundAttribute.hoehenbezug)) {
        groundOffset = groundAttribute.value;
        groundAttribute.value += terrainLevel;
      } else {
        groundOffset = groundAttribute.value - terrainLevel;
      }
    }

    if (heightAttribute) {
      if (!isRelativeHoehenbezug(heightAttribute.hoehenbezug)) {
        // height is absolute. reduce to terrain level
        heightAttribute.value -= terrainLevel;
      }

      if (heightAttribute.hoehenbezug !== '4000' && groundOffset) {
        // height is not relative to ground floor, subtract ground offset
        heightAttribute.value -= groundOffset;
      }
    }
  }

  const groundLevel = groundAttribute ? groundAttribute.value : terrainLevel;
  let skirt = groundLevel - featureHeights.min; // skirt to min terrain height
  if (skirt < 0) {
    skirt = 0;
  }

  const { storeyAttribute } = featureAttributes;
  if (storeyAttribute && featureAttributes.staffel != null) {
    storeyAttribute.value += featureAttributes.staffel;
  }

  return {
    groundLevel,
    skirt,
    heightAttribute,
    groundAttribute,
    storeyAttribute,
  };
}

function determineGrundstueckAttributes(
  baugebietsAttribute: FeatureAttributes,
  grundstueckAttribute: FeatureAttributes,
): FeatureAttributes & {
  heightsResolvedFrom?: PlaninhaltType;
  storeyResolvedFrom?: PlaninhaltType;
  staffelResolvedFrom?: PlaninhaltType;
  heightInBoth: boolean;
} {
  let storeyAttribute: ResolvedStoreyAttribute | undefined;
  let heightAttributes: ResolvedHeightAttribute[] | undefined;
  let staffel: number | undefined;
  let storeyResolvedFrom: PlaninhaltType | undefined;
  let heightsResolvedFrom: PlaninhaltType | undefined;
  let staffelResolvedFrom: PlaninhaltType | undefined;
  let heightInBoth = false;

  if (
    baugebietsAttribute.storeyAttribute &&
    grundstueckAttribute.storeyAttribute
  ) {
    if (
      baugebietsAttribute.storeyAttribute.priority <
      grundstueckAttribute.storeyAttribute.priority
    ) {
      storeyAttribute = baugebietsAttribute.storeyAttribute;
      storeyResolvedFrom = 'BP_BaugebietsTeilFlaeche';
    } else {
      storeyAttribute = grundstueckAttribute.storeyAttribute;
      storeyResolvedFrom = 'BP_UeberbaubareGrundstuecksFlaeche';
    }
  } else if (
    !baugebietsAttribute.storeyAttribute &&
    grundstueckAttribute.storeyAttribute
  ) {
    storeyAttribute = grundstueckAttribute.storeyAttribute;
    storeyResolvedFrom = 'BP_UeberbaubareGrundstuecksFlaeche';
  } else if (
    !grundstueckAttribute.storeyAttribute &&
    baugebietsAttribute.storeyAttribute
  ) {
    storeyAttribute = baugebietsAttribute.storeyAttribute;
    storeyResolvedFrom = 'BP_BaugebietsTeilFlaeche';
  }

  if (
    baugebietsAttribute.heightAttributes &&
    grundstueckAttribute.heightAttributes
  ) {
    heightInBoth = true;
    heightAttributes = grundstueckAttribute.heightAttributes;
    heightsResolvedFrom = 'BP_UeberbaubareGrundstuecksFlaeche';
  } else if (
    !baugebietsAttribute.heightAttributes &&
    grundstueckAttribute.heightAttributes
  ) {
    heightAttributes = grundstueckAttribute.heightAttributes;
    heightsResolvedFrom = 'BP_UeberbaubareGrundstuecksFlaeche';
  } else if (
    !grundstueckAttribute.heightAttributes &&
    baugebietsAttribute.heightAttributes
  ) {
    heightAttributes = baugebietsAttribute.heightAttributes;
    heightsResolvedFrom = 'BP_BaugebietsTeilFlaeche';
  }

  if (grundstueckAttribute.staffel != null) {
    staffelResolvedFrom = 'BP_UeberbaubareGrundstuecksFlaeche';
    ({ staffel } = grundstueckAttribute);
  } else if (baugebietsAttribute.staffel != null) {
    staffelResolvedFrom = 'BP_BaugebietsTeilFlaeche';
    ({ staffel } = baugebietsAttribute);
  }

  return {
    heightInBoth,
    storeyAttribute,
    heightAttributes,
    staffel,
    storeyResolvedFrom,
    heightsResolvedFrom,
    staffelResolvedFrom,
  };
}

function setOlcsProperties(
  feature: Feature<Polygon | MultiPolygon>,
  defaultStoreyHeight: number,
  attributes: ResolvedAttributes,
): void {
  if (attributes.heightAttribute) {
    feature.set('resolvedHeightAttribute', attributes.heightAttribute);
    feature.set('olcs_extrudedHeight', attributes.heightAttribute.value);
  }

  if (attributes.groundAttribute) {
    feature.set('resolvedGroundAttribute', attributes.groundAttribute);
  }
  feature.set('olcs_groundLevel', attributes.groundLevel);

  if (attributes.storeyAttribute) {
    feature.set('resolvedStoreyAttribute', attributes.storeyAttribute);
    feature.set('olcs_storeysAboveGround', attributes.storeyAttribute.value);
    if (!attributes.heightAttribute) {
      feature.set(
        'olcs_storeyHeightsAboveGround',
        new Array(attributes.storeyAttribute.value).fill(defaultStoreyHeight),
      );
    }
  }

  if (attributes.skirt) {
    feature.set('olcs_skirt', attributes.skirt);
  }
}

function setAdditionalProperties(
  feature: Feature,
  baugebiet: Planinhalt<'BP_BaugebietsTeilFlaeche'>,
  grundstueck?: Planinhalt<'BP_UeberbaubareGrundstuecksFlaeche'>,
): void {
  ADDITIONAL_ATTRIBUTES.forEach((key) => {
    feature.set(key, baugebiet.feature.get(key));
  });

  const heightResolvedFrom = feature.get('heightResolvedFrom');
  let hoehenangabe: unknown;
  if (heightResolvedFrom === 'BP_BaugebietsTeilFlaeche') {
    hoehenangabe = baugebiet.feature.get('hoehenangabe');
  } else if (
    heightResolvedFrom === 'BP_UeberbaubareGrundstuecksFlaeche' &&
    grundstueck
  ) {
    hoehenangabe = grundstueck.feature.get('hoehenangabe');
  }

  if (hoehenangabe != null) {
    const parsed = Array.isArray(hoehenangabe) ? hoehenangabe : [hoehenangabe];
    feature.set(
      'additionalHeightAttributes',
      parsed
        .map((angabe) => parseHoehenangabe(angabe))
        .filter((a) => a != null),
    );
  }

  const storeyResolvedFrom = feature.get('storeyResolvedFrom');
  const storeyAttributes: Record<string, unknown> = {};
  if (storeyResolvedFrom === 'BP_BaugebietsTeilFlaeche') {
    feature.set(
      'additionalStoreyAttributes',
      [...DEFAULT_STOREY_ATTRIBUTE_PRIORITY, 'Zmin', 'Z_Staffel'].reduce(
        (acc, attr) => {
          acc[attr] = baugebiet.feature.get(attr) as unknown;
          return acc;
        },
        storeyAttributes,
      ),
    );
  } else if (
    storeyResolvedFrom === 'BP_UeberbaubareGrundstuecksFlaeche' &&
    grundstueck
  ) {
    feature.set(
      'additionalStoreyAttributes',
      [...DEFAULT_STOREY_ATTRIBUTE_PRIORITY, 'Zmin', 'Z_Staffel'].reduce(
        (acc, attr) => {
          acc[attr] = grundstueck.feature.get(attr) as unknown;
          return acc;
        },
        storeyAttributes,
      ),
    );
  }
}

export async function createCubes(
  grundstueckIntersections: GrundstueckIntersection,
  terrainProvider: CesiumTerrainProvider,
  options: CubeCreationOptions,
): Promise<Feature<Polygon | MultiPolygon>> {
  const { baugebiet, grundstueck, geometry } = grundstueckIntersections;
  const baugebietsAttribute = getAttributes(baugebiet.feature, options);

  let feature: Feature<Polygon | MultiPolygon>;
  let attributes: FeatureAttributes;
  if (!grundstueck) {
    feature = new Feature({
      geometry,
      baugebiet,
      heightsResolvedFrom: 'BP_BaugebietsTeilFlaeche',
      storeyResolvedFrom: 'BP_BaugebietsTeilFlaeche',
      staffelResolvedFrom: 'BP_BaugebietsTeilFlaeche',
      staffel: baugebietsAttribute.staffel,
      heightInBoth: false,
    });

    attributes = baugebietsAttribute;
  } else {
    const grundstueckAttribute = getAttributes(grundstueck.feature, options);

    const comparedAttribute = determineGrundstueckAttributes(
      baugebietsAttribute,
      grundstueckAttribute,
    );

    const {
      staffel,
      heightsResolvedFrom,
      storeyResolvedFrom,
      staffelResolvedFrom,
      heightInBoth,
    } = comparedAttribute;
    attributes = comparedAttribute;
    feature = new Feature({
      geometry,
      baugebiet,
      grundstueck,
      heightsResolvedFrom,
      storeyResolvedFrom,
      staffelResolvedFrom,
      staffel,
      heightInBoth,
    });
  }

  const heightBezugspunktPriority: BezugspunktConfig[] = [];
  const groundBezugspunktPriority: BezugspunktConfig[] = [];
  const terrainBezugspunktPriority: BezugspunktConfig[] = [];
  options.bezugspunktPriority.forEach((config) => {
    if (config.relation === 'height') {
      heightBezugspunktPriority.push(config);
    } else if (config.relation === 'groundFloor') {
      groundBezugspunktPriority.push(config);
    } else if (config.relation === 'terrain') {
      terrainBezugspunktPriority.push(config);
    }
  });

  const resolvedProperties = await determineHeightProperties(
    feature,
    terrainProvider,
    options.terrainLevelMethod,
    attributes,
    heightBezugspunktPriority,
    groundBezugspunktPriority,
    terrainBezugspunktPriority,
  );

  setOlcsProperties(feature, options.defaultStoreyHeight, resolvedProperties);
  setAdditionalProperties(feature, baugebiet, grundstueck);

  return feature;
}
