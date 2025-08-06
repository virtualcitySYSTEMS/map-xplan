import { type Extent, wgs84Projection } from '@vcmap/core';
import {
  and,
  like,
  bbox,
  equalTo,
  greaterThanOrEqualTo,
  or,
} from 'ol/format/filter.js';
import type Filter from 'ol/format/filter/Filter.js';
import WFSFormat from 'ol/format/WFS.js';
import { type Feature } from 'ol';
import { type MultiPolygon, type Polygon } from 'ol/geom';
import { is } from '@vcsuite/check';
import { getLogger } from '@vcsuite/logger';
import pgk from '../package.json';

export const xplanFeatureTypeSymbol: unique symbol = Symbol('XplanFeatureType');
const PLANINHALT_FEATURE_TYPE = [
  'BP_BaugebietsTeilFlaeche',
  'BP_UeberbaubareGrundstuecksFlaeche',
] as const;

const FEATURE_TYPE = [
  ...PLANINHALT_FEATURE_TYPE,
  'BP_Plan',
  'BP_Bereich',
] as const;

export type PlanAPI = {
  type: (typeof FEATURE_TYPE)[2];
};

export type Plan = Feature<Polygon | MultiPolygon> & {
  [xplanFeatureTypeSymbol]: PlanAPI;
};

export type PlanQuery = {
  bbox?: Extent;
  gemeinde?: string;
  // fuzzy
  name?: string;
  // prefix
  number?: string;
  // exact
  rechtsstand?: string[];
  // gte
  inkrafttretensDatum?: Date;
  // exact
  withContent?: boolean;
  count?: number;
  startIndex?: number;
};

type Source = string | Element | Document;

const XPLAN_54_NS = 'http://www.xplanung.de/xplangml/5/4';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const WFS_20_NS = 'http://www.opengis.net/wfs/2.0';

let wfsFormate: WFSFormat | undefined;
function getWFSFormat(): WFSFormat {
  if (!wfsFormate) {
    wfsFormate = new WFSFormat({
      featureNS: { xplan: XPLAN_54_NS },
      featureType: [...FEATURE_TYPE.map((t) => `xplan:${t}`)],
      version: '2.0.0',
    });
  }
  return wfsFormate;
}

export async function getDocumentString(uri: Source): Promise<Document> {
  if (typeof uri === 'string') {
    let documentString = uri.trim();
    if (!documentString.startsWith('<')) {
      documentString = await fetch(documentString.split('#')[0]).then(
        (response) => response.text(),
      );
    }
    const parser = new DOMParser();
    return parser.parseFromString(documentString, 'application/xml');
  }

  if (uri instanceof Element) {
    const href = uri.getAttributeNS(XLINK_NS, 'href');
    if (href) {
      return getDocumentString(href);
    }
    const doc = document.implementation.createDocument('', '', null);
    doc.appendChild(doc.importNode(uri, true));
    return doc;
  }

  return uri;
}

function getSourceFromProperty(
  feature: Feature,
  property: string,
): string[] | undefined {
  const value = feature.get(property);
  if (value == null) {
    return undefined;
  }
  const valuesArray = Array.isArray(value) ? value : [value];
  const values = valuesArray
    .map((v) => {
      if (typeof v === 'string') {
        return v;
      }

      // eslint-disable-next-line @typescript-eslint/naming-convention
      if (is(v, { 'xlink:href': String })) {
        return v['xlink:href'];
      }

      return undefined;
    })
    .filter((v): v is string => !!v);

  return values.length > 0 ? values : undefined;
}

function createFilter(query: PlanQuery): Filter | undefined {
  const filters: Filter[] = [];
  if (query.gemeinde) {
    filters.push(equalTo('xplan:gemeinde', query.gemeinde));
  }
  if (query.name) {
    filters.push(like('xplan:name', `*${query.name}*`));
  }
  if (query.bbox) {
    filters.push(
      bbox(
        'xplan:position',
        query.bbox.getCoordinatesInProjection(wgs84Projection),
        'EPSG:4326',
      ),
    );
  }
  if (query.number) {
    filters.push(equalTo('xplan:nummer', `${query.number}*`));
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
        query.inkrafttretensDatum.toISOString() as unknown as number, // ol expects a number
      ),
    );
  }

  if (query.withContent) {
    // no idey yet, probably a isNull check
  }

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return and(...filters);
}

function createGetFeaturesRequest(query: PlanQuery): string {
  const wfsFormat = getWFSFormat();
  // const filter = wfsFormat.getCreate(query);
  // const bbox = query.bbox ? wfsFormat.getBBOXFilter(query.bbox) : undefined;

  const getFeautres = wfsFormat.writeGetFeature({
    featureNS: XPLAN_54_NS,
    featurePrefix: 'xplan',
    featureTypes: ['BP_Plan'],
    outputFormat: 'application/gml+xml; version=3.2',
    // srsName: 'EPSG:25832',
    count: query.count,
    startIndex: query.startIndex,
    filter: createFilter(query),
    // bbox,
  });
  (getFeautres as Element).setAttribute('resolveDepth', '1');
  (getFeautres as Element).setAttribute('resolve', 'internal');

  return new XMLSerializer().serializeToString(getFeautres);
}

export async function getPlanFeatures(
  serverUrl: string,
  query: PlanQuery,
): Promise<Plan[]> {
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

  const features = getWFSFormat().readFeatures(planDocument);

  const additionalObject = planDocument.getElementsByTagNameNS(
    WFS_20_NS,
    'additionalObjects',
  );

  let bereichs: Feature[] = [];
  if (additionalObject.length > 0) {
    bereichs = getWFSFormat()
      .readFeatures(additionalObject[0].children[0])
      .filter((b) => !!b.get('planinhalt'));
  }

  return features
    .map((f: Feature): Plan | undefined => {
      const type = f.getGeometry()?.getType();
      const bereichSources = getSourceFromProperty(f, 'bereich');
      if ((type === 'Polygon' || type === 'MultiPolygon') && bereichSources) {
        const plan = f as Plan;
        const bereichFeatures = bereichSources
          .map((b) => {
            if (b.startsWith('#')) {
              const id = b.substring(1);
              return bereichs.find((bf) => bf.getId() === id);
            } else {
              return b;
            }
          })
          .filter((b): b is Feature | string => !!b);

        if (bereichFeatures.length === 0) {
          getLogger(pgk.name).warning(
            `Plan ${f.getId()} has no bereich features`,
          );
          return undefined;
        }
        plan[xplanFeatureTypeSymbol] = { type: 'BP_Plan' };
        plan.set('bereich', bereichFeatures);
        return plan;
      }

      return undefined;
    })
    .filter((f): f is Plan => !!f);
}
