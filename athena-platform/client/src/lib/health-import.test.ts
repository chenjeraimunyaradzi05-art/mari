import { appleDate, detectFormat, mergedHours, parseAppleHealthText, parseAthenaCsv, parseGoogleFitDailyCsv, parseGoogleFitSessions, splitCsvLine, summarise } from './health-import';

const APPLE = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_AU">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" creationDate="2026-09-01 08:10:00 +1000" startDate="2026-09-01 08:00:00 +1000" endDate="2026-09-01 08:10:00 +1000" value="1200"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" creationDate="2026-09-01 18:10:00 +1000" startDate="2026-09-01 18:00:00 +1000" endDate="2026-09-01 18:10:00 +1000" value="3000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" creationDate="2026-09-01 18:10:00 +1000" startDate="2026-09-01 08:00:00 +1000" endDate="2026-09-01 18:10:00 +1000" value="6100"/>
 <Record type="HKQuantityTypeIdentifierAppleExerciseTime" sourceName="Watch" unit="min" creationDate="2026-09-01 18:10:00 +1000" startDate="2026-09-01 17:00:00 +1000" endDate="2026-09-01 17:40:00 +1000" value="40"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="iPhone" creationDate="2026-09-02 07:00:00 +1000" startDate="2026-09-01 22:30:00 +1000" endDate="2026-09-02 06:30:00 +1000" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" creationDate="2026-09-02 07:00:00 +1000" startDate="2026-09-01 23:00:00 +1000" endDate="2026-09-02 03:00:00 +1000" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Watch" creationDate="2026-09-02 07:00:00 +1000" startDate="2026-09-02 02:00:00 +1000" endDate="2026-09-02 06:00:00 +1000" value="HKCategoryValueSleepAnalysisAsleepREM"/>
 <Record type="HKQuantityTypeIdentifierDietaryWater" sourceName="WaterMinder" unit="mL" creationDate="2026-09-01 12:00:00 +1000" startDate="2026-09-01 12:00:00 +1000" endDate="2026-09-01 12:00:00 +1000" value="1250"/>
 <Record type="HKCategoryTypeIdentifierMenstrualFlow" sourceName="iPhone" creationDate="2026-09-03 09:00:00 +1000" startDate="2026-09-03 09:00:00 +1000" endDate="2026-09-03 09:00:00 +1000" value="HKCategoryValueMenstrualFlowLight"/>
 <Record type="HKCategoryTypeIdentifierMenstrualFlow" sourceName="Watch" creationDate="2026-09-03 21:00:00 +1000" startDate="2026-09-03 21:00:00 +1000" endDate="2026-09-03 21:00:00 +1000" value="HKCategoryValueMenstrualFlowHeavy"/>
 <Record type="HKCategoryTypeIdentifierMindfulSession" sourceName="Smiling Mind" creationDate="2026-09-01 07:20:00 +1000" startDate="2026-09-01 07:10:00 +1000" endDate="2026-09-01 07:20:00 +1000"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-09-01 08:00:00 +1000" endDate="2026-09-01 08:00:00 +1000" value="72"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="30.4" durationUnit="min" sourceName="Watch" creationDate="2026-09-01 17:31:00 +1000" startDate="2026-09-01 17:00:00 +1000" endDate="2026-09-01 17:30:00 +1000">
  <MetadataEntry key="HKIndoorWorkout" value="0"/>
 </Workout>
</HealthData>`;

describe('the file readers', () => {
  it('tells the formats apart from the name and the first bytes', () => {
    expect(detectFormat('export.xml', APPLE)).toBe('apple-health');
    expect(detectFormat('Daily Summaries.csv', 'Date,Move Minutes count,Calories (kcal),Step count\n2026-09-01,30,1800,8000')).toBe('google-fit-daily');
    expect(detectFormat('2026-09-01T07_00_00+10_00_PT8H_sleep.json', '{"fitnessActivity":"sleep","startTime":"2026-08-31T23:00:00.000+10:00","endTime":"2026-09-01T07:00:00.000+10:00"}')).toBe('google-fit-session');
    expect(detectFormat('athena-health-2026-09-11.csv', 'kind,day,at,field,value\nCHECKIN,2026-09-10,2026-09-10T08:00:00.000Z,mood,4')).toBe('athena-csv');
    expect(detectFormat('notes.txt', 'just some words')).toBeNull();
  });

  it('reads Apple dates and splits CSV lines with quotes', () => {
    expect(appleDate('2026-09-01 22:30:00 +1000')).toEqual({ day: '2026-09-01', ms: Date.parse('2026-09-01T22:30:00+10:00') });
    expect(appleDate('nonsense')).toBeNull();
    expect(splitCsvLine('a,"b, with comma","she said ""hi""",')).toEqual(['a', 'b, with comma', 'she said "hi"', '']);
    expect(mergedHours([[0, 3600000], [1800000, 7200000], [10800000, 14400000]])).toBe(3);
  });

  it('turns an Apple Health export into a night, a day of steps, a workout, water and a period day', () => {
    const r = parseAppleHealthText(APPLE);
    expect(r.source).toBe('apple-health');
    const sleep = r.entries.find((e) => e.kind === 'SLEEP');
    // Two asleep intervals that overlap by an hour: 23:00 to 06:00 is seven hours, not eight.
    expect(sleep).toMatchObject({ day: '2026-09-02', payload: { hours: 7, source: 'apple-health' } });
    const day = r.entries.find((e) => e.kind === 'ACTIVITY' && e.payload.type === 'other');
    // Steps take the larger source (the watch's 6100), not the sum of both; exercise minutes less the workout's thirty.
    expect(day).toMatchObject({ day: '2026-09-01', payload: { steps: 6100, minutes: 10 } });
    expect(r.entries.find((e) => e.kind === 'ACTIVITY' && e.payload.type === 'walk')).toMatchObject({ payload: { minutes: 30 } });
    expect(r.entries.find((e) => e.kind === 'ACTIVITY' && e.payload.type === 'meditation')).toMatchObject({ payload: { minutes: 10 } });
    expect(r.entries.find((e) => e.kind === 'HYDRATION')).toMatchObject({ day: '2026-09-01', payload: { glasses: 5 } });
    expect(r.entries.find((e) => e.kind === 'PERIOD')).toMatchObject({ day: '2026-09-03', payload: { flow: 'heavy' } });
    expect(r.entries.some((e) => JSON.stringify(e).includes('HeartRate'))).toBe(false);
    expect(summarise(r.entries)).toMatchObject({ from: '2026-09-01', to: '2026-09-03' });
  });

  it('reads Google Fit daily summaries and session files', () => {
    const daily = parseGoogleFitDailyCsv('Date,Move Minutes count,Calories (kcal),Distance (m),Heart Points,Step count,Walking duration (ms)\n2026-09-01,42,1900,5200,12,7600,1800000\n2026-09-02,,1700,,,0,\n');
    expect(daily.entries).toHaveLength(1);
    expect(daily.entries[0]).toMatchObject({ kind: 'ACTIVITY', day: '2026-09-01', payload: { minutes: 42, steps: 7600, source: 'google-fit' } });
    expect(daily.skipped).toBe(1);
    const quarterHour = parseGoogleFitDailyCsv('Start time,End time,Move Minutes count,Step count\n07:00:00,07:15:00,3,400');
    expect(quarterHour.entries).toHaveLength(0);
    expect(quarterHour.notes[0]).toMatch(/Daily Summaries/);
    const sessions = parseGoogleFitSessions([
      { name: 'sleep.json', text: '{"fitnessActivity":"sleep","startTime":"2026-08-31T23:10:00.000+10:00","endTime":"2026-09-01T06:40:00.000+10:00"}' },
      { name: 'run.json', text: '{"fitnessActivity":"running","startTime":"2026-09-01T06:50:00.000+10:00","endTime":"2026-09-01T07:22:00.000+10:00","aggregate":[{"metricName":"com.google.step_count.delta","intValue":4100}]}' },
      { name: 'broken.json', text: '{not json' },
    ]);
    expect(sessions.entries.find((e) => e.kind === 'SLEEP')).toMatchObject({ day: '2026-09-01', payload: { hours: 7.5 } });
    expect(sessions.entries.find((e) => e.kind === 'ACTIVITY')).toMatchObject({ day: '2026-09-01', payload: { type: 'run', minutes: 32, steps: 4100 } });
    expect(sessions.skipped).toBe(1);
  });

  it('reads the CSV this app writes back into entries, and leaves the dose logs out', () => {
    const csv = ['kind,day,at,field,value', 'CHECKIN,2026-09-10,2026-09-10T08:00:00.000Z,mood,4', 'CHECKIN,2026-09-10,2026-09-10T08:00:00.000Z,stress,2', 'CHECKIN,2026-09-10,2026-09-10T08:00:00.000Z,anxiety,2', 'CHECKIN,2026-09-10,2026-09-10T08:00:00.000Z,energy,3',
      'PERIOD,2026-09-09,2026-09-09T09:00:00.000Z,flow,medium', 'PERIOD,2026-09-09,2026-09-09T09:00:00.000Z,symptoms,Cramps; Headache', 'ACTIVITY,2026-09-09,2026-09-09T10:00:00.000Z,type,walk', 'ACTIVITY,2026-09-09,2026-09-09T10:00:00.000Z,minutes,30',
      'MEDICATION_DOSE,2026-09-09,2026-09-09T08:00:00.000Z,status,taken', 'NONSENSE,2026-09-09,x,y,z'].join('\n');
    const r = parseAthenaCsv(csv);
    expect(r.entries).toHaveLength(3);
    expect(r.entries.find((e) => e.kind === 'CHECKIN')).toMatchObject({ payload: { mood: 4, stress: 2, anxiety: 2, energy: 3 } });
    expect(r.entries.find((e) => e.kind === 'PERIOD')).toMatchObject({ payload: { flow: 'medium', symptoms: ['Cramps', 'Headache'] } });
    expect(r.entries.find((e) => e.kind === 'ACTIVITY')).toMatchObject({ payload: { type: 'walk', minutes: 30, source: 'athena-csv' } });
    expect(r.skipped).toBe(1);
    expect(r.notes.some((n) => /dose/.test(n))).toBe(true);
    expect(parseAthenaCsv('a,b,c').entries).toHaveLength(0);
  });
});
