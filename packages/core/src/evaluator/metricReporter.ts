import { ResultCodes, ResultCodingsDescriptions } from '../helpers/Result';

export type TriggeredBy = 'schedule' | 'manual';

// the most distinct sample error messages to retain per reason code; keeps the
// report payload bounded while still surfacing the underlying url/status/message.
const MAX_ERROR_SAMPLES = 5;

// extra context about a failure, captured alongside the reason code so the report
// can show what actually went wrong (http status, a sample error message) instead
// of only the generic reason description.
export interface FailureReportInput {
  // http status of the failed request, when the failure was an http response.
  httpStatus?: number;
  // a representative underlying error message (url | status | message).
  errorSample?: string;
}

// accumulates the failure context seen for a single reason code.
interface FailureDetailAccumulator {
  // number of affected facilities per http status (key is the status, e.g. '500',
  // or 'no-status' is omitted - transport errors simply contribute no status entry).
  statusBreakdown: Record<string, number>;
  // a capped, de-duplicated list of underlying error messages.
  samples: string[];
}

export class ReportMetric {
  private triggeredBy?: TriggeredBy;
  private triggeredStart?: number;
  private triggeredEnd?: number;
  private totalFacilities?: number;
  private facilitiesEvaluated = 0;
  private facilitiesNotEvaluated: Record<
    string,
    { recsAffected: number } & FailureDetailAccumulator
  > = {};
  private facilitiesEvaluatedModified: Record<string, Record<string, number>> = {};
  private facilitiesEvaluatedNotModified: Record<
    string,
    { count: number } & FailureDetailAccumulator
  > = {};
  private configId: string;
  private generalErrors?: Array<string>

  constructor(configId: string) {
    this.configId = configId;
  }

  public updateStart(triggeredBy: TriggeredBy = 'schedule') {
    this.triggeredBy = triggeredBy;
    this.triggeredStart = Date.now();
  }

  public updateEnd() {
    this.triggeredEnd = Date.now();
  }

  /** records http status + a sample message for a failure, weighted by the number
   * of affected facilities (1 per facility for evaluated-but-not-modified, the page
   * size for whole-page fetch failures). */
  private recordFailureDetail(
    accumulator: FailureDetailAccumulator,
    detail?: FailureReportInput,
    weight = 1
  ) {
    if (!detail) {
      return;
    }
    const { httpStatus, errorSample } = detail;
    if (httpStatus !== undefined) {
      const statusKey = `${httpStatus}`;
      accumulator.statusBreakdown[statusKey] =
        (accumulator.statusBreakdown[statusKey] ?? 0) + weight;
    }
    if (
      errorSample &&
      accumulator.samples.length < MAX_ERROR_SAMPLES &&
      !accumulator.samples.includes(errorSample)
    ) {
      accumulator.samples.push(errorSample);
    }
  }

  /** shapes a single reason-code row for the report, attaching the http status
   * breakdown and sample messages only when they carry information so that
   * non-network reasons keep their lean { total, description } shape. */
  private buildBreakdownRow(
    code: string,
    total: number,
    accumulator: FailureDetailAccumulator
  ) {
    const row: {
      total: number;
      description: string;
      statusBreakdown?: Record<string, number>;
      samples?: string[];
    } = {
      total,
      description: ResultCodingsDescriptions[code] as string
    };
    if (Object.keys(accumulator.statusBreakdown).length > 0) {
      row.statusBreakdown = accumulator.statusBreakdown;
    }
    if (accumulator.samples.length > 0) {
      row.samples = accumulator.samples;
    }
    return row;
  }

  public updateGeneralError(errorMessage: string){
    if(this.generalErrors === undefined){
      this.generalErrors = []
    }
    this.generalErrors.push(errorMessage)
  }

  public updateTotalFacilities(value: number) {
    this.totalFacilities = value;
  }

  public updateFacilitiesEvaluated() {
    this.facilitiesEvaluated += 1;
  }

  public updateFacilitiesNotEvaluated(
    code: ResultCodes | string,
    value: number,
    detail?: FailureReportInput
  ) {
    if (this.facilitiesNotEvaluated[code] === undefined) {
      this.facilitiesNotEvaluated[code] = { recsAffected: 0, statusBreakdown: {}, samples: [] };
    }
    this.facilitiesNotEvaluated[code].recsAffected = value;
    this.recordFailureDetail(this.facilitiesNotEvaluated[code], detail, value);
  }

  public updateEvaluatedNotModified(
    resultCode: ResultCodes | string,
    detail?: FailureReportInput
  ) {
    if (this.facilitiesEvaluatedNotModified[resultCode] === undefined) {
      this.facilitiesEvaluatedNotModified[resultCode] = {
        count: 0,
        statusBreakdown: {},
        samples: []
      };
    }
    this.facilitiesEvaluatedNotModified[resultCode].count++;
    this.recordFailureDetail(this.facilitiesEvaluatedNotModified[resultCode], detail);
  }

  public updateEvaluatedModified(resultCode: ResultCodes | string, color: string, value?: number) {
    if (this.facilitiesEvaluatedModified[resultCode] === undefined) {
      this.facilitiesEvaluatedModified[resultCode] = {};
    }
    if (this.facilitiesEvaluatedModified[resultCode][color] === undefined) {
      this.facilitiesEvaluatedModified[resultCode][color] = 0;
    }
    this.facilitiesEvaluatedModified[resultCode][color]++;
  }

  public generateJsonReport(closeReport = false) {
    if (closeReport) {
      this.updateEnd();
    }

    const modified = Object.values(this.facilitiesEvaluatedModified).reduce(
      (acc, value) => {
        for (const [key, val] of Object.entries(value)){
            acc.total += val;
            acc[key] = val
        }
        return acc
      },
      { total: 0 } as any
    );

    const notModified = Object.entries(this.facilitiesEvaluatedNotModified).reduce((acc, [key, entry]) => {
        acc.total += entry.count;
        acc[key] = this.buildBreakdownRow(key, entry.count, entry);
        return acc
    }, { total: 0 } as any)


    const notEvaluated = Object.entries(this.facilitiesNotEvaluated).reduce((acc, [key, entry]) => {
        acc.total += entry.recsAffected;
        acc[key] = this.buildBreakdownRow(key, entry.recsAffected, entry);
        return acc;
    }, {total: 0} as any)

    return {
      configId: this.configId,
      trigger: {
        by: this.triggeredBy,
        from: this.triggeredStart,
        to: this.triggeredEnd,
        tookMills:
          this.triggeredEnd && this.triggeredStart
            ? ((this.triggeredEnd - this.triggeredStart))
            : undefined
      },
      totalFacilities: this.totalFacilities,
      totalFacilitiesEvaluated: this.facilitiesEvaluated,
      facilitiesEvaluated: {
        total: modified.total + notModified.total,
        modified: {
          ...modified
        },
        notModified: {
          ...notModified
        }
      },
      facilitiesNotEvaluated: {
        ...notEvaluated
      },
      generalErrors: this.generalErrors,
    };
  }
}

export interface JSONMetricReport {
  configId: string;
  trigger: {
    by: TriggeredBy;
    from: number;
    to?: number;
    tookMills?: number;
  };
}

/** Needs some re-achitecturing */
