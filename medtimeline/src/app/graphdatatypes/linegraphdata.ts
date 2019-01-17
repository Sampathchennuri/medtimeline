// Copyright 2018 Verily Life Sciences Inc.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {DomSanitizer} from '@angular/platform-browser';
import {Color} from 'd3';
import {Interval} from 'luxon';

import {DisplayGrouping} from '../clinicalconcepts/display-grouping';
import {MedicationOrderSet} from '../fhir-data-classes/medication-order';
import {Observation} from '../fhir-data-classes/observation';
import {ObservationSet} from '../fhir-data-classes/observation-set';
import {MedicationAdministrationTooltip} from '../graphtypes/tooltips/medication-tooltips';
import {DiscreteObservationTooltip} from '../graphtypes/tooltips/observation-tooltips';
import {getDataColors} from '../theme/bch_colors';

import {GraphData} from './graphdata';
import {LabeledSeries} from './labeled-series';

/**
 * LineGraphData holds configurations for a line graph. A line graph may display
 * one or more LabeledSeries.
 */
export class LineGraphData extends GraphData {
  private constructor(
      /** The label for the graph. */
      readonly label: string,
      /** The LabeledSeries that are a part of this line graph. */
      series: LabeledSeries[],
      /** The display bounds of the y-axis. */
      readonly yAxisDisplayBounds: [number, number],
      /** The unit for the y-axis of the graph. */
      readonly unit: string,
      /**
       * The LabeledSeries mapped to which DisplayGrouping they fall under for
       * the purposes of color and legends
       */
      seriesToDisplayGroup: Map<LabeledSeries, DisplayGrouping>,
      tooltipMap?: Map<string, string>,
      tooltipKeyFn?: (key: string) => string) {
    super(series, seriesToDisplayGroup, tooltipMap, tooltipKeyFn);
  }

  /**
   * Converts a list of ObservationSets to a LineGraphData object.
   * @param label The label for this set of observations.
   * @param observationGroup A list of ObservationSets to display.
   * @returns a new LineGraphData for this observation set.
   * @throws Error if the observations in observationGroup have different units.
   */
  static fromObservationSetList(
      label: string, observationGroup: ObservationSet[]): LineGraphData {
    const seriesToDisplayGrouping = new Map<LabeledSeries, DisplayGrouping>();
    let seriesIdx = 0;
    const dataColors: Color[] = getDataColors();

    let minY: number = Number.MAX_VALUE;
    let maxY: number = Number.MIN_VALUE;

    const series: LabeledSeries[] = [];
    for (const obsSet of observationGroup) {
      const lblSeries = LabeledSeries.fromObservationSet(obsSet);
      series.push(lblSeries);
      seriesToDisplayGrouping.set(
          lblSeries,
          new DisplayGrouping(lblSeries.label, dataColors[seriesIdx]));

      seriesIdx = (seriesIdx + 1) % dataColors.length;

      /* Find the minimum and maximum y values for all the series. */
      minY = Math.min(minY, lblSeries.yDisplayBounds[0]);
      maxY = Math.max(maxY, lblSeries.yDisplayBounds[1]);
    }

    const allUnits =
        new Set(observationGroup.map(x => x.unit).filter(x => x !== undefined));
    if (allUnits.size > 1) {
      throw Error('Observations have different units.');
    }
    return new LineGraphData(
        label, series, [minY, maxY], allUnits.values().next().value,
        seriesToDisplayGrouping);
  }

  /*
   * Converts a list of MedicationOrderSets to a LineGraphData object.
   * @param medicationOrderListGroup A list of MedicationOrderSets to display.
   * @returns a new LineGraphData for this observation set.
   * @throws Error if the medication administrations in medicationOrderSet have
   *     different units.
   */
  static fromMedicationOrderSet(
      medicationOrderSet: MedicationOrderSet, dateRange: Interval,
      sanitizer: DomSanitizer): LineGraphData {
    const tooltipMap = new Map<string, string>();
    for (const order of medicationOrderSet.resourceList) {
      for (const admin of order.administrationsForOrder.resourceList) {
        const timestamp =
            admin.medAdministration.timestamp.toMillis().toString();
        // The key for this tooltip is the administration's timestamp.
        // There may be multiple data points associated with the timestamp
        // so we stack the administrations on top of one another in that case.
        const tooltipText = new MedicationAdministrationTooltip().getTooltip(
            [admin], sanitizer);
        if (tooltipMap.get(timestamp)) {
          tooltipMap.set(timestamp, tooltipMap.get(timestamp) + tooltipText);
        } else {
          tooltipMap.set(timestamp, tooltipText);
        }
      }
    }
    const singleSeries =
        LabeledSeries.fromMedicationOrderSet(medicationOrderSet, dateRange);
    const seriesToDisplayGrouping = new Map<LabeledSeries, DisplayGrouping>();
    seriesToDisplayGrouping.set(
        singleSeries,
        new DisplayGrouping(singleSeries.label, getDataColors()[0]));

    return new LineGraphData(
        medicationOrderSet.label, [singleSeries],
        [medicationOrderSet.minDose, medicationOrderSet.maxDose],
        medicationOrderSet.unit, seriesToDisplayGrouping, tooltipMap);
  }

  /**
   * Converts a list of ObservationSets with discrete y-values (results) to a
   * LineGraphData object.
   * If we are graphing Observations with discrete values, such as "yellow" for
   * the color of urine, we group all ObservationSets into one LabeledSeries,
   * and display textual information in the tooltip.
   * @param label The label for this set of observations.
   * @param observationGroup A list of ObservationSets to display.
   * @returns a new LineGraphData for this observation set.
   * @throws Error if the observations in observationGroup have different units.
   */
  static fromObservationSetListDiscrete(
      label: string, observationGroup: ObservationSet[],
      sanitizer: DomSanitizer): LineGraphData {
    // For ObservationSets with discrete categories, we display a scatterplot
    // with one series, with most information in the tooltip.
    const yValue = 10;
    const lblSeries = LabeledSeries.fromObservationSetsDiscrete(
        observationGroup, yValue, label);
    const seriesToDisplayGroup = new Map<LabeledSeries, DisplayGrouping>();
    seriesToDisplayGroup.set(
        lblSeries, new DisplayGrouping(lblSeries.label, getDataColors()[0]));

    const tooltipMap = new Map<string, string>();
    for (const observationSet of observationGroup) {
      for (const obs of observationSet.resourceList) {
        const tsString = obs.timestamp.toMillis().toString();
        const tooltipText =
            new DiscreteObservationTooltip().getTooltip([obs], sanitizer);
        // The key for this tooltip is the observation's timestamp.
        // There may be multiple data points associated with the timestamp
        // so we stack the tooltips on top of one another in that case.
        if (tooltipMap.has(tsString)) {
          tooltipMap.set(tsString, tooltipMap.get(tsString) + tooltipText);
        } else {
          tooltipMap.set(tsString, tooltipText);
        }
      }
    }
    return new LineGraphData(
        label, [lblSeries], [0, yValue], undefined,  // Units
        seriesToDisplayGroup, tooltipMap);
  }
}
