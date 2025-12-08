import { get as getOlProj } from 'ol/proj.js';
import {
  AbstractFeatureInfoView,
  getBalloonPositionFromFeature,
  IframeComponent,
  type FeatureInfoEvent,
  type FeatureInfoViewOptions,
  type IframeFeatureInfoViewProps,
  type VcsUiApp,
  type WindowComponentOptions,
} from '@vcmap/ui';
import { WMSFeatureProvider, type Layer } from '@vcmap/core';
import type Feature from 'ol/Feature.js';
import { xplanFeatureTypeSymbol, type Plan } from './xplanAPI.js';

export type PlanIframeWmsFeatureInfoViewOptions = FeatureInfoViewOptions & {
  parameters?: Record<string, string>;
};

/**
 * @class
 * @description A IframeWmsFeatureInfoView with some changes for xplan usecases.
 * @extends {AbstractFeatureInfoView}
 */
class PlanIframeWmsFeatureInfoView extends AbstractFeatureInfoView {
  static get className(): string {
    return 'PlanIframeWmsFeatureInfoView';
  }

  private _parameters: Record<string, string>;

  constructor(options: PlanIframeWmsFeatureInfoViewOptions) {
    super(options, IframeComponent);

    this._parameters = options.parameters || {};
  }

  private _getFeatureInfoUrl(
    featureInfo: FeatureInfoEvent,
    layer: Layer,
    app?: VcsUiApp,
  ): string | undefined {
    const position = getBalloonPositionFromFeature(
      featureInfo.feature as Feature,
      layer,
      featureInfo.position,
    );
    if (position.position) {
      let wmsFeatureProvider: WMSFeatureProvider | undefined;
      if (xplanFeatureTypeSymbol in featureInfo.feature) {
        wmsFeatureProvider = new WMSFeatureProvider(layer.name, {
          url: (featureInfo.feature as Plan)[xplanFeatureTypeSymbol].wmsUrl,
          responseType: 'text/html',
          featureInfoFormat: 'WMSGetFeatureInfo',
          parameters: {},
        });
      } else {
        wmsFeatureProvider = layer.featureProvider as WMSFeatureProvider;
      }
      let resolution = 1;
      if (app?.maps.activeMap)
        resolution = app.maps.activeMap?.getCurrentResolution(
          position.position,
        );
      return wmsFeatureProvider.wmsSource.getFeatureInfoUrl(
        position.position,
        resolution,
        getOlProj('EPSG:3857')!,
        { INFO_FORMAT: 'text/html', ...this._parameters },
      );
    }
    return undefined;
  }

  getWindowComponentOptions(
    app: VcsUiApp,
    featureInfo: FeatureInfoEvent,
    layer: Layer,
  ): WindowComponentOptions {
    const componentOptions = super.getWindowComponentOptions(
      app,
      featureInfo,
      layer,
    );
    const src = this._getFeatureInfoUrl(featureInfo, layer, app);
    componentOptions.props.src = src;
    const action = {
      name: 'legend.openInNew',
      title: 'legend.openInNew',
      icon: '$vcsExternalLink',
      callback(): void {
        if (src) {
          window.open(src, '_blank');
        }
      },
    };
    if (componentOptions.state) {
      componentOptions.state.headerActions = [action];
    } else {
      componentOptions.state = {
        headerActions: [action],
        headerActionsOverflow: 3,
      };
    }
    return componentOptions;
  }

  /**
   * Gets feature info from WMS GetFeatureInfo in html/text format
   */
  getProperties(
    featureInfo: FeatureInfoEvent,
    layer: Layer,
  ): IframeFeatureInfoViewProps {
    const properties = super.getProperties(featureInfo, layer);
    return {
      ...properties,
      src: this._getFeatureInfoUrl(featureInfo, layer) || '',
      title: (featureInfo.feature as Plan).get('name'),
      sandbox: 'allow-scripts allow-popups',
    };
  }
}

export default PlanIframeWmsFeatureInfoView;
