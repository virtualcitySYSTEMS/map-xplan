/* eslint-disable no-template-curly-in-string */
export default [
  {
    type: 'DeclarativeStyleItem',
    name: 'xplan-white-transparent',
    properties: {
      title: 'xplan.style.whiteTransparent',
      legend: [
        {
          type: 'StyleLegendItem',
          colNr: 1,
          rows: [
            {
              type: 'FillLegendRow',
              fill: {
                color: '#FFFFFF70',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.baufeld3d',
            },
          ],
        },
      ],
    },
    declarativeStyle: {
      show: 'true',
      color: {
        conditions: [['true', "color('#FFFFFF70')"]],
      },
      strokeColor: "color('rgb(50, 50, 50)')",
      strokeWidth: '3',
    },
  },
  {
    type: 'DeclarativeStyleItem',
    name: 'xplan-dark-transparent',
    properties: {
      title: 'xplan.style.darkTransparent',
      legend: [
        {
          type: 'StyleLegendItem',
          colNr: 1,
          rows: [
            {
              type: 'FillLegendRow',
              fill: {
                color: '#44444470',
              },
              stroke: {
                color: [255, 255, 255, 1],
                width: 2,
              },
              title: 'xplan.style.legend.baufeld3d',
            },
          ],
        },
      ],
    },
    declarativeStyle: {
      show: 'true',
      color: {
        conditions: [['true', "color('#44444470')"]],
      },
      strokeColor: "color('rgb(255,255, 255)')",
      strokeWidth: '3',
    },
  },
  {
    type: 'DeclarativeStyleItem',
    name: 'xplan-bauliche-nutzung',
    properties: {
      title: 'xplan.style.baulicheNutzung',
      legend: [
        {
          type: 'StyleLegendItem',
          colNr: 1,
          rows: [
            {
              type: 'FillLegendRow',
              fill: {
                color: '#cf937795',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.wohnbauflaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#d5a74495',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.gemischteBauflaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#a6a59695',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.gewerblicheBauflaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#fe7f2695',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.sonderbauflaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#e6e6e695',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.sonstigeBauflaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#64646c95',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.keineAngabe',
            },
          ],
        },
      ],
    },
    declarativeStyle: {
      show: 'true',
      color: {
        conditions: [
          [
            "${attributes.allgArtDerBaulNutzung} === '1000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1100' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1200' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1300'",
            "color('#cf937795')",
          ],
          [
            "${attributes.allgArtDerBaulNutzung} === '2000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1400' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1450' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1500' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1550' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1600'",
            "color('#d5a74495')",
          ],
          [
            "${attributes.allgArtDerBaulNutzung} === '3000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1700' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '1800'",
            "color('#a6a59695')",
          ],
          [
            "${attributes.allgArtDerBaulNutzung} === '4000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '2000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '2100' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '3000' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '4000'",
            "color('#fe7f2695')",
          ],
          [
            "${attributes.allgArtDerBaulNutzung} === '9999' || ${attributes.baugebiet.feature.values_.besondereArtDerBaulNutzung} === '9999'",
            "color('#e6e6e695')",
          ],
          ['true', "color('#64646c95')"],
        ],
      },
      strokeColor: "color('rgb(50, 50, 50)')",
      strokeWidth: '3',
    },
  },
  {
    type: 'DeclarativeStyleItem',
    name: 'xplan-hoehenauswertung',
    properties: {
      title: 'xplan.style.hoehenauswertung',
      legend: [
        {
          type: 'StyleLegendItem',
          colNr: 1,
          rows: [
            {
              type: 'FillLegendRow',
              fill: {
                color: '#21694d70',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.absoluteBaufeldhoehe',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#86b11070',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.relativeBaufeldhoehe',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#00adc570',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.baufeldhoeheAusVollgeschossen',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#D3D3D370',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.keineBaufeldhoehe',
            },
          ],
        },
      ],
    },
    declarativeStyle: {
      show: 'true',
      color: {
        conditions: [
          [
            "${attributes.resolvedHeightAttribute.hoehenbezug}==='1000' || ${attributes.resolvedHeightAttribute.hoehenbezug}==='1100' || ${attributes.resolvedHeightAttribute.hoehenbezug}==='1200'",
            "color('#21694d70')",
          ],
          [
            "${attributes.resolvedHeightAttribute.hoehenbezug}==='2000' || ${attributes.resolvedHeightAttribute.hoehenbezug}==='2500' || ${attributes.resolvedHeightAttribute.hoehenbezug}==='3000' || ${attributes.resolvedHeightAttribute.hoehenbezug}==='3500' || ${attributes.resolvedHeightAttribute.hoehenbezug}==='4000'",
            "color('#86b11070')",
          ],
          ['${attributes.resolvedStoreyAttribute}', "color('#00adc570')"],
          ['true', "color('#D3D3D370')"],
        ],
      },
      strokeColor: "color('rgb(50, 50, 50)')",
      strokeWidth: '3',
    },
  },
  {
    type: 'DeclarativeStyleItem',
    name: 'xplan-hoehenangabe',
    properties: {
      title: 'xplan.style.hoehenangabe',
      legend: [
        {
          type: 'StyleLegendItem',
          colNr: 1,
          rows: [
            {
              type: 'FillLegendRow',
              fill: {
                color: '#fc331e95',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.hoeheDoppelt',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#d5a74595',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.hoeheInBaugebietsTeilFlaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#114a7e95',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title:
                'xplan.style.legend.hoeheInUeberbaubareGrundstuecksFlaeche',
            },
            {
              type: 'FillLegendRow',
              fill: {
                color: '#dedede95',
              },
              stroke: {
                color: [50, 50, 50, 1],
                width: 2,
              },
              title: 'xplan.style.legend.keineHoehenangabe',
            },
          ],
        },
      ],
    },
    declarativeStyle: {
      show: 'true',
      color: {
        conditions: [
          ['${attributes.heightInBoth}===true', "color('#fc331e95')"],
          [
            "${attributes.heightInBoth}===false && ${attributes.heightsResolvedFrom}==='BP_BaugebietsTeilFlaeche'",
            "color('#d5a74595')",
          ],
          [
            "${attributes.heightInBoth}===false &&  ${attributes.heightsResolvedFrom}==='BP_UeberbaubareGrundstuecksFlaeche'",
            "color('#114a7e95')",
          ],
          ['true', "color('#dedede95')"],
        ],
      },
      strokeColor: "color('rgb(50, 50, 50)')",
      strokeWidth: '3',
    },
  },
];
