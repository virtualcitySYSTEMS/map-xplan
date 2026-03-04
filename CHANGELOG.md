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
