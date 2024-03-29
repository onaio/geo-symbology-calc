import { getClientSideSymbologyConfigs, pipelineController } from '$lib/server/appConfig';
import type { ConfigRunner } from '@onaio/symbology-calc-core';

/** @type {import('./$types').PageLoad} */
export function load() {
	const configs = getClientSideSymbologyConfigs();
	const ConfigsWithMetrics = configs.map((config) => {
		const configId = config.uuid;
		const pipeLineRunner = pipelineController.getPipelines(configId) as ConfigRunner;
		const isRunning = pipeLineRunner?.isRunning();
		return {
			...config,
			isRunning,
			invalidityErrror: pipeLineRunner?.invalidError ?? null
		};
	});
	return {
		configs: ConfigsWithMetrics
	};
}
