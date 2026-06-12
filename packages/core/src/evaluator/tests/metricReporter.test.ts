import { ReportMetric } from '../metricReporter';
import { MISSING_PRIORITY_LEVEL, NETWORK_ERROR } from '../../helpers/Result';

const getNotModified = (reporter: ReportMetric) =>
  (reporter.generateJsonReport() as any).facilitiesEvaluated.notModified;
const getNotEvaluated = (reporter: ReportMetric) =>
  (reporter.generateJsonReport() as any).facilitiesNotEvaluated;

it('aggregates an http status breakdown and sample messages for network errors', () => {
  const reporter = new ReportMetric('uuid');
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, {
    httpStatus: 500,
    errorSample: 'URL: a | Status: 500'
  });
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, {
    httpStatus: 500,
    errorSample: 'URL: b | Status: 500'
  });
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, {
    httpStatus: 429,
    errorSample: 'URL: c | Status: 429'
  });

  expect(getNotModified(reporter)[NETWORK_ERROR]).toEqual({
    total: 3,
    description: 'Request failed due to an unrecoverable network error',
    statusBreakdown: { '500': 2, '429': 1 },
    samples: ['URL: a | Status: 500', 'URL: b | Status: 500', 'URL: c | Status: 429']
  });
});

it('omits breakdown fields for non-network reasons', () => {
  const reporter = new ReportMetric('uuid');
  reporter.updateEvaluatedNotModified(MISSING_PRIORITY_LEVEL);

  expect(getNotModified(reporter)[MISSING_PRIORITY_LEVEL]).toEqual({
    total: 1,
    description: 'Facility does not have a priority level'
  });
});

it('records a status entry but no samples for transport errors without an http status', () => {
  const reporter = new ReportMetric('uuid');
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, {
    errorSample: 'Error Name: FetchError | Message: request timed out'
  });

  expect(getNotModified(reporter)[NETWORK_ERROR]).toEqual({
    total: 1,
    description: 'Request failed due to an unrecoverable network error',
    samples: ['Error Name: FetchError | Message: request timed out']
  });
});

it('caps samples at five and de-duplicates repeats', () => {
  const reporter = new ReportMetric('uuid');
  for (let i = 0; i < 8; i++) {
    reporter.updateEvaluatedNotModified(NETWORK_ERROR, {
      httpStatus: 500,
      errorSample: `msg-${i}`
    });
  }
  // a duplicate of an already-captured sample should not be added again.
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, { httpStatus: 500, errorSample: 'msg-0' });

  const entry = getNotModified(reporter)[NETWORK_ERROR];
  expect(entry.total).toEqual(9);
  expect(entry.samples).toHaveLength(5);
  expect(entry.statusBreakdown).toEqual({ '500': 9 });
});

it('accumulates not-evaluated counts across failed pages, consistent with the breakdown', () => {
  const reporter = new ReportMetric('uuid');
  reporter.updateFacilitiesNotEvaluated(NETWORK_ERROR, 1000, {
    httpStatus: 500,
    errorSample: 'page-1'
  });
  reporter.updateFacilitiesNotEvaluated(NETWORK_ERROR, 1000, {
    httpStatus: 500,
    errorSample: 'page-2'
  });

  const entry = getNotEvaluated(reporter)[NETWORK_ERROR];
  expect(entry.total).toEqual(2000);
  expect(entry.statusBreakdown).toEqual({ '500': 2000 });
  expect(entry.samples).toEqual(['page-1', 'page-2']);
});

it('does not let a yielded report mutate when the reporter keeps accumulating', () => {
  const reporter = new ReportMetric('uuid');
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, { httpStatus: 500, errorSample: 'first' });

  const firstReport = getNotModified(reporter)[NETWORK_ERROR];

  // keep running: another failure of the same code arrives.
  reporter.updateEvaluatedNotModified(NETWORK_ERROR, { httpStatus: 429, errorSample: 'second' });

  // the previously-yielded report must be unchanged.
  expect(firstReport).toEqual({
    total: 1,
    description: 'Request failed due to an unrecoverable network error',
    statusBreakdown: { '500': 1 },
    samples: ['first']
  });
});
