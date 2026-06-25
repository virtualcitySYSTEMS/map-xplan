import {
  describe,
  beforeAll,
  afterAll,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';
import { readFile } from 'node:fs/promises';
import { Feature } from 'ol';
import { Projection } from '@vcmap/core';
import nock from 'nock';
import {
  Cartographic,
  type CesiumTerrainProvider,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import { getTerrainProvider } from '@vcmap/core/dist/tests/unit/helpers/terrain/terrainData.js';
import {
  type Bezugspunkt,
  getDefaultCubeCreationOptions,
  type Hoehenbezug,
} from '../src/defaultOptions.js';
import {
  load3dFeatures,
  type Plan,
  XPLAN_NS,
  xplanFeatureTypeSymbol,
} from '../src/xplanAPI.js';

let baseXMLString: string;
async function loadBaseXML(): Promise<string> {
  if (!baseXMLString) {
    baseXMLString = await readFile('./tests/data/xplan.xml', 'utf-8');
  }
  return baseXMLString;
}

async function getDocument(): Promise<XMLDocument> {
  const parser = new DOMParser();
  const xmlString = await loadBaseXML();
  return parser.parseFromString(xmlString, 'application/xml');
}

function parseSnippet(targetDoc: Document, fragmentXml: string): Element {
  const nsAttr = `xmlns:xplan="${XPLAN_NS['5.4']}" xmlns:gml="http://www.opengis.net/gml/3.2"`;
  const wrapper = `<wrapper ${nsAttr}>${fragmentXml}</wrapper>`;
  const parsed = new DOMParser().parseFromString(wrapper, 'application/xml');
  const parsererror = parsed.getElementsByTagName('parsererror')[0];
  if (parsererror) {
    throw new Error(`XML parse error: ${parsererror.textContent || 'unknown'}`);
  }

  const wrapperEl = parsed.documentElement;
  return targetDoc.importNode(wrapperEl.firstChild!, true) as Element;
}

function setHoehenangabe(
  doc: XMLDocument,
  values: string[],
  target: 'BTF' | 'UGF' | 'both',
): void {
  const nodes = values.map((v) => {
    const hoehenangabe = `<xplan:hoehenangabe>${v}</xplan:hoehenangabe>`;
    return parseSnippet(doc, hoehenangabe);
  });

  if (target === 'BTF' || target === 'both') {
    const btfList = doc.getElementsByTagNameNS(
      XPLAN_NS['5.4'],
      'BP_BaugebietsTeilFlaeche',
    );

    for (let i = 0; i < btfList.length; i++) {
      const btf = btfList[i];
      nodes.forEach((node) => {
        btf.appendChild(node.cloneNode(true));
      });
    }
  }

  if (target === 'UGF' || target === 'both') {
    const ugfList = doc.getElementsByTagNameNS(
      XPLAN_NS['5.4'],
      'BP_UeberbaubareGrundstuecksFlaeche',
    );

    for (let i = 0; i < ugfList.length; i++) {
      const ugf = ugfList[i];
      nodes.forEach((node) => {
        ugf.appendChild(node.cloneNode(true));
      });
    }
  }
}

function setZStaffel(doc: XMLDocument): void {
  const zStaffel = `<xplan:Z_Staffel>2</xplan:Z_Staffel>`;
  const zStaffelNode = parseSnippet(doc, zStaffel);
  const btfList = doc.getElementsByTagNameNS(
    XPLAN_NS['5.4'],
    'BP_BaugebietsTeilFlaeche',
  );
  for (let i = 0; i < btfList.length; i++) {
    const btf = btfList[i];
    btf.appendChild(zStaffelNode.cloneNode(true));
  }
}

function createHHoehenangabe(
  bezugspunkt: Bezugspunkt,
  hoehenbezug: Hoehenbezug,
  h: number,
): string {
  return `<xplan:XP_Hoehenangabe>
    <xplan:hoehenbezug>${hoehenbezug}</xplan:hoehenbezug>
    <xplan:bezugspunkt>${bezugspunkt}</xplan:bezugspunkt>
    <xplan:h uom="m">${h}</xplan:h>
  </xplan:XP_Hoehenangabe>`;
}

function createHminHmaxHoehenangabe(
  bezugspunkt: Bezugspunkt,
  hoehenbezug: Hoehenbezug,
  hMin: number,
  hMax: number,
): string {
  return `<xplan:XP_Hoehenangabe>
    <xplan:hoehenbezug>${hoehenbezug}</xplan:hoehenbezug>
    <xplan:bezugspunkt>${bezugspunkt}</xplan:bezugspunkt>
    <xplan:hMin uom="m">${hMin}</xplan:hMin>
    <xplan:hMax uom="m">${hMax}</xplan:hMax>
  </xplan:XP_Hoehenangabe>`;
}

function createWithoutDef(h: number): string {
  return `<xplan:XP_Hoehenangabe>
    <xplan:h uom="m">${h}</xplan:h>
  </xplan:XP_Hoehenangabe>`;
}

describe('creating cubes', () => {
  let projection: Projection;
  let plan: Plan;

  beforeEach(() => {
    let count = -1;
    Object.defineProperty(Cartographic.prototype, 'height', {
      get() {
        if (!this._h) {
          count += 1;
          if (count % 2 === 0) {
            this._h = 2;
          } else {
            this._h = 4;
          }
        }
        return this._h;
      },
      set() {},
      configurable: true,
    });
  });

  beforeAll(() => {
    projection = new Projection({
      epsg: 'EPSG:25832',
      proj4: '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',
    });
    plan = new Feature({}) as Plan;
    plan[xplanFeatureTypeSymbol] = {
      type: 'BP_Plan',
      wmsUrl: '',
      xplanVersion: '5.4',
      getByIdUrl: 'http://localhost/xplan.xml',
    };
  });

  afterEach(() => {
    delete (Cartographic.prototype as { height?: number }).height;
  });

  describe('splitting of UGFs', () => {
    let terrainProvider: CesiumTerrainProvider;

    beforeAll(async () => {
      const xml = await readFile('./tests/data/to_split.xml', 'utf-8');
      terrainProvider = await getTerrainProvider(nock('http://localhost'));
      nock('http://localhost').get('/xplan.xml').reply(200, xml).persist(true);
    });

    afterAll(() => {
      nock.cleanAll();
    });

    it('should correctly split up into differing UGF, even if they intersect BTF', async () => {
      const { cubes: features } = await load3dFeatures(
        plan,
        terrainProvider,
        projection,
        getDefaultCubeCreationOptions(),
      );
      expect(features).to.have.lengthOf(14);
      for (const feature of features) {
        expect(feature.get('grundstueck')).to.have.property(
          'type',
          'BP_UeberbaubareGrundstuecksFlaeche',
        );
      }
    });
  });

  describe('creating cubes with hoehenangaben', () => {
    describe('with a height attribute', () => {
      describe('which is absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('6500', '1000', 50.5)],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should determine ground level from terrain and create a relative height', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 47.7);
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
          expect(properties).to.have.property(
            'heightsResolvedFrom',
            'BP_BaugebietsTeilFlaeche',
          );
          expect(properties).to.have.property('olcs_storeysAboveGround', 1);
          expect(properties).to.not.have.property(
            'olcs_storeyHeightsAboveGround',
          );
        });
      });

      describe('which is relative', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('6500', '2000', 15)],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correctly determine ground level from terrain and use the height as is', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 15);
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        });
      });

      describe('where multiples are given', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('6500', '2000', 15),
              createHHoehenangabe('1000', '2000', 2),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correctly assume the one with the higher priorety', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 15);
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        });
      });

      describe('where its attached to the UGF', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('6500', '2000', 15)],
            'UGF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));

          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should work as BTF', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 15);
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
          expect(properties).to.have.property(
            'heightsResolvedFrom',
            'BP_UeberbaubareGrundstuecksFlaeche',
          );
        });
      });

      describe('with a hmin and hmax attribute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHminHmaxHoehenangabe('6500', '2000', 12, 15)],
            'UGF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correctly use hmax', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 15);
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        });
      });

      describe('without a bezugspunkt or hoehenbezug', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(xml, [createWithoutDef(15)], 'UGF');
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should assume its a relative height', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 15);
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        });
      });
    });

    describe('with groundFloor attribute', () => {
      describe('which is absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('4500', '1000', 50.5)],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should directly use as ground level', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 50.5);
          expect(properties).to.have.property('olcs_skirt', 48.5);
          expect(properties).to.have.property(
            'heightsResolvedFrom',
            'BP_BaugebietsTeilFlaeche',
          );
        });
      });

      describe('which is relative', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('4500', '2000', 15)],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correctly elevate the ground level', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 17.8);
          expect(properties).to.have.property('olcs_skirt', 15.8);
        });
      });

      describe('where multiples are given', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4000', '2000', 2),
              createHHoehenangabe('4500', '2000', 15),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should use the correct one based on priority', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 17.8);
          expect(properties).to.have.property('olcs_skirt', 15.8);
        });
      });

      describe('where its attached to the UGF', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('4500', '2000', 15)],
            'UGF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));

          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should work as with BTF', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 17.8);
          expect(properties).to.have.property('olcs_skirt', 15.8);
          expect(properties).to.have.property(
            'heightsResolvedFrom',
            'BP_UeberbaubareGrundstuecksFlaeche',
          );
        });
      });

      describe('with a hmin and hmax attribute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHminHmaxHoehenangabe('4500', '2000', 12, 15)],
            'UGF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should use hmax as expected', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 17.8);
          expect(properties).to.have.property('olcs_skirt', 15.8);
        });
      });
    });

    describe('with terrain attribute', () => {
      describe('which is absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('6600', '1000', 50.5)],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should directly assume as ground level if no other level is given and correctly create a skirt', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 50.5);
          expect(properties).to.have.property('olcs_skirt', 48.5);
          expect(properties).to.have.property(
            'heightsResolvedFrom',
            'BP_BaugebietsTeilFlaeche',
          );
        });
      });

      describe('which is relative', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [createHHoehenangabe('6600', '2000', 15)],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should ignoring relative terrain height', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.not.have.property('olcs_extrudedHeight');
          expect(properties).to.have.property('olcs_groundLevel', 2.8);
          expect(properties)
            .to.have.property('olcs_skirt')
            .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        });
      });
    });

    describe('with ground & height attribute', () => {
      describe('which are absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '1000', 25),
              createHHoehenangabe('6500', '1000', 50.5),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should assume ground level, correctly deduct from height to create a relative height and skirt', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties)
            .to.have.property('olcs_extrudedHeight')
            .and.to.be.closeTo(25.5, CesiumMath.EPSILON8);
          expect(properties).to.have.property('olcs_groundLevel', 25);
          expect(properties).to.have.property('olcs_skirt', 23);
        });
      });

      describe('which are relative', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '2000', 2),
              createHHoehenangabe('6500', '2000', 15),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correclty reduce the given height, add to the terrain level and create a skirt', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 13);
          expect(properties).to.have.property('olcs_groundLevel', 4.8);
          expect(properties).to.have.property('olcs_skirt', 2.8);
        });
      });

      describe('where height is relative and ground is absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '1000', 6),
              createHHoehenangabe('6500', '2000', 15),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correctly remove the difference from terrain to ground level', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 11.8);
          expect(properties).to.have.property('olcs_groundLevel', 6);
          expect(properties).to.have.property('olcs_skirt', 4);
        });
      });

      describe('where the ground is below terrain', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '1000', 1),
              createHHoehenangabe('6500', '2000', 15),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should assume ground level, correctly add to the height to create a relative height. there should not be a skirt', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 16.8);
          expect(properties).to.have.property('olcs_groundLevel', 1);
          expect(properties).to.not.have.property('olcs_skirt');
        });
      });

      describe('where height is absolute and ground is relative', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '2000', 2),
              createHHoehenangabe('6500', '1000', 20),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should add the ground level to the terrain level and remove from the height to create a relative height', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 15.2);
          expect(properties).to.have.property('olcs_groundLevel', 4.8);
          expect(properties).to.have.property('olcs_skirt', 2.8);
        });
      });

      describe('where height is relative to the first floor and the first floor is given as absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '1000', 6),
              createHHoehenangabe('6500', '4000', 12),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should assume ground level directly from value & height too', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 12);
          expect(properties).to.have.property('olcs_groundLevel', 6);
          expect(properties).to.have.property('olcs_skirt', 4);
        });
      });

      describe('where height is relative to the first floor and the first floor is given relative', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '2000', 2),
              createHHoehenangabe('6500', '4000', 12),
            ],
            'BTF',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should correctly add the terrain level to the ground and use height as is', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties).to.have.property('olcs_extrudedHeight', 12);
          expect(properties).to.have.property('olcs_groundLevel', 4.8);
          expect(properties).to.have.property('olcs_skirt', 2.8);
        });
      });
    });

    describe('with hoehenangabe defined on both areas', () => {
      describe('which are absolute', () => {
        let terrainProvider: CesiumTerrainProvider;

        beforeAll(async () => {
          const xml = await getDocument();
          setHoehenangabe(
            xml,
            [
              createHHoehenangabe('4500', '1000', 25),
              createHHoehenangabe('6500', '1000', 50.5),
            ],
            'both',
          );
          terrainProvider = await getTerrainProvider(nock('http://localhost'));
          nock('http://localhost')
            .get('/xplan.xml')
            .reply(200, new XMLSerializer().serializeToString(xml))
            .persist(true);
        });

        afterAll(() => {
          nock.cleanAll();
        });

        it('should always prefer UGF and add the height in both attribute', async () => {
          const { cubes: features } = await load3dFeatures(
            plan,
            terrainProvider,
            projection,
            getDefaultCubeCreationOptions(),
          );

          expect(features).to.have.lengthOf(4);
          const properties = features[0].getProperties();
          expect(properties)
            .to.have.property('olcs_extrudedHeight')
            .and.to.be.closeTo(25.5, CesiumMath.EPSILON8);
          expect(properties).to.have.property('olcs_groundLevel', 25);
          expect(properties).to.have.property('olcs_skirt', 23);
          expect(properties).to.have.property(
            'heightsResolvedFrom',
            'BP_UeberbaubareGrundstuecksFlaeche',
          );
          expect(properties).to.have.property('heightInBoth', true);
        });
      });
    });
  });

  describe('creating cubes without hoehenangaben', () => {
    describe('with storey attributes', () => {
      let terrainProvider: CesiumTerrainProvider;

      beforeAll(async () => {
        const xml = await loadBaseXML();
        terrainProvider = await getTerrainProvider(nock('http://localhost'));
        nock('http://localhost')
          .get('/xplan.xml')
          .reply(200, xml)
          .persist(true);
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it('should correctly parse the storeys', async () => {
        const { cubes: features } = await load3dFeatures(
          plan,
          terrainProvider,
          projection,
          getDefaultCubeCreationOptions(),
        );

        expect(features).to.have.lengthOf(4);
        const properties = features[0].getProperties();
        expect(properties).to.not.have.property('olcs_extrudedHeight');
        expect(properties).to.have.property('olcs_storeysAboveGround', 1);
        expect(properties)
          .to.have.property('olcs_storeyHeightsAboveGround')
          .and.to.have.members([3]);
        expect(properties).to.have.property('olcs_groundLevel', 2.8);
        expect(properties)
          .to.have.property('olcs_skirt')
          .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        expect(properties).to.have.property(
          'storeyResolvedFrom',
          'BP_BaugebietsTeilFlaeche',
        );
      });
    });

    describe('with storey and Z_Staffel attribute', () => {
      let terrainProvider: CesiumTerrainProvider;

      beforeAll(async () => {
        const xml = await getDocument();
        setZStaffel(xml);
        terrainProvider = await getTerrainProvider(nock('http://localhost'));
        nock('http://localhost')
          .get('/xplan.xml')
          .reply(200, new XMLSerializer().serializeToString(xml))
          .persist(true);
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it('should correctly parse the storeys', async () => {
        const { cubes: features } = await load3dFeatures(
          plan,
          terrainProvider,
          projection,
          getDefaultCubeCreationOptions(),
        );

        expect(features).to.have.lengthOf(4);
        const properties = features[0].getProperties();
        expect(properties).to.not.have.property('olcs_extrudedHeight');
        expect(properties).to.have.property('olcs_storeysAboveGround', 3);
        expect(properties)
          .to.have.property('olcs_storeyHeightsAboveGround')
          .and.to.have.members([3, 3, 3]);
        expect(properties).to.have.property('olcs_groundLevel', 2.8);
        expect(properties)
          .to.have.property('olcs_skirt')
          .and.to.be.closeTo(0.8, CesiumMath.EPSILON8);
        expect(properties).to.have.property(
          'storeyResolvedFrom',
          'BP_BaugebietsTeilFlaeche',
        );
        expect(properties).to.have.property(
          'staffelResolvedFrom',
          'BP_BaugebietsTeilFlaeche',
        );
      });
    });
  });
});
