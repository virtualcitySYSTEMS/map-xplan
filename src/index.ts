import type { VcsPlugin } from '@vcmap/ui';
import { name, version, mapVersion } from '../package.json';

type PluginConfig = {
  url: string;
};

type PluginState = Record<never, never>;

export type XplanPlugin = VcsPlugin<PluginConfig, PluginState>;

export default function plugin(): XplanPlugin {
  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    async initialize(): Promise<void> {
      return Promise.resolve();
    },
    destroy(): void {},
  };
}
