// Copyright 2018 Verily Life Sciences Inc.
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {DateTime, Interval} from 'luxon';
import {getDaysForIntervalSet, getTickMarksForXAxis} from './date_utils';


describe('date_utils', () => {
  it('getTickMarksForXAxis should enclose both ends of the data range', () => {
    const range = getTickMarksForXAxis(
        Interval.fromDateTimes(
            DateTime.local(1990, 7, 13, 12), DateTime.local(1990, 7, 15, 12)),
        false);

    expect(range).toEqual([
      DateTime.local(1990, 7, 13),
      DateTime.local(1990, 7, 14),
      DateTime.local(1990, 7, 15),
    ]);
  });
  it('getTickMarksForXAxis should include 12 hour dates if specified', () => {
    const range = getTickMarksForXAxis(
        Interval.fromDateTimes(
            DateTime.local(1990, 7, 13, 12), DateTime.local(1990, 7, 15, 12)),
        true);
    expect(range).toEqual([
      DateTime.local(1990, 7, 13),
      DateTime.local(1990, 7, 13, 12),
      DateTime.local(1990, 7, 14),
      DateTime.local(1990, 7, 14, 12),
      DateTime.local(1990, 7, 15),
      DateTime.local(1990, 7, 15, 12),
    ]);
  });

  it('getTickMarksForXAxis should not include next day if the end point is a date boundary',
     () => {
       const range = getTickMarksForXAxis(
           Interval.fromDateTimes(
               DateTime.local(1995, 7, 21, 12), DateTime.local(1995, 7, 24, 0)),
           false);

       expect(range).toEqual([
         DateTime.local(1995, 7, 21),
         DateTime.local(1995, 7, 22),
         DateTime.local(1995, 7, 23),
         DateTime.local(1995, 7, 24),
       ]);
     });

  it('getDaysForIntervalSet should cover all the intervals and be sorted',
     () => {
       const days = getDaysForIntervalSet([
         Interval.fromDateTimes(
             DateTime.local(1995, 7, 21, 12), DateTime.local(1995, 7, 23, 0)),
         Interval.fromDateTimes(
             DateTime.local(1995, 7, 13, 12), DateTime.local(1995, 7, 15, 1))
       ]);

       expect(days).toEqual([
         DateTime.local(1995, 7, 13).toUTC(),
         DateTime.local(1995, 7, 14).toUTC(),
         DateTime.local(1995, 7, 15).toUTC(),
         DateTime.local(1995, 7, 21).toUTC(),
         DateTime.local(1995, 7, 22).toUTC(),
         DateTime.local(1995, 7, 23).toUTC(),
       ]);
     });

  it('getDaysForIntervalSet should only list each day once', () => {
    const days = getDaysForIntervalSet([
      Interval.fromDateTimes(
          DateTime.local(1995, 7, 21, 12), DateTime.local(1995, 7, 24, 0)),
      Interval.fromDateTimes(
          DateTime.local(1995, 7, 21, 12), DateTime.local(1995, 7, 23, 0))
    ]);

    expect(days).toEqual([
      DateTime.local(1995, 7, 21).toUTC(),
      DateTime.local(1995, 7, 22).toUTC(),
      DateTime.local(1995, 7, 23).toUTC(),
      DateTime.local(1995, 7, 24).toUTC(),
    ]);
  });
});
