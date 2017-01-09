///<reference path="../../../headers/common.d.ts" />

// import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import echarts from 'echarts';

import kbn from 'app/core/utils/kbn';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

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
    scopeSelected: "china",
    links: [],
    datasource: null,
    maxDataPoints: 100,
    interval: null,
    targets: [{}],
    cacheTimeout: null,
    format: 'none',
    prefix: '',
    postfix: '',
    nullText: null,
    valueMaps: [{value: 'null', op: '=', text: 'N/A'}],
    mappingTypes: [
      {name: 'value to text', value: 1},
      {name: 'range to text', value: 2},
    ],
    rangeMaps: [{from: 'null', to: 'null', text: 'N/A'}],
    mappingType: 1,
    nullPointMode: 'connected',
    valueName: 'avg',
    prefixFontSize: '50%',
    valueFontSize: '80%',
    postfixFontSize: '50%',
    thresholds: '',
    colorBackground: false,
    colorValue: false,
    colors: [
      "rgba(245, 54, 54, 0.9)",
      "rgba(237, 129, 40, 0.89)",
      "rgba(50, 172, 45, 0.97)"
    ],
    sparkline: {
      show: false,
      full: false,
      lineColor: 'rgb(31, 120, 193)',
      fillColor: 'rgba(31, 118, 189, 0.18)',
    },
    gauge: {
      show: false,
      minValue: 0,
      maxValue: 100,
      thresholdMarkers: true,
      thresholdLabels: false
    }
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

    var data: any = {};
    this.setValues(data);

    this.data = data;
    this.render();
  }

  seriesHandler(seriesData) {
    var series = new TimeSeries({
      datapoints: seriesData.datapoints,
      alias: seriesData.target,
    });

    series.flotpairs = series.getFlotPairs(this.panel.nullPointMode);
    return series;
  }

  setColoring(options) {
    if (options.background) {
      this.panel.colorValue = false;
      this.panel.colors = [
        'rgba(71, 212, 59, 0.4)',
        'rgba(245, 150, 40, 0.73)',
        'rgba(225, 40, 40, 0.59)'
      ];
    } else {
      this.panel.colorBackground = false;
      this.panel.colors = [
        'rgba(50, 172, 45, 0.97)',
        'rgba(237, 129, 40, 0.89)',
        'rgba(245, 54, 54, 0.9)'
      ];
    }
    this.render();
  }

  invertColorOrder() {
    var tmp = this.panel.colors[0];
    this.panel.colors[0] = this.panel.colors[2];
    this.panel.colors[2] = tmp;
    this.render();
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

  setValues(data) {
    data.flotpairs = [];

    if (this.series.length > 1) {
      var error: any = new Error();
      error.message = 'Multiple Series Error';
      error.data =
          'Metric query returns ' + this.series.length +
          ' series. Single Stat Panel expects a single series.\n\nResponse:\n' +
          JSON.stringify(this.series);
      throw error;
    }

    if (this.series && this.series.length > 0) {
      var lastPoint = _.last(this.series[0].datapoints);
      var lastValue = _.isArray(lastPoint) ? lastPoint[0] : null;

      if (this.panel.valueName === 'name') {
        data.value = 0;
        data.valueRounded = 0;
        data.valueFormated = this.series[0].alias;
      } else if (_.isString(lastValue)) {
        data.value = 0;
        data.valueFormated = _.escape(lastValue);
        data.valueRounded = 0;
      } else {
        data.value = this.series[0].stats[this.panel.valueName];
        data.flotpairs = this.series[0].flotpairs;

        var decimalInfo = this.getDecimalsForValue(data.value);
        var formatFunc = kbn.valueFormats[this.panel.format];
        data.valueFormated = formatFunc(data.value, decimalInfo.decimals,
                                        decimalInfo.scaledDecimals);
        data.valueRounded = kbn.roundValue(data.value, decimalInfo.decimals);
      }

      // Add $__name variable for using in prefix or postfix
      data.scopedVars = _.extend({}, this.panel.scopedVars);
      data.scopedVars["__name"] = {value: this.series[0].label};
    }

    // check value to text mappings if its enabled
    if (this.panel.mappingType === 1) {
      for (var i = 0; i < this.panel.valueMaps.length; i++) {
        var map = this.panel.valueMaps[i];
        // special null case
        if (map.value === 'null') {
          if (data.value === null || data.value === void 0) {
            data.valueFormated = map.text;
            return;
          }
          continue;
        }

        // value/number to text mapping
        var value = parseFloat(map.value);
        if (value === data.valueRounded) {
          data.valueFormated = map.text;
          return;
        }
      }
    } else if (this.panel.mappingType === 2) {
      for (var i = 0; i < this.panel.rangeMaps.length; i++) {
        var map = this.panel.rangeMaps[i];
        // special null case
        if (map.from === 'null' && map.to === 'null') {
          if (data.value === null || data.value === void 0) {
            data.valueFormated = map.text;
            return;
          }
          continue;
        }

        // value/number to range mapping
        var from = parseFloat(map.from);
        var to = parseFloat(map.to);
        if (to >= data.valueRounded && from <= data.valueRounded) {
          data.valueFormated = map.text;
          return;
        }
      }
    }

    if (data.value === null || data.value === void 0) {
      data.valueFormated = "no value";
    }
  };

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
                echarts.registerMap(ctrl.panel.scopeSelected, geoJson);
                ctrl.chart = echarts.init(mapContainer[0]);
                ctrl.chart.setOption(
                    {series: [{type: 'map', map: ctrl.panel.scopeSelected}]});
                ctrl.scopeRendered = ctrl.panel.scopeSelected;
              });
      } else {
        ctrl.chart.resize();
      }

      // if (!ctrl.data) return;
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
