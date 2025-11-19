import {
  enforceEndingVertex,
  Extent,
  type ExtentOptions,
  mercatorProjection,
  type Projection,
  wgs84Projection,
} from '@vcmap/core';
import {
  and,
  bbox,
  equalTo,
  greaterThanOrEqualTo,
  like,
  or,
} from 'ol/format/filter.js';
import type Filter from 'ol/format/filter/Filter.js';
import WFSFormat from 'ol/format/WFS.js';
import GeoJSONFormat, {
  type GeoJSONMultiPolygon,
  type GeoJSONPolygon,
} from 'ol/format/GeoJSON.js';
import type { FeatureCollection } from 'geojson';
import type { Feature } from 'ol';
import { MultiPolygon, Polygon } from 'ol/geom';
import { is, ofLiteralType } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import { area as getArea } from '@turf/area';
import { intersect } from '@turf/intersect';
import { type CesiumTerrainProvider } from '@vcmap-cesium/engine';
import pgk from '../package.json';
import { createCubes } from './createCubes.js';
import type { CubeCreationOptions } from './defaultOptions';

export const xplanFeatureTypeSymbol: unique symbol = Symbol('XplanFeatureType');
const PLANINHALT_FEATURE_TYPE = [
  'BP_BaugebietsTeilFlaeche',
  'BP_UeberbaubareGrundstuecksFlaeche',
] as const;

const FEATURE_TYPE = [...PLANINHALT_FEATURE_TYPE, 'BP_Plan'] as const;

export const SUPPORTED_XPLAN_VERSIONS = ['5.2', '5.3', '5.4', '6.0'] as const;

export type XplanVersion = (typeof SUPPORTED_XPLAN_VERSIONS)[number];

export const XPLAN_BOX_SERVICES = ['pre', 'current', 'archive'] as const;

export type XplanBoxService = (typeof XPLAN_BOX_SERVICES)[number];

export type PlanAPI = {
  type: (typeof FEATURE_TYPE)[2];
  xplanVersion: (typeof SUPPORTED_XPLAN_VERSIONS)[number];
  getByIdUrl: string;
  wmsUrl: string;
};

export type Plan = Feature<Polygon | MultiPolygon> & {
  [xplanFeatureTypeSymbol]: PlanAPI;
};

export type SortOrder = 'ASC' | 'DESC';

export type PlanQuery = {
  bbox?: ExtentOptions;
  gemeinde?: string;
  // fuzzy
  name?: string;
  // prefix
  number?: string;
  // exact
  rechtsstand?: string[];
  // gte
  inkrafttretensDatum?: Date;
  count?: number;
  startIndex?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
};

export type PlaninhaltType = (typeof PLANINHALT_FEATURE_TYPE)[number];
export type Planinhalt<T extends PlaninhaltType> = {
  type: T;
  feature: Feature<Polygon | MultiPolygon>;
};

export type GrundstueckIntersection = {
  baugebiet: Planinhalt<'BP_BaugebietsTeilFlaeche'>;
  grundstueck?: Planinhalt<'BP_UeberbaubareGrundstuecksFlaeche'>;
  geometry: Polygon | MultiPolygon;
};

export const XPLAN_NS: Record<XplanVersion, string> = Object.freeze({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '5.2': 'http://www.xplanung.de/xplangml/5/2',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '5.3': 'http://www.xplanung.de/xplangml/5/3',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '5.4': 'http://www.xplanung.de/xplangml/5/4',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '6.0': 'http://www.xplanung.de/xplangml/6',
});

const SYN_WFS_NS = 'http://www.deegree.org/xplanung/1/0';
const WFS_20_NS = 'http://www.opengis.net/wfs/2.0';
const FES_NS = 'http://www.opengis.net/fes/2.0';

let synWfsFormat: WFSFormat | undefined;
export function getSynWFSFormat(): WFSFormat {
  if (!synWfsFormat) {
    synWfsFormat = new WFSFormat({
      featureNS: { xplan: SYN_WFS_NS },
      featureType: [...FEATURE_TYPE.map((t) => `xplan:${t}`)],
      version: '2.0.0',
    });
  }
  return synWfsFormat;
}

function getWFSFormat(
  xplanVersion: XplanVersion,
  featureType: PlaninhaltType,
): WFSFormat {
  return new WFSFormat({
    featureNS: { xplan: XPLAN_NS[xplanVersion] },
    featureType: `xplan:${featureType}`,
    version: '2.0.0',
  });
}

let geojsonFormat: GeoJSONFormat | undefined;
function getGeojsonFormat(): GeoJSONFormat {
  if (!geojsonFormat) {
    geojsonFormat = new GeoJSONFormat({});
  }
  return geojsonFormat;
}

function createFilter(query: PlanQuery): Filter | undefined {
  const filters: Filter[] = [];
  if (query.gemeinde) {
    filters.push(like('xplan:gemeinde', `*Gemeinde: ${query.gemeinde}*`));
  }
  if (query.name) {
    filters.push(
      like(
        'xplan:name',
        `*${query.name}*`,
        undefined,
        undefined,
        undefined,
        false,
      ),
    );
  }
  if (query.bbox) {
    const bboxExtent = new Extent(query.bbox);
    filters.push(
      bbox(
        'xplan:raeumlicherGeltungsbereich',
        bboxExtent.getCoordinatesInProjection(wgs84Projection),
        'EPSG:4326',
      ),
    );
  }
  if (query.number) {
    filters.push(
      like(
        'xplan:nummer',
        `*${query.number}*`,
        undefined,
        undefined,
        undefined,
        false,
      ),
    );
  }
  if (query.rechtsstand && query.rechtsstand.length > 0) {
    const rechtsstandComparisons = query.rechtsstand.map((rechtsstand) =>
      equalTo('xplan:rechtsstand', rechtsstand),
    );
    filters.push(
      rechtsstandComparisons.length > 1
        ? or(...rechtsstandComparisons)
        : rechtsstandComparisons[0],
    );
  }
  if (query.inkrafttretensDatum) {
    filters.push(
      greaterThanOrEqualTo(
        'xplan:inkrafttretensDatum',
        query.inkrafttretensDatum
          .toISOString()
          .substring(0, 10) as unknown as number, // ol expects a number
      ),
    );
  }

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return and(...filters);
}

function addSort(
  request: Node,
  sortBy: string,
  sortOrder: SortOrder = 'ASC',
): void {
  const doc = request.ownerDocument!;
  const queryEl = request.firstChild!;
  const sortByEl = doc.createElementNS(FES_NS, 'fes:SortBy');
  const sortPropEl = doc.createElementNS(FES_NS, 'fes:SortProperty');
  const valRefEl = doc.createElementNS(FES_NS, 'fes:ValueReference');
  valRefEl.textContent = `xplan:${sortBy}`;
  const sortOrderEl = doc.createElementNS(FES_NS, 'fes:SortOrder');
  sortOrderEl.textContent = sortOrder;
  sortPropEl.appendChild(valRefEl);
  sortPropEl.appendChild(sortOrderEl);
  sortByEl.appendChild(sortPropEl);
  queryEl.insertBefore(sortByEl, queryEl.firstChild);
}

function createGetFeaturesRequest(query: PlanQuery, hits?: boolean): string {
  const wfsFormat = getSynWFSFormat();

  const getFeatures = wfsFormat.writeGetFeature({
    featureNS: SYN_WFS_NS,
    featurePrefix: 'xplan',
    featureTypes: ['BP_Plan'],
    outputFormat: 'application/gml+xml; version=3.2',
    count: query.count,
    startIndex: query.startIndex,
    filter: createFilter(query),
    resultType: hits ? 'hits' : undefined,
  });

  if (query.sortBy) {
    addSort(getFeatures, query.sortBy, query.sortOrder);
  }
  return new XMLSerializer().serializeToString(getFeatures);
}

function getServiceSuffix(xplanBoxService: XplanBoxService): string {
  if (xplanBoxService === 'current') {
    return '';
  }
  return xplanBoxService;
}

function getSynwfsUrl(xplanBoxUrl: string, service: XplanBoxService): string {
  return `${xplanBoxUrl.replace(/\/$/, '')}/xplansyn-wfs/services/xplansynwfs${getServiceSuffix(service)}`;
}

function getPlanUrl(
  xplanBoxUrl: string,
  service: XplanBoxService,
  xplanVersion: XplanVersion,
  name: string,
): string {
  return `${xplanBoxUrl.replace(/\/$/, '')}/xplan-wfs/services/wfs${xplanVersion.replace(/\./, '')}${getServiceSuffix(
    service,
  )}?service=WFS&version=2.0.0&request=GetFeature&resolvedepth=*&resolve=all&StoredQuery_ID=urn:ogc:def:query:OGC-WFS::PlanName&planName=${name}`;
}

function getPlanWMSUrl(
  xplanBoxUrl: string,
  service: XplanBoxService,
  name: string,
): string {
  return `${xplanBoxUrl.replace(/\/+$/, '')}/xplan-wms/services/planwerkwms${getServiceSuffix(service)}/planname/${name.replace(/\//g, '')}`;
}

export async function getHits(
  xplanBoxUrl: string,
  service: XplanBoxService,
  query: PlanQuery,
): Promise<number> {
  const serverUrl = getSynwfsUrl(xplanBoxUrl, service);
  const getFeature = createGetFeaturesRequest(
    {
      ...query,
      startIndex: 0,
    },
    true,
  );
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/xml',
    },
    body: getFeature,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch plan features: ${response.statusText}`);
  }

  const planDocument = new DOMParser().parseFromString(
    await response.text(),
    'application/xml',
  );

  const numberOfFeatures =
    planDocument.documentElement.getAttribute('numberMatched');
  if (numberOfFeatures) {
    const parsed = parseInt(numberOfFeatures, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  throw new Error('Failed to parse numberOfFeatures from response');
}

export async function getPlanFeatures(
  xplanBoxUrl: string,
  service: XplanBoxService,
  query: PlanQuery,
  hooks?: {
    onUnsupportedXplanVersion?: (plan: Plan) => void;
    onErrorReadingFeatures?: () => void;
  },
): Promise<Plan[]> {
  const serverUrl = getSynwfsUrl(xplanBoxUrl, service);
  const getFeature = createGetFeaturesRequest(query);
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/xml',
    },
    body: getFeature,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch plan features: ${response.statusText}`);
  }

  const planDocument = new DOMParser().parseFromString(
    await response.text(),
    'application/xml',
  );

  let features: Feature[] = [];
  try {
    features = getSynWFSFormat().readFeatures(planDocument);
  } catch (error) {
    hooks?.onErrorReadingFeatures?.();
    getLogger(pgk.name).error('Error parsing plan document features', error);
  }

  return features
    .map((f: Feature): Plan | undefined => {
      const type = f.getGeometry()?.getType();
      if (type === 'Polygon' || type === 'MultiPolygon') {
        const plan = f as Plan;
        const xplanVersion = plan.get('xpVersion');
        if (!is(xplanVersion, ofLiteralType(SUPPORTED_XPLAN_VERSIONS))) {
          getLogger(pgk.name).warning(
            `Unsupported XPlan version: ${xplanVersion}, expected one of ${SUPPORTED_XPLAN_VERSIONS.join(
              ', ',
            )}`,
          );
          hooks?.onUnsupportedXplanVersion?.(plan);
          return undefined;
        }

        const name = plan.get('name');
        if (!is(name, String)) {
          getLogger(pgk.name).warning(
            `Plan feature ${f.getId()} has no valid name`,
          );
          return undefined;
        }

        plan[xplanFeatureTypeSymbol] = {
          type: 'BP_Plan',
          xplanVersion,
          getByIdUrl: getPlanUrl(xplanBoxUrl, service, xplanVersion, name),
          wmsUrl: getPlanWMSUrl(xplanBoxUrl, service, name),
        };
        return plan;
      }

      return undefined;
    })
    .filter((f): f is Plan => !!f);
}

function enforceEndingVertexInPolygon(polygon: Polygon): void {
  const rings = polygon.getCoordinates();
  rings.forEach((ring) => {
    enforceEndingVertex(ring);
  });
  polygon.setCoordinates(rings);
}

function getGeojsonPolyongs(
  feature: Feature<Polygon | MultiPolygon>,
): GeoJSONPolygon[] {
  const gjFormat = getGeojsonFormat();
  const geom = feature
    .getGeometry()
    ?.clone()
    ?.transform(mercatorProjection.proj, wgs84Projection.proj);

  if (geom instanceof MultiPolygon) {
    return geom.getPolygons().map((p): GeoJSONPolygon => {
      enforceEndingVertexInPolygon(p);
      return gjFormat.writeGeometryObject(p) as GeoJSONPolygon;
    });
  } else if (geom instanceof Polygon) {
    enforceEndingVertexInPolygon(geom);
    return [gjFormat.writeGeometryObject(geom) as GeoJSONPolygon];
  }

  return [];
}

function makeFeatureCollection(
  ...polygon: GeoJSONPolygon[]
): FeatureCollection<GeoJSONPolygon> {
  return {
    type: 'FeatureCollection',
    features: polygon.map((p) => ({
      type: 'Feature',
      geometry: p,
      properties: {},
    })),
  };
}

function createOlGeometry(
  polygon: GeoJSONPolygon | GeoJSONMultiPolygon,
): Polygon | MultiPolygon {
  const gjFormat = getGeojsonFormat();
  const geom = gjFormat.readGeometry(polygon, {
    dataProjection: wgs84Projection.proj,
    featureProjection: mercatorProjection.proj,
  });
  if (geom instanceof Polygon || geom instanceof MultiPolygon) {
    return geom;
  }
  throw new Error('Invalid geometry type');
}

function intersectGrundstuecke(
  baugebiets: Planinhalt<'BP_BaugebietsTeilFlaeche'>[],
  grundstuecks: Planinhalt<'BP_UeberbaubareGrundstuecksFlaeche'>[],
): GrundstueckIntersection[] {
  const assignedBaugebiets = new Set<Planinhalt<'BP_BaugebietsTeilFlaeche'>>();
  const baugebietsGeometries: {
    polygon: GeoJSONPolygon;
    baugebiet: Planinhalt<'BP_BaugebietsTeilFlaeche'>;
  }[] = baugebiets.flatMap((baugebiet) =>
    getGeojsonPolyongs(baugebiet.feature).map((polygon) => ({
      polygon,
      baugebiet,
    })),
  );

  const intersections: GrundstueckIntersection[] = [];

  grundstuecks.forEach((g) => {
    getGeojsonPolyongs(g.feature).forEach((p) => {
      let unassignedArea = getArea(p);
      const minArea = unassignedArea * 0.05;
      let currentBaugebietGeometryIndex = 0;
      while (
        unassignedArea > minArea &&
        currentBaugebietGeometryIndex < baugebietsGeometries.length
      ) {
        const bg = baugebietsGeometries[currentBaugebietGeometryIndex];
        const intersection = intersect(makeFeatureCollection(bg.polygon, p));
        if (intersection) {
          const intersectionArea = getArea(intersection);
          if (intersectionArea >= minArea) {
            intersections.push({
              baugebiet: bg.baugebiet,
              grundstueck: g,
              geometry: createOlGeometry(intersection.geometry),
            });
            assignedBaugebiets.add(bg.baugebiet);
          }
          unassignedArea -= intersectionArea;
        }
        currentBaugebietGeometryIndex += 1;
      }
      if (
        currentBaugebietGeometryIndex === baugebietsGeometries.length &&
        unassignedArea > minArea
      ) {
        getLogger(pgk.name).warning(
          `Grundstueck ${g.feature.getId()} was not fully assigned to a Baugebiet, unassigned area: ${unassignedArea} m²`,
        );
      }
    });
  });

  if (assignedBaugebiets.size !== baugebiets.length) {
    getLogger(pgk.name).warning(
      `Not all Baugebiets were assigned a Grundstueck, ${baugebiets.length} Baugebiets, ${assignedBaugebiets.size} assigned`,
    );
    baugebietsGeometries.forEach((bg) => {
      if (!assignedBaugebiets.has(bg.baugebiet)) {
        intersections.push({
          baugebiet: bg.baugebiet,
          geometry: createOlGeometry(bg.polygon),
        });
      }
    });
  }

  return intersections;
}

export async function loadCubes(
  plan: Plan,
  terrainProvider: CesiumTerrainProvider,
  dataProjection: Projection,
  options: CubeCreationOptions,
  hooks?: { onUnassignedGrundstuecke?: () => void },
): Promise<Feature<Polygon | MultiPolygon>[]> {
  const planXMLString = await (
    await fetch(plan[xplanFeatureTypeSymbol].getByIdUrl)
  ).text();
  const planXML = new DOMParser().parseFromString(
    planXMLString,
    'application/xml',
  );

  const additionalObject = planXML.getElementsByTagNameNS(
    WFS_20_NS,
    'additionalObjects',
  );

  if (additionalObject) {
    const baugebiete = getWFSFormat(
      plan[xplanFeatureTypeSymbol].xplanVersion,
      'BP_BaugebietsTeilFlaeche',
    )
      .readFeatures(additionalObject[0].children[0], {
        dataProjection: dataProjection.proj,
        featureProjection: mercatorProjection.proj,
      })
      .map((feature) => {
        const geometry = feature.getGeometry();
        const geometryType = geometry?.getType();
        if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') {
          getLogger(pgk.name).error(
            'Invalid geometry type for Baugebiet:',
            geometryType,
          );
          return undefined;
        }
        const baugebiet: Planinhalt<'BP_BaugebietsTeilFlaeche'> = {
          type: 'BP_BaugebietsTeilFlaeche',
          feature: feature as Feature<Polygon>,
        };
        return baugebiet;
      })
      .filter((f) => !!f);

    const grundstuecke = getWFSFormat(
      plan[xplanFeatureTypeSymbol].xplanVersion,
      'BP_UeberbaubareGrundstuecksFlaeche',
    )
      .readFeatures(additionalObject[0].children[0], {
        dataProjection: dataProjection.proj,
        featureProjection: mercatorProjection.proj,
      })
      .map((feature) => {
        const geometry = feature.getGeometry();
        const geometryType = geometry?.getType();
        if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') {
          return undefined;
        }
        const grundstueck: Planinhalt<'BP_UeberbaubareGrundstuecksFlaeche'> = {
          type: 'BP_UeberbaubareGrundstuecksFlaeche',
          feature: feature as Feature<Polygon>,
        };
        return grundstueck;
      })
      .filter((f) => !!f);

    const features = intersectGrundstuecke(baugebiete, grundstuecke);

    if (grundstuecke.length && !features.length) {
      hooks?.onUnassignedGrundstuecke?.();
    }
    return Promise.all(
      features.map((intersection) =>
        createCubes(intersection, terrainProvider, options),
      ),
    );
  }

  return [];
}
