import { describe, it, expect } from 'vitest';
import {
  DEFAULT_XPLAN_BOX_SERVICE_PATHS,
  getMergedConfig,
  type XplanConfig,
} from '../src/defaultOptions.js';
import {
  buildUrl,
  getPlanUrl,
  getPlanWMSUrl,
  getSynwfsUrl,
} from '../src/xplanAPI.js';
import plugin from '../src/index.js';

/**
 * Partial configs are valid plugin input, missing keys are filled with defaults.
 */
function partialConfig(config: object): XplanConfig {
  return config as XplanConfig;
}

describe('xplanBoxServicePaths', () => {
  describe('getMergedConfig', () => {
    it('should use the default paths, if none are configured', () => {
      const config = getMergedConfig(partialConfig({}));
      expect(config.xplanBoxServicePaths).to.deep.equal(
        DEFAULT_XPLAN_BOX_SERVICE_PATHS,
      );
    });

    it('should fill missing paths with the defaults', () => {
      const config = getMergedConfig(
        partialConfig({
          xplanBoxServicePaths: { synWfs: 'xplan-services-wfs-syn' },
        }),
      );
      expect(config.xplanBoxServicePaths).to.deep.equal({
        ...DEFAULT_XPLAN_BOX_SERVICE_PATHS,
        synWfs: 'xplan-services-wfs-syn',
      });
    });

    it('should fall back to the defaults for null, empty or non-string paths', () => {
      const config = getMergedConfig(
        partialConfig({
          xplanBoxServicePaths: { synWfs: null, wfs: '   ', wms: 42 },
        }),
      );
      expect(config.xplanBoxServicePaths).to.deep.equal(
        DEFAULT_XPLAN_BOX_SERVICE_PATHS,
      );
    });

    it('should trim paths', () => {
      const config = getMergedConfig(
        partialConfig({
          xplanBoxServicePaths: { wfs: ' xplan-services-wfs ' },
        }),
      );
      expect(config.xplanBoxServicePaths.wfs).to.equal('xplan-services-wfs');
    });
  });

  describe('toJSON', () => {
    it('should not serialize default paths', () => {
      const instance = plugin(partialConfig({}));
      expect(instance.toJSON!()).not.to.have.property('xplanBoxServicePaths');
      instance.destroy?.();
    });

    it('should only serialize paths differing from the defaults', () => {
      const instance = plugin(
        partialConfig({
          xplanBoxServicePaths: {
            ...DEFAULT_XPLAN_BOX_SERVICE_PATHS,
            wms: 'xplan-services-wms',
          },
        }),
      );
      expect(instance.toJSON!().xplanBoxServicePaths).to.deep.equal({
        wms: 'xplan-services-wms',
      });
      instance.destroy?.();
    });

    it('should not serialize cleared paths', () => {
      const instance = plugin(
        partialConfig({ xplanBoxServicePaths: { wfs: null, wms: '' } }),
      );
      expect(instance.toJSON!()).not.to.have.property('xplanBoxServicePaths');
      instance.destroy?.();
    });
  });

  describe('service urls', () => {
    const paths = {
      synWfs: 'custom-syn',
      wfs: 'custom-wfs',
      wms: 'custom-wms',
    };

    it('should use the synWfs path for the SynWFS url', () => {
      expect(getSynwfsUrl('https://example.com/', paths, 'pre')).to.equal(
        'https://example.com/custom-syn/services/xplansynwfspre',
      );
    });

    it('should use the wfs path for the plan url', () => {
      expect(
        getPlanUrl('https://example.com', paths, 'current', '6.0', 'plan'),
      ).to.match(/^https:\/\/example\.com\/custom-wfs\/services\/wfs60\?/);
    });

    it('should use the wms path for the WMS url', () => {
      expect(
        getPlanWMSUrl('https://example.com', paths, 'current', 'a/b'),
      ).to.equal(
        'https://example.com/custom-wms/services/planwerkwms/planname/ab',
      );
    });

    it('should keep a query string of the base url', () => {
      expect(
        getSynwfsUrl('https://proxy.example/xplanbox?key=abc', paths, 'pre'),
      ).to.equal(
        'https://proxy.example/xplanbox/custom-syn/services/xplansynwfspre?key=abc',
      );
      expect(
        getPlanWMSUrl(
          'https://proxy.example/xplanbox/?key=abc',
          paths,
          'current',
          'plan',
        ),
      ).to.equal(
        'https://proxy.example/xplanbox/custom-wms/services/planwerkwms/planname/plan?key=abc',
      );
    });

    it('should append the plan url params to a query string of the base url', () => {
      const url = new URL(
        getPlanUrl(
          'https://proxy.example/xplanbox/?key=abc',
          paths,
          'current',
          '6.0',
          'plan',
        ),
      );
      expect(url.pathname).to.equal('/xplanbox/custom-wfs/services/wfs60');
      expect(url.searchParams.get('key')).to.equal('abc');
      expect(url.searchParams.get('request')).to.equal('GetFeature');
      expect(url.searchParams.get('StoredQuery_ID')).to.equal(
        'urn:ogc:def:query:OGC-WFS::PlanName',
      );
      expect(url.searchParams.get('planName')).to.equal('plan');
    });

    it('should encode special characters in the plan name of the plan url', () => {
      const url = new URL(
        getPlanUrl(
          'https://example.com',
          paths,
          'current',
          '6.0',
          'Plan A&B#1',
        ),
      );
      expect(url.hash).to.equal('');
      expect(url.searchParams.get('planName')).to.equal('Plan A&B#1');
    });

    it('should encode special characters in the plan name of the WMS url', () => {
      expect(
        getPlanWMSUrl('https://example.com', paths, 'current', 'Plan A/B?#1'),
      ).to.equal(
        'https://example.com/custom-wms/services/planwerkwms/planname/Plan%20AB%3F%231',
      );
    });
  });

  describe('buildUrl', () => {
    it('should join base url and segments with a single slash', () => {
      expect(buildUrl('https://example.com/', ['/xplansyn-wfs/'])).to.equal(
        'https://example.com/xplansyn-wfs',
      );
      expect(buildUrl('https://example.com', ['a/b', 'c'])).to.equal(
        'https://example.com/a/b/c',
      );
    });

    it('should encode characters which are not valid in a path', () => {
      expect(
        buildUrl('https://box.example', [
          'xplan wfs?x#y',
          'services',
          'xplansynwfspre',
        ]),
      ).to.equal(
        'https://box.example/xplan%20wfs%3Fx%23y/services/xplansynwfspre',
      );
    });

    it('should resolve a relative base url against the current location', () => {
      expect(buildUrl('/xplanbox', ['a'])).to.equal(
        new URL('/xplanbox/a', window.location.href).toString(),
      );
    });
  });
});
