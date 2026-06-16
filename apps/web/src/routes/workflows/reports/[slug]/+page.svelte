<script lang="ts">
	import type { PageData } from './$types';
	import { range } from 'lodash-es';
	import { formatTimestamp, formatTriggerDuration, parseForTable } from './utils';
	import { normalizeErrorSample, type ErrorSample } from '@onaio/symbology-calc-core';
	import PageHeader from '$lib/shared/components/PageHeader.svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@zerodevx/svelte-toast';
	import { convertCronToHuman } from '../../utils';
	
	export let data: PageData;

	// callback for manual trigger user action.
	const manualTrigger = async (uuid: string) => {
		const sParams = new URLSearchParams({
			uuid
		});
		const fullUrl = `/workflows/run?${sParams.toString()}`;
		return await fetch(fullUrl)
			.then((res) => {
				res.json().then((body) => {
					toast.push(body.message);
				});
			})
			.catch((err) => {
				toast.push(err.message);
			});
	};

	// callback for edit trigger user action.
	const editTrigger = async (uuid: string) => {
		const sParams = new URLSearchParams({
			uuid
		});
		const fullUrl = `/configs?${sParams.toString()}`;
		goto(fullUrl);
	};

	// callback for delete trigger user action.
	const deleteTrigger = async (uuid: string) => {
		const sParams = new URLSearchParams({
			uuid
		});
		const fullUrl = `/configs?${sParams.toString()}`;
		return await fetch(fullUrl, {
			method: 'DELETE'
		})
			.then(() => {
				toast.push('Config deleted.');
			})
			.catch((err) => {
				toast.push(err.message);
			})
			.finally(() => {
				window.location.reload();
			});
	};

	// shape of a single reason row in the not-modified / not-evaluated report tables.
	type ReasonRow = {
		total: number;
		description: string;
		// http status -> affected facility count, present only for network failures.
		statusBreakdown?: Record<string, number>;
		// sample underlying errors (url | status | message) with the time each occurred.
		// legacy reports (before timestamps) persisted these as plain strings.
		samples?: (string | ErrorSample)[];
	};

	// TODO - below section DRY out these functions.
	const getModifiedColors = (metric: any) => {
		const onlyModified = { ...metric.facilitiesEvaluated.modified };
		delete onlyModified.total;
		return onlyModified;
	};

	const getNotModifiedReasons = (metric: any): Record<string, ReasonRow> => {
		const onlyNotModified = { ...metric.facilitiesEvaluated.notModified };
		delete onlyNotModified.total;
		return onlyNotModified;
	};

	const getNotEvaluatedReasons = (metric: any): Record<string, ReasonRow> => {
		const notEvaluatedReasons = { ...metric.facilitiesNotEvaluated };
		delete notEvaluatedReasons.total;
		return notEvaluatedReasons;
	};

	// renders a per-reason http status breakdown, e.g. "HTTP 500: 3000, HTTP 429: 485".
	const formatStatusBreakdown = (statusBreakdown?: Record<string, number>) => {
		if (!statusBreakdown) {
			return '';
		}
		return Object.entries(statusBreakdown)
			.map(([status, count]) => `HTTP ${status}: ${count}`)
			.join(', ');
	};
</script>

<!-- <svelte:head>
	<meta http-equiv="refresh" content="5" />
</svelte:head> -->

{#if data.configs.length === 0}
	<main>
		<PageHeader pageTitle="Configured Pipeline list" />
		<div class="card">
			<div class="card-body">
				<span class="text-danger">No Pipeline configurations were detected.</span>
			</div>
		</div>
	</main>
{:else}
	<main>
		<PageHeader pageTitle="Configured Pipeline list" />
		{#each data.configs as config, idex}
			{@const { tableHeaders, tableRows, colorsColSpan } = parseForTable(config)}
			{@const metric = config.metric}
			<div class="card my-3">
				<div class="card-header d-flex justify-content-end gap-2">
					<button
						on:click={() => manualTrigger(config.uuid)}
						disabled={config.isRunning}
						class="btn btn-outline-primary btn-sm"
						><i class="fas fa-cogs" /> Manually Trigger workflow</button
					>
					<button on:click={() => editTrigger(config.uuid)} class="btn btn-outline-primary btn-sm"
						><i class="fas fa-edit" /> Edit</button
					>
					<button on:click={() => deleteTrigger(config.uuid)} class="btn btn-outline-danger btn-sm">
						<i class="fas fa-trash" /> Delete
					</button>
				</div>
				<div class="card-body">
					{#if config.invalidityErrror !== null}
						<div class="card mb-1">
							<div class="card-body">
								<span class="text-danger">{config.invalidityErrror}</span>
							</div>
						</div>
					{/if}
					<dl class="row">
						<dt class="col-sm-3">Pipeline name</dt>
						<dd class="col-sm-9">{config.title}</dd>
						<dt class="col-sm-3">API Base url</dt>
						<dd class="col-sm-9">{config.baseUrl}</dd>
						<dt class="col-sm-3">Registration form Id</dt>
						<dd class="col-sm-9">{config.regFormId}</dd>
						<dt class="col-sm-3">Visit form Id</dt>
						<dd class="col-sm-9">{config.visitFormId}</dd>
					</dl>
					<div class="text-center">
						<table class="table table-bordered table-sm table-hover text-center">
							<thead>
								<tr>
									{#each tableHeaders as header, i}
										{#if i === tableHeaders.length - 1}
											<th scope="col" colspan={colorsColSpan}>{header}</th>
										{:else}
											<th scope="col">{header}</th>
										{/if}
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each tableRows as row}
									<tr>
										{#each range(colorsColSpan + (tableHeaders.length - 1)) as idx}
											{@const thisElement = row[idx]}
											{#if thisElement === undefined}
												<td />
											{:else if Array.isArray(thisElement)}
												<td style={`background-color: ${thisElement[1]}`}
													><span class="fw-bolder">{thisElement[0]}</span></td
												>
											{:else}
												<td>{thisElement}</td>
											{/if}
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
						<span class="card-text d-inline-block me-2 text-muted">Schedule:</span><span
							class="card-text">{convertCronToHuman(config.schedule)}</span
						>
					</div>
					<hr />
					<h5>Metrics for the last run</h5>
					{#if metric === undefined}
						<div class="card">
							<div class="card-body">
								<span class="text-danger"
									>No previous run information was found for this Pipeline.</span
								>
							</div>
						</div>
					{:else}
						{#if config.isRunning}
							<span class="text-info">Pipeline is currently running.</span>
						{/if}
						<dl class="row">
							<dt class="col-sm-9">pipeline ran for</dt>
							<dd class="col-sm-3">
								{formatTriggerDuration(metric.trigger.from, metric.trigger.to, config.isRunning)}
							</dd>
							<dt class="col-sm-9">Pipeline triggered via</dt>
							<dd class="col-sm-3">{metric.trigger.by}</dd>

							<dt class="col-sm-9">Total no. of facilities</dt>
							<dd class="col-sm-3">{metric?.totalFacilities ?? ' - '}</dd>

							<dt class="col-sm-9">No. of facilities evaluated</dt>
							<dd class="col-sm-3">{metric?.facilitiesEvaluated.total}</dd>

							<dt class="col-sm-9">No. of facilities NOT evaluated</dt>
							<dd class="col-sm-3">{metric?.facilitiesNotEvaluated.total}</dd>
						</dl>
						{@const generalErrors = metric?.generalErrors ?? []}
						<div>
							{#each generalErrors as error}
								<div class="alert alert-danger" role="alert">
									{error}
								</div>
							{/each}
						</div>
						<!-- parse for facilities evaluated breakdown -->
						<div class="card mb-3">
							<div class="card-body">
								<p class="fw-bolder">
									Report for facilities Evaluated. ({metric.facilitiesEvaluated.total})
								</p>
								<p class="fw-bold">Modified.({metric.facilitiesEvaluated.modified.total})</p>
								<table class="table table-bordered table-sm table-hover text-center">
									<thead>
										<tr>
											<th>Change</th>
											<th>color</th>
											<th>No. of facilities</th>
										</tr>
									</thead>
									<tbody>
										{#each Object.entries(getModifiedColors(metric)) as row}
											<tr>
												<td>Marker color changed to</td>
												<td style={`background-color: ${row[0]}`}
													><span class="fw-bolder">&nbsp;&nbsp;&nbsp;&nbsp;</span></td
												>
												<td>{row[1]}</td>
											</tr>
										{/each}
										<tr>
											<td colspan="2"> Total</td>
											<td>
												{metric.facilitiesEvaluated.modified.total}
											</td>
										</tr>
									</tbody>
								</table>

								<p class="fw-bold">Not Modified.({metric.facilitiesEvaluated.notModified.total})</p>
								<table class="table table-bordered table-sm table-hover text-center">
									<thead>
										<tr>
											<th>Reason code</th>
											<th>Reason description</th>
											<th>No. of facilities</th>
											<th>Details</th>
										</tr>
									</thead>
									<tbody>
										{#each Object.entries(getNotModifiedReasons(metric)) as row}
											<tr>
												<td>{row[0]}</td>
												<td> {row[1].description}</td>
												<td>{row[1].total}</td>
												<td class="text-start">
													{#if row[1].statusBreakdown}
														<div>{formatStatusBreakdown(row[1].statusBreakdown)}</div>
													{/if}
													{#if row[1].samples}
														<ul class="mb-0 small text-muted">
															{#each row[1].samples as sample}
																{@const normalized = normalizeErrorSample(sample)}
																<li>
																	{#if normalized.at}<span class="fw-bold"
																			>{formatTimestamp(normalized.at)}</span
																		> &mdash; {/if}{normalized.message}
																</li>
															{/each}
														</ul>
													{/if}
												</td>
											</tr>
										{/each}
										<tr>
											<td colspan="2"> Total</td>
											<td colspan="2">
												{metric.facilitiesEvaluated.notModified.total}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>

						<div class="card mb-3">
							<div class="card-body">
								<p class="fw-bolder">
									Report for facilities NOT Evaluated. ({metric.facilitiesNotEvaluated.total})
								</p>

								<table class="table table-bordered table-sm table-hover text-center">
									<thead>
										<tr>
											<th>Reason code</th>
											<th>Reason description</th>
											<th>No. of facilities</th>
											<th>Details</th>
										</tr>
									</thead>
									<tbody>
										{#each Object.entries(getNotEvaluatedReasons(metric)) as row}
											<tr>
												<td>{row[0]}</td>
												<td> {row[1].description}</td>
												<td>{row[1].total}</td>
												<td class="text-start">
													{#if row[1].statusBreakdown}
														<div>{formatStatusBreakdown(row[1].statusBreakdown)}</div>
													{/if}
													{#if row[1].samples}
														<ul class="mb-0 small text-muted">
															{#each row[1].samples as sample}
																{@const normalized = normalizeErrorSample(sample)}
																<li>
																	{#if normalized.at}<span class="fw-bold"
																			>{formatTimestamp(normalized.at)}</span
																		> &mdash; {/if}{normalized.message}
																</li>
															{/each}
														</ul>
													{/if}
												</td>
											</tr>
										{/each}

										<tr>
											<td colspan="2">Total</td>
											<td colspan="2">
												{metric.facilitiesNotEvaluated.total}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</main>
{/if}

<style scoped>
	dt {
		color: #5e5e5e;
		font-weight: 500;
	}

	th {
		font-weight: 500;
	}
</style>
