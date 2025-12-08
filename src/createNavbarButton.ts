import {
  type VcsUiApp,
  type VcsAction,
  ButtonLocation,
  type WindowComponentOptions,
  WindowSlot,
} from '@vcmap/ui';
import { reactive } from 'vue';
import { name } from '../package.json';
import BPlanFilter from './BPlanFilter.vue';
import XPlan from './XPlan.vue';
import {
  bplanFilterWindowId,
  getEmptyFilter,
  xplanWindowId,
} from './defaultOptions.js';
import type { XplanPlugin } from './index.js';

const xplanIcon =
  'svgPathData:M9.56255 1.81417C6.03755 2.57008 2.88755 5.48032 1.83755 8.97638C1.3313 10.6205 1.27505 13.3984 1.72505 14.8535C3.03755 19.0866 6.4313 22.0158 10.5938 22.4693C11.3063 22.5638 12.4688 22.5638 13.1438 22.4693C21.7313 21.4299 25.3876 10.885 19.3126 4.72441C16.7063 2.07874 13.1813 1.02047 9.56255 1.81417ZM17.6438 4.51654C18.2063 4.91339 18.9938 5.68819 19.3876 6.23622L20.1376 7.2189L19.8001 7.80473C19.6313 8.14488 19.0126 9.07087 18.4501 9.86457L17.4188 11.3386H14.4188H11.4001L11.7188 10.8095C13.0126 8.8063 16.4251 3.77953 16.5188 3.77953C16.5751 3.77953 17.0813 4.11969 17.6438 4.51654ZM12.6376 6.14173C13.1251 6.72756 13.5001 7.2567 13.4626 7.35118C13.3501 7.67244 10.9688 11.1307 10.8563 11.1496C10.7063 11.1496 6.00005 5.72599 5.88755 5.38583C5.7938 5.14016 6.18755 5.10236 8.7563 5.10236H11.7376L12.6376 6.14173ZM19.0313 13.5118C19.8563 14.5134 20.5501 15.4394 20.5876 15.5906C20.7188 16.1575 18.5063 19.2756 17.9813 19.2756C17.8126 19.2756 11.4376 12 11.4376 11.811C11.4376 11.7543 12.8063 11.7165 14.4938 11.7165H17.5313L19.0313 13.5118ZM12.5626 13.8898L14.2688 15.8551L13.0876 17.5748L11.9063 19.2756H8.9438C7.27505 19.2756 6.00005 19.2 6.03755 19.1055C6.0938 18.9354 10.7626 11.9244 10.8188 11.9055C10.8376 11.9055 11.6251 12.7937 12.5626 13.8898Z';

export function getXPlanWindowComponent(app: VcsUiApp): WindowComponentOptions {
  return {
    id: xplanWindowId,
    component: XPlan,
    slot: WindowSlot.DYNAMIC_LEFT,
    state: {
      headerTitle: 'xplan.bplans.windowTitle',
      headerIcon: xplanIcon,
      infoUrlCallback: app.getHelpUrlCallback('tools/xplanTool.html'),
    },
  };
}

export function getFilterWindowComponent(
  app: VcsUiApp,
): WindowComponentOptions {
  return {
    id: bplanFilterWindowId,
    component: BPlanFilter,
    parentId: xplanWindowId,
    state: {
      headerTitle: 'xplan.filter.windowTitle',
      headerIcon: 'mdi-filter',
      infoUrlCallback: app.getHelpUrlCallback(
        'tools/xplanTool.html#id_filterDialog',
      ),
    },
  };
}

export function createNavbarButton(app: VcsUiApp): () => void {
  const { windowManager } = app;
  const plugin = app.plugins.getByKey(name) as XplanPlugin;

  const action: VcsAction = reactive({
    name: 'xplan.bplans.windowTitle',
    title: 'xplan.bplans.windowTitle',
    icon: xplanIcon,
    active: windowManager.has(xplanWindowId),
    async callback(): Promise<void> {
      if (this.active) {
        windowManager.remove(xplanWindowId);
      } else {
        const isFirstOpen = !plugin.getOverviewFilter();
        if (isFirstOpen) {
          this.icon = '$vcsProgress';
          await plugin.setOverviewFilter(getEmptyFilter(plugin.config));
          this.icon = xplanIcon;
        }
        const windowComponent = getXPlanWindowComponent(app);
        windowManager.add(windowComponent, name);
        if (isFirstOpen) {
          app.windowManager.add(getFilterWindowComponent(app), name);
        }
      }
    },
  });

  const listeners = [
    app.windowManager.removed.addEventListener(({ id }) => {
      if (id === xplanWindowId) {
        action.active = false;
      }
    }),
    app.windowManager.added.addEventListener(({ id }) => {
      if (id === xplanWindowId) {
        action.active = true;
      }
    }),
  ];

  const button = app.navbarManager.add(
    {
      action,
    },
    name,
    ButtonLocation.TOOL,
  );

  return () => {
    listeners.forEach((cb) => {
      cb();
    });
    app.navbarManager.remove(button.id);
    app.windowManager.remove(xplanWindowId);
  };
}
