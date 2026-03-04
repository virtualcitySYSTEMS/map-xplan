# @vcmap/xplan

> Part of the [VC Map Project](https://github.com/virtualcitySYSTEMS/map-ui)

## Überblick

Das `xplan` Plugin ermöglicht eine einfache Visualisierung von XPlanung B-Plänen.
Hierfür kann ein XPlanung-Backend eingebunden werden.
Unterstützte XPlanung-Backends:

- xPlanBox

Unterstützte XPlanung-Versionen:

- 5.2
- 5.3
- 5.4
- 6.0

### Wichtigste Funktionen

- **Filteroptionen**: Über die Benutzeroberfläche können verschiedene Filter gesetzt werden um die aufgelisteten B-Pläne einzugrenzen.
- **Übersichtliche Benutzeroberfläche**: Über die Registerkarte "Überblick" können die gefilterten Pläne durchsucht und einzelne Pläne der Karte hinzuzufügt werden.
  Die Registerkarte "Hinzugefügte Pläne" ermöglicht das Arbeiten mit den ausgewählten Plänen.
- **2D-Visualisierung**: Zu jedem Plan kann über den dazugehörigen WMS die Rasterrepräsentation abgerufen werden.
- **3D-Visualisierung**: Pläne mit Vektorrepräsentation können auch dreidimensional dargestellt werden.
  Die 3D-Darstellung beschränkt sich auf die Baufenster.
- **Ausblenden von Bestandsgebäuden**: In der 3D-Karte können Bestandsgebäude für einzelne Pläne ausgeblendet werden.

> **Hinweis**: Das gleichzeitige Ausblenden von Bestandsgebäuden für viele Pläne (ca. 10–15+) kann die Grafikkarte überlasten und zum Abstürzen der 3D-Karte führen. Diese Funktion daher sparsam einsetzen und nicht für zu viele Pläne gleichzeitig aktivieren.

## Konfiguration

| Option              | Typ                                      | Default                             | Beschreibung                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| projection          | `ProjectionOptions`                      | [siehe unten](#projectionoptions)   | Koordinatenreferenzsystem des Backends                                                                                                                                                                                            |
| bpPlanListAttribute | `'name' \| 'nummer'`                     | `'name'`                            | Attribut, nach dem die B-Pläne in der Übersicht sortiert und angezeigt werden                                                                                                                                                     |
| xplanBoxUrl         | `string`                                 | `''`                                | URL zum XPlanBox-Backend. **Erforderlich**.                                                                                                                                                                                       |
| xplanBoxServices    | `Array<'pre' \| 'current' \| 'archive'>` | `['pre', 'current']`                | Liste der zu verwendenden XPlanBox-Services (pre = Vorentwurf, current = aktuell, archive = archiviert). Reihenfolge beeinflusst Zeichenreihenfolge der Layer und Reihenfolge der Listen in 'Übersicht' und 'Hinzugefügte Pläne'. |
| filterInitiallyOpen | `boolean`                                | `true`                              | Gibt an, ob das Filterfenster beim initialen Aktivieren des Plugins geöffnet ist                                                                                                                                                  |
| additionalStyles3d  | `string[]`                               | `[]`                                | Liste zusätzlicher Styles, die für die Darstellung der Baufenster zur Verfügung stehen. Müssen in der app config konfiguriert und hier anhand des Namens verlinkt werden.                                                         |
| defaultStyle3d      | `Style3dOptions`                         | [siehe unten](#style3doptions)      | Name des Standard-3D-Styles für die Darstellung der Baufenster, pro Service                                                                                                                                                       |
| cubeCreationOptions | `CubeCreationOptions`                    | [siehe unten](#cubecreationoptions) | Optionen für die Erstellung der 3D-Baufenster                                                                                                                                                                                     |
| minZIndex           | `number`                                 | `10`                                | Minimaler z-Index für die Darstellung der 2D-WMS-Layer.                                                                                                                                                                           |

### ProjectionOptions

| Option | Typ      | Default                                               | Beschreibung                            |
| ------ | -------- | ----------------------------------------------------- | --------------------------------------- |
| epsg   | `string` | `'EPSG:25832'`                                        | EPSG-Code des Koordinatensystems        |
| proj4  | `string` | `'+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs'` | Proj4-Definition des Koordinatensystems |

### Style3dOptions

| Option  | Default                          | Beschreibung                           |
| ------- | -------------------------------- | -------------------------------------- |
| pre     | `'xplan-baufeld-InAufstellung'`  | Standard-Stil für Pläne in Aufstellung |
| current | `'xplan-baufeld-Rechtskraeftig'` | Standard-Stil für rechtskräftige Pläne |
| archive | `'xplan-baufeld-Archiviert'`     | Standard-Stil für archivierte Pläne    |

### CubeCreationOptions

| Option                  | Typ                                                         | Default                                            | Beschreibung                                                                                                                           |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| storeyAttributePriority | `Array<'Z' \| 'Zmax' \| 'Zmin' \| 'Zzwingend' \| 'Z_Ausn'>` | `['Z', 'Zmax', 'Zmin', 'Zzwingend', 'Z_Ausn']`     | Prioritätsliste der Geschossattribute zur Bestimmung der Anzahl der Geschosse                                                          |
| heightAttributePriority | `Array<'h' \| 'hMax' \| 'hMin' \| 'hZwingend'>`             | `['h', 'hMax', 'hMin', 'hZwingend']`               | Prioritätsliste der Höhenattribute zur Bestimmung der Gebäudehöhe                                                                      |
| bezugspunktPriority     | `BezugspunktConfig[]`                                       | [siehe unten](#bezugspunkt-konfiguration-standard) | Prioritätsliste der Bezugspunkte zur Interpretation der Höhenangaben                                                                   |
| defaultStoreyHeight     | `number`                                                    | `3`                                                | Standard-Geschosshöhe in Metern, falls keine Höhenangaben vorhanden sind                                                               |
| terrainLevelMethod      | `'min' \| 'max' \| 'average'`                               | `'average'`                                        | Methode zur Bestimmung der Geländehöhe (min = Niedrigster Geländepunkt, max = Höchster Geländepunkt, average = Mittlerer Geländepunkt) |

### Bezugspunkt-Konfiguration (Default)

Die Default-Prioritätsliste für `bezugspunktPriority` enthält folgende Werte:

```json
[
  { "bezugspunkt": "EMPTY", "relation": "height" },
  { "bezugspunkt": "5000", "relation": "height" },
  { "bezugspunkt": "6000", "relation": "height" },
  { "bezugspunkt": "6500", "relation": "height" },
  { "bezugspunkt": "1000", "relation": "height" },
  { "bezugspunkt": "2000", "relation": "height" },
  { "bezugspunkt": "3000", "relation": "height" },
  { "bezugspunkt": "3500", "relation": "height" },
  { "bezugspunkt": "4500", "relation": "groundFloor" },
  { "bezugspunkt": "4000", "relation": "groundFloor" },
  { "bezugspunkt": "5500", "relation": "terrain" },
  { "bezugspunkt": "6600", "relation": "terrain" }
]
```

Verfügbare Bezugspunkte:

- `EMPTY`: Keine Angabe
- `1000`: Traufhöhe
- `2000`: Firsthöhe
- `3000`: Oberkante
- `3500`: Lichte Höhe
- `4000`: Sockelhöhe
- `4500`: Erdgeschoss-Fußbodenhöhe
- `5000`: Höhe baulicher Anlagen
- `5500`: Unterkante
- `6000`: Gebäudehöhe
- `6500`: Wandhöhe
- `6600`: Geländeoberkante

Verfügbare Relationen:

- `height`: Absolute Höhe
- `groundFloor`: Relativ zum Erdgeschoss
- `terrain`: Relativ zum Gelände
