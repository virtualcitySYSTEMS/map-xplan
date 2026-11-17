# 2.2.0

- add `xplanBoxServicePaths` config option to configure the web context paths of XPlanSynWFS, XPlanWFS and XPlanWMS (they depend on the deployment, e.g. `xplan-services-wfs-syn` instead of `xplansyn-wfs`)
- fix service URLs: keep a query string on `xplanBoxUrl` (e.g. proxy parameters) and encode service paths and plan names, so plans with special characters like `&`, `?` or `#` in their name can be loaded

# v2.1.0

- add vegetationCreationOptions to define _BP_AnpflanzungBindungErhaltung_ `Gegenstand` values which should be displayed with default or custom tree model together with 3d cubes
- add `xplanBoxVersion` config option to support XPlanBox versions 7-9; query `bp_objekte` instead of `BP_Planvektor` for backend versions >= 8
- fix serialization of `minZIndex` in toJSON

# v2.0.0

- update @vcmap/ui and @vcmap/core to v6.3

# v1.0.3

- add hint regarding limitations of clipping polygons (Bestandsgebäude ausblenden) to README
- remove batch clipping button (Hide all existing buildings)

# v1.0.2

- fix bug where not always the configured bpPlanListAttribute was displayed

# v1.0.1

- fix bug where zmin was listed twice in feature info
- change the drawing order of 2D B-Plans to match the `xplanBoxServices` order in the config
- change config editor to sort `xplanBoxServices` to match the order of `['pre', 'current', 'archive']`
- add `xplan:planArt` filter with default values and no UI
- add `minZIndex` to which allows to offset the zIndexes of the service layers
- fix overview service title to be updated when locale changes
- fix bug which lead to error when plan was added in 2d and tied to create 3d layer
