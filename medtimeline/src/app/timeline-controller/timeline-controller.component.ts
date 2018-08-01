// Copyright 2018 Verily Life Sciences Inc.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {Component, EventEmitter, OnInit, Output, Renderer2, ViewChild} from '@angular/core';
import {DateTime, Duration, Interval} from 'luxon';
import * as moment from 'moment';
import {DaterangepickerDirective} from 'ngx-daterangepicker-material';
import {APP_TIMESPAN} from 'src/constants';

import {getDaysForIntervalSet} from '../date_utils';
import {FhirService} from '../fhir.service';

/**
 * Date range picker for selecting the time span to show in all the charts.
 *
 * There is a lot of messy date conversion in this class. The problem is that
 * we use luxon DateTime for our date handling across this application, but the
 * date range picker only works with Moment.js datetimes. The only format both
 * classes have converters for is JSDate, so we pass dates through that
 * several places.
 */
@Component({
  selector: 'app-timeline-controller',
  templateUrl: './timeline-controller.component.html',
  styleUrls: ['./timeline-controller.component.css']
})
export class TimelineControllerComponent implements OnInit {
  @Output() changeDateRange = new EventEmitter<Interval>();
  @ViewChild(DaterangepickerDirective)
  pickerDirective: DaterangepickerDirective;

  selected: {startDate: moment.Moment, endDate: moment.Moment};

  /**
   * Holds all the ISO strings for days covered by all the patient encounters
   * above. Used to gray out datepicker options that are not part of
   * a patient's encounter.
   */
  daysCoveredByAnEncounter = new Set<string>();

  /** Bounds the dates that may be selected. */
  earliestAvailableDate = moment.utc(APP_TIMESPAN.start.toJSDate());
  readonly latestAvailableDate = moment.utc(APP_TIMESPAN.end.toJSDate());

  /** Selected timespan is past seven days by default. */
  readonly defaultDateRange = {
    startDate: moment.utc(
        DateTime.utc().minus(Duration.fromObject({days: 7})).toJSDate()),
    endDate: moment.utc(DateTime.utc())
  };

  constructor(private renderer: Renderer2, private fhirService: FhirService) {}

  ngOnInit() {
    this.fhirService.getEncountersForPatient(APP_TIMESPAN)
        .then(
            encounters => {
              if (encounters.length > 0) {
                encounters = encounters.sort(
                    (a, b) =>
                        a.period.start.toMillis() - b.period.start.toMillis());

                const latestEncounter =
                    encounters[encounters.length - 1].period;
                // Make the default selection the latest encounter. It's safe to
                // not pin this to a date boundary since there should be no data
                // points that fall outside the time range of the encounter.
                this.datesUpdated({
                  startDate: moment.utc(latestEncounter.start.toJSDate()),
                  endDate: moment.utc(latestEncounter.end.toJSDate())
                });

                // Set the minimum date to select to be the beginning of the
                // earliest encounter that had days that fell inside the app
                // timespan.
                this.earliestAvailableDate =
                    moment.utc(encounters[0].period.start.toJSDate());

                // We have to store everything as an ISO string because if we
                // store as objects the set membership check doesn't work.
                this.daysCoveredByAnEncounter = new Set<string>(
                    getDaysForIntervalSet(encounters.map(x => x.period))
                        .map(x => x.toISO().slice(0, 10)));
              }
            },
            reject => {
              // points that fall outside the time range of the encounter.
              this.datesUpdated(this.defaultDateRange);
            });
  }

  // Only allow selection of dates covered by an encounter.
  filterDates =
      (m: moment.Moment) => {
        return !this.daysCoveredByAnEncounter.has(m.toISOString().slice(0, 10));
      }

  /**
   * Emits the date range picked in the date picker as an event.
   * @param range The date range selected in the picker.
   */
  datesUpdated(rangeIn: {startDate: moment.Moment, endDate: moment.Moment}) {
    if (!rangeIn.startDate || !rangeIn.endDate || !this.selected) {
      return;
    }

    this.selected = rangeIn;
    const interval = Interval.fromDateTimes(
        DateTime.fromJSDate(rangeIn.startDate.toDate()),
        DateTime.fromJSDate(rangeIn.endDate.toDate()));
    this.changeDateRange.emit(interval);
  }

  open(e) {
    this.pickerDirective.open();
  }
}
