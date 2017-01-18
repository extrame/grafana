///<reference path="../../../headers/common.d.ts" />

// import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import echarts from 'echarts';

import kbn from 'app/core/utils/kbn';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {ChineseGeoCoords} from './china_cities';

class RouteMapCtrl extends MetricsPanelCtrl {
  static templateUrl = 'module.html';

  series: any[];
  data: any;
  fontSizes: any[];
  unitFormats: any[];
  invalidGaugeRange: boolean;
  panel: any;
  events: any;
  valueNameOptions: any[] = [
    'min',
    'max',
    'avg',
    'current',
    'total',
    'name',
    'first',
    'delta',
    'range'
  ];
  scope: any[] = [
    {scope: "world", area: "world"},
    {scope: "china", area: "china"},
    {scope: "sichuan", area: "china"},
    {scope: "hebei", area: "china"},
    {scope: "beijing", area: "china"},
    {scope: "zhejiang", area: "china"},
    {scope: "jiangsu", area: "china"},
  ];
  // Set and populate defaults
  panelDefaults = {
    mapType: "line",
    scopeSelected: "china",
    from: {type: "field", value: "from"},
    to: {type: "field", value: "to"},
    at: {type: "field", value: "at"},
    links: [],
    color: '#a6c84c',
    spot: {showAtStart: false, showAtStop: true}
  };

  /** @ngInject */
  constructor($scope, $injector, private $location, private linkSrv) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  scopeOptionChanged() {}

  onInitEditMode() {
    this.fontSizes = [
      '20%',
      '30%',
      '50%',
      '70%',
      '80%',
      '100%',
      '110%',
      '120%',
      '150%',
      '170%',
      '200%'
    ];
    this.addEditorTab('Worldmap',
                      'public/app/plugins/panel/routemap/partials/editor.html',
                      2);
    this.unitFormats = kbn.getUnitFormats();
  }

  setUnitFormat(subItem) {
    this.panel.format = subItem.value;
    this.render();
  }

  onDataError(err) { this.onDataReceived([]); }

  onDataReceived(dataList) {
    this.series = dataList.map(this.seriesHandler.bind(this));
    this.render();
  }

  getCoords(name) {
    for (var i = ChineseGeoCoords.length; i > 0; i--) {
      var feature = ChineseGeoCoords[i - 1];
      if (feature.name === name) {
        return feature.cp;
      }
    }
  }

  // geo {from: beijing, to: hangzhou}
  parseAliasAsLocationPair(alias) {
    var patt1 = /(\w+)\s*:\s*'*([^,\s}]+)'*/g;
    var res = {coords: [], name: ""};
    var result = patt1.exec(alias);
    var coord = [];
    while (result != null) {
      var loc = undefined;
      if (this.panel.from.type === "field" &&
          result[1] === this.panel.from.value) {
        res['from'] = result[2];
        loc = this.getCoords(res["from"]);
      } else if (this.panel.to.type === "field" &&
                 result[1] === this.panel.to.value) {
        res['to'] = result[2];
        loc = this.getCoords(res["to"]);
      } else if (this.panel.at.type === "field" &&
                 result[1] === this.panel.at.value) {
        res['at'] = result[2];
        loc = this.getCoords(res["at"]);
      }

      if (loc !== undefined) {
        coord.push(loc);
      }
      var result = patt1.exec(alias);
    }

    if (this.panel.mapType === "line") {
      if (this.panel.from.type === "fixed") {
        var loc = this.getCoords(this.panel.from.value);
        if (loc !== undefined) {
          coord[0] = loc;
        }
      }
      if (this.panel.to.type === "fixed") {
        var loc = this.getCoords(this.panel.to.value);
        if (loc !== undefined) {
          if (coord.length > 1) {
            coord[1] = loc;
          } else {
            coord.push(loc);
          }
        }
      }
    } else if (this.panel.mapType === "spot" &&
               this.panel.at.type === "fixed") {
      var loc = this.getCoords(this.panel.at.value);
      if (loc !== undefined) {
        coord[0] = loc;
      }
    }

    if (coord.length === 2) {
      res.coords = coord;
      res.name = alias;
      return res;
    }
  }

  seriesHandler(seriesData) {
    var series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  getDecimalsForValue(value) {
    if (_.isNumber(this.panel.decimals)) {
      return {decimals: this.panel.decimals, scaledDecimals: null};
    }

    var delta = value / 2;
    var dec = -Math.floor(Math.log(delta) / Math.LN10);

    var magn = Math.pow(10, -dec),
        norm = delta / magn,  // norm is between 1.0 and 10.0
        size;

    if (norm < 1.5) {
      size = 1;
    } else if (norm < 3) {
      size = 2;
      // special case for 2.5, requires an extra decimal
      if (norm > 2.25) {
        size = 2.5;
        ++dec;
      }
    } else if (norm < 7.5) {
      size = 5;
    } else {
      size = 10;
    }

    size *= magn;

    // reduce starting decimals if not needed
    if (Math.floor(value) === value) {
      dec = 0;
    }

    var result: any = {};
    result.decimals = Math.max(0, dec);
    result.scaledDecimals =
        result.decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

    return result;
  }

  removeValueMap(map) {
    var index = _.indexOf(this.panel.valueMaps, map);
    this.panel.valueMaps.splice(index, 1);
    this.render();
  };

  addValueMap() { this.panel.valueMaps.push({value: '', op: '=', text: ''}); }

  removeRangeMap(rangeMap) {
    var index = _.indexOf(this.panel.rangeMaps, rangeMap);
    this.panel.rangeMaps.splice(index, 1);
    this.render();
  };

  addRangeMap() { this.panel.rangeMaps.push({from: '', to: '', text: ''}); }

  link(scope, elem, attrs, ctrl) {
    const mapContainer = elem.find('.mapcontainer');

    function setElementHeight() { elem.css('height', ctrl.height + 'px'); }

    ctrl.events.on('render', () => {
      render();
      ctrl.renderingCompleted();
    });


    function render() {
      // if (ctrl.panel.scopeSelected === undefined) {
      // ctrl.panel.scopeSelected = "china";
      // }
      if (ctrl.scopeRendered !== ctrl.panel.scopeSelected) {
        $.get('public/app/plugins/panel/routemap/map/json/' +
                  ctrl.panel.scopeSelected + '.json',
              function(geoJson) {
                ctrl.panel.geo = geoJson;
                echarts.registerMap(ctrl.panel.scopeSelected, geoJson);
                ctrl.chart = echarts.init(mapContainer[0]);
                ctrl.chart.setOption(
                    {series: [{type: 'map', map: ctrl.panel.scopeSelected}]});
                ctrl.scopeRendered = ctrl.panel.scopeSelected;
                renderData(ctrl.series, ctrl.panel.color);
              });
      } else {
        ctrl.chart.resize();
        renderData(ctrl.series, ctrl.panel.color);
      }

      // if (!ctrl.data) return;
    }

    function renderData(data, color) {
      var maxSpotRadius = 10;
      var maxValue = 10;
      var series = [
        {
          type: 'lines',
          zlevel: 1,
          data: [],
          effect: {
            show: true,
            period: 6,
            trailLength: 0.7,
            color: '#fff',
            symbolSize: 3
          },
          lineStyle: {normal: {color: color, width: 0, curveness: 0.2}},
        },
        {
          data: [],
          type: 'lines',
          zlevel: 2,
          symbol: ['none', 'arrow'],
          symbolSize: 10,
          effect: {show: true, period: 6, trailLength: 0, symbolSize: 1},
          lineStyle:
              {normal: {color: color, width: 1, opacity: 0.6, curveness: 0.2}},
        },
        {
          data: [],
          type: 'effectScatter',
          coordinateSystem: 'geo',
          zlevel: 2,
          rippleEffect: {brushType: 'stroke'},
          label: {normal: {show: false, position: 'right', formatter: '{b}'}},
          symbolSize: function(val) {
            return val[2] / maxValue * maxSpotRadius;
          },
          itemStyle: {normal: {color: color}},
        }
      ];
      if (data !== undefined) {
        if (ctrl.panel.mapType === "line") {
          series["type"] = "lines";
          for (var i = data.length; i > 0; i--) {
            var line = ctrl.parseAliasAsLocationPair(data[i - 1].alias);
            if (line !== undefined) {
              maxValue = maxValue < data[i - 1].datapoints[0][0] ?
                             data[i - 1].datapoints[0][0] :
                             maxValue;
              series[0].data.push(line);
              series[1].data.push(line);
              if (ctrl.panel.spot.showAtStart) {
                series[2].data.push({
                  name: data[i - 1].alias,
                  value: line.coords[0].concat(data[i - 1].datapoints[0][0])
                });
              }
              if (ctrl.panel.spot.showAtStop) {
                series[2].data.push({
                  name: data[i - 1].alias,
                  value: line.coords[1].concat(data[i - 1].datapoints[0][0])
                });
              }
            }
          }
        }
      }
      if (series[0].data.length > 0) {
        ctrl.chart.setOption(
            {
              // backgroundColor: '#404a59',
              tooltip: {trigger: 'item'},
              geo: {
                label: {emphasis: {show: false}},
                map: ctrl.scopeRendered,
                itemStyle: {
                  normal: {areaColor: '#323c48', borderColor: '#404a59'},
                  emphasis: {areaColor: '#2a333d'}
                }
              },
              series: series
            },
            true);
      }
    }
  }
}

function getColorForValue(data, value) {
  for (var i = data.thresholds.length; i > 0; i--) {
    if (value >= data.thresholds[i - 1]) {
      return data.colorMap[i];
    }
  }
  return _.first(data.colorMap);
}

export {RouteMapCtrl as PanelCtrl, getColorForValue};
