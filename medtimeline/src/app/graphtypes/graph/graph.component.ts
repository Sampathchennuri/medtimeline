// Copyright 2018 Verily Life Sciences Inc.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {AfterViewInit, Input, OnChanges, SimpleChanges} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import * as c3 from 'c3';
import * as d3 from 'd3';
import {DateTime} from 'luxon';
import {GraphData} from 'src/app/graphdatatypes/graphdata';
import {LabeledSeries} from 'src/app/graphdatatypes/labeled-series';
import {LineGraphData} from 'src/app/graphdatatypes/linegraphdata';
import {v4 as uuid} from 'uuid';

import {StandardTooltip} from '../tooltips/tooltip';

import {DateTimeXAxis} from './datetimexaxis';
import {RenderedChart} from './renderedchart';
import {RenderedCustomizableChart} from './renderedcustomizablechart';

export enum ChartType {
  SCATTER,
  LINE,
  STEP,
  MICROBIO
}

/**
 * Displays a graph. T is the data type the graph is equipped to display.
 */
export abstract class GraphComponent<T extends GraphData> implements
    AfterViewInit, OnChanges {
  // The x-axis eventlines to display on the chart.
  @Input() eventlines: Array<{[key: string]: number | string}>;
  /**
   * The x-axis to use for the chart.
   */
  @Input() xAxis: DateTimeXAxis;
  @Input() data: T;
  // The y-axis label to display.
  @Input() axisLabel: string;

  /**
   * The x regions to mark on this graph.
   */
  @Input() xRegions: any[];

  // A unique identifier for the element to bind the graph to.
  chartDivId: string;

  // What type of chart this is. Line chart by default.
  chartType: ChartType = ChartType.LINE;

  // Indicating whether are not there are any data points for the current time
  // interval.
  dataPointsInDateRange: boolean;

  // The rendered chart so that you can apply functions to it.
  protected renderedChart: RenderedChart|RenderedCustomizableChart;

  // The rendered chart's configuration.
  chartConfiguration: c3.ChartConfiguration;

  /** The default y-axis configuration for the chart. */
  readonly yAxisConfig: c3.YAxisConfiguration = {
    label: {text: '', position: 'outer-middle'},
    tick: {
      count: 5,
      format:
          d => {
            // We add padding to our y-axis tick labels so that all y-axes of
            // the charts rendered on the page can be aligned.
            return (d)
                .toLocaleString('en-us', {
                  minimumFractionDigits: this.data.precision,
                  maximumFractionDigits: this.data.precision
                })
                .trim();
          }
    }
  };

  // A map containing a color for each series displayed on the graph.
  colorsMap: {[key: string]: string} = {};

  // The default chart type for this chart.
  chartTypeString: string;

  /**
   * The base chart height to use when rendering.
   */
  private readonly BASE_CHART_HEIGHT_PX = 150;

  /**
   * The amount of padding to add to the left of the graph. This goes hand in
   * hand with how we choose to wrap the labels in the rendered chart, so if
   * Y_AXIS_TICK_MAX changes, this probably needs to change, too.
   */
  private readonly Y_AXIS_LEFT_PADDING = 125;

  constructor(
      readonly sanitizer: DomSanitizer,
      private readonly renderedConstructor:
          (axis: DateTimeXAxis, divId: string) => RenderedChart) {
    // Generate a unique ID for this chart.
    const chartId = uuid();
    // Replace the dashes in the UUID to meet HTML requirements.
    const re = /\-/gi;
    this.chartDivId = 'chart' + chartId.replace(re, '');
  }

  // The chart can't find the element to bind to until after the view is
  // initialized so we need to regenerate the chart here.
  ngAfterViewInit() {
    this.generateChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.renderedChart) {
      return;
    }
    if (changes.eventlines) {
      this.renderedChart.updateEventlines(changes.eventlines.currentValue);
    }
  }


  /**
   * When the component gets initialized, it calls this function to make the
   * c3 chart configuration and render it. As outlined in the function below,
   * there are several steps along the way (please see individual function-level
   * comments for more details):
   *
   * 1) prepareForChartConfiguration: an overrideable function in which
   * subclasses can get things ready for the chart configuration to get
   * generated
   * 2) generateBasicChart: make the chart configuration and store
   * it in this class
   * 3) adjustGeneratedChartConfiguration: make any tweaks to the chart
   *    configuration
   * 4) Work with the renderedChart class variable to render
   * the chart via c3 and do some generic styling of the chart
   * 5) onRender callback runs for the graph generated.
   */

  generateChart() {
    if (this.data && this.xAxis) {
      this.dataPointsInDateRange =
          this.data.dataPointsInRange(this.xAxis.dateRange);
      this.prepareForChartConfiguration();
      this.generateBasicChart();
      this.adjustGeneratedChartConfiguration();
      this.renderedChart =
          this.renderedConstructor(this.xAxis, this.chartDivId);
      this.renderedChart.generate(
          this.chartConfiguration, this.dataPointsInDateRange);
    }
  }

  /**
   * Lines up any extra things needed to generate the ChartConfiguration.
   * This may include things like adding atypical data series, custom-setting
   * colors, etc.
   */
  prepareForChartConfiguration() {}


  /**
   * Takes the generated chart configuration (in this.chartConfiguration) and
   * tweaks it. Override this function to modify the defaults of the chart
   * configuration.
   */
  adjustGeneratedChartConfiguration() {}

  /**
   * Called every time the graph is rendered. If subclass graphs want to do
   * something special upon rendering, they can override this function.
   */
  onRendered(graphObject): void {}


  /**
   * Sets up a generalized c3.ChartConfig for the data passed in. See the
   * type definition at:
   * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/c3/index.d.ts
   * @param maxXTicks: The maximum number of tick-marks to include on the x-axis
   */
  generateBasicChart(maxXTicks = 10) {
    this.chartTypeString = 'line';

    if (this.chartType === ChartType.SCATTER) {
      this.chartTypeString = 'scatter';
    } else if (this.chartType !== ChartType.LINE) {
      throw Error('Unsupported chart type: ' + this.chartType);
    }

    // Show the y-axis label on the chart.
    this.yAxisConfig['label'] = {
      text: (this.axisLabel ? this.axisLabel : ''),
      position: 'outer-middle'
    };

    const self = this;
    const chartConfiguration = {
      axis: {x: this.xAxis.xAxisConfig, y: this.yAxisConfig},
      bindto: '#' + this.chartDivId,
      data: {
        columns: this.data.c3DisplayConfiguration.allColumns,
        xs: this.data.c3DisplayConfiguration.columnMap,
        type: this.chartTypeString,
        colors: this.makeColorMap(),
      },
      grid: {y: {}, x: {}},
      legend: {show: false},  // There's always a custom legend
      line: {connectNull: false},
      onrendered: function() {
        self.renderedChart.addToRenderQueue(() => {
          self.renderedChart.setXRegions(self.xRegions);
        });
        self.renderedChart.addToRenderQueue(() => {
          self.renderedChart.updateEventlines(self.eventlines);
        });
        self.renderedChart.addToRenderQueue(() => {
          self.onRendered(this);
        });
      },
      padding: {left: this.Y_AXIS_LEFT_PADDING},
      size: {height: this.BASE_CHART_HEIGHT_PX},
      tooltip: this.setTooltip(),
    };

    this.chartConfiguration = chartConfiguration;
  }

  resetChart() {
    this.renderedChart.resetChart();
  }

  focusOnSeries(labeledSeries: LabeledSeries[]) {
    this.renderedChart.focusOnSeries(labeledSeries.map(series => series.label));
  }

  private makeColorMap() {
    const colorMap: {[key: string]: string} = {};
    for (const series of this.data.series) {
      colorMap[series.label] = series.legendInfo.fill.toString();
    }
    return colorMap;
  }

  /**
   * Sets the tooltip for the graph.
   * If the class has a tooltipMap set, then we look up the tooltip from that
   * map. If there's no tooltipMap, then we return a simple formatted tooltip
   * of just the string representing the data plus the appropriate units for
   * a linegraph, or just the unedited value if it's a different kind of graph.
   */
  setTooltip(): {} {
    const self = this;
    if (this.data && this.data.tooltipMap) {
      return {
        contents: (
            pointData: any[], defaultTitleFormat, defaultValueFormat,
            color) => {
          // pointData will hold every point for the x-value you're hovering
          // on. We squish together all those data points preemptively in
          // our tooltip creation so that we just find the index of the
          // tooltip based on the first point's x-value.
          const value = pointData[0];
          const timestampKey =
              DateTime.fromJSDate(value.x).toMillis().toString();
          // Our data class may provide a tooltip key function that will
          // get the correct identifier from the data point. If it does,
          // we'll use that, but by default, the key is the timestamp
          // of the data point.
          const keyToUse = this.data.tooltipKeyFn ?
              this.data.tooltipKeyFn(value) :
              timestampKey;
          // If something bad happens and we don't have a tooltip for the
          // key, return an empty string so that there will just be no
          // tooltip.
          if (!this.data.tooltipMap.has(keyToUse)) {
            return new StandardTooltip(
                       pointData, color,
                       self.data instanceof LineGraphData ? self.data.unit : '')
                .getTooltip(undefined, this.sanitizer);
          }
          return this.data.tooltipMap.get(keyToUse);
        }
      };
    } else {
      return {
        format: {
          value: (value, ratio, id, index) => {
            if (self.data instanceof LineGraphData) {
              return (
                  d3.format(',.' + self.data.precision + 'f')(value) + ' ' +
                  self.data.unit);
            }
            return value;
          }
        }
      };
    }
  }
}
