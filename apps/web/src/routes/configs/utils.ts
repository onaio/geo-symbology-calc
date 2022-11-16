import type { Config } from '@onaio/symbology-calc-core';
import * as yup from 'yup';

// TODO - dry out - duplicate in package core.
export enum PriorityLevel {
	VERY_HIGH = 'Very_High',
	HIGH = 'High',
	MEDIUM = 'Medium',
	LOW = 'Low'
}

export interface FormFields {
	baseUrl: string;
	formPair: {
		regFormId: string;
		visitFormId: string;
	};
	apiToken?: string;
	symbolConfig: {
		priorityLevel?: PriorityLevel;
		frequency?: number;
		symbologyOnOverflow: { overFlowDays?: number; color?: string }[];
	}[];
	schedule: string;
}

export const defaultColorCodeFormValues = { overFlowDays: undefined, color: undefined };
export const defaultColorcodeErrorValue = { overFlowDays: undefined, color: undefined };
export const defaultPriorityFormValues = {
	priorityLevel: PriorityLevel.VERY_HIGH,
	frequency: 0,
	symbologyOnOverflow: [{ ...defaultColorCodeFormValues }]
};
export const defaultPriorityErrorValues = {
	priorityLevel: undefined,
	frequency: undefined,
	symbologyOnOverflow: [{ ...defaultColorcodeErrorValue }]
};

export const initialValues: FormFields = {
	baseUrl: '',
	formPair: {
		regFormId: '',
		visitFormId: ''
	},
	apiToken: '<Replace with api token>',
	symbolConfig: [defaultPriorityFormValues],
	schedule: ''
};

export const configValidationSchema = yup.object().shape({
	baseUrl: yup.string().required('Base Url is required'),
	formPair: yup.object().shape({
		regFormId: yup.string().required('Geo point registration form is required'),
		visitFormId: yup.string().required('Visit form field is required')
	}),
	symbolConfig: yup
		.array()
		.of(
			yup.object().shape({
				priorityLevel: yup.string().oneOf(Object.values(PriorityLevel)),
				frequency: yup.number().required('Frequencey is required'),
				symbologyOnOverflow: yup.array().of(
					yup.object().shape({
						overFlowDays: yup.number().required('Over flow days is required'),
						color: yup.string().required('Color code is required.')
					})
				)
			})
		)
		.ensure()
		.min(1),
	schedule: yup
		.string()
		.test('schedule', 'Schedule is not valid cron syntax', async function (value?: string) {
			const res = await fetch('/configs/validate', {
				method: 'POST',
				body: JSON.stringify({
					schedule: value
				})
			});
			return await res
				.json()
				.then((body) => {
					if (body.valid) {
						return true;
					}
					throw Error('Invalid Error: Validation request failed');
				})
				.catch(() => {
					return false;
				});
		})
});

export const generateFilledData = (formFields: FormFields) => {
	const { baseUrl, formPair, apiToken, symbolConfig, schedule } = formFields;
	return { baseUrl, formPair, apiToken, symbolConfig, schedule };
};

export const getInitialValues = (data?: Config): FormFields => {
	if (data) {
		return {
			baseUrl: data.baseUrl,
			formPair: data.formPair,
			apiToken: '<Replace with api token>',
			symbolConfig: data.symbolConfig.map((config) => {
				return {
					...config,
					symbologyOnOverflow: config.symbologyOnOverflow.map((symbology) => {
						return { ...symbology, color: standardize_color(symbology.color) };
					})
				};
			}),
			schedule: data.schedule
		};
	}
	return initialValues;
};

export function standardize_color(str: string) {
	const ctx = document.createElement('canvas').getContext('2d');
	if (ctx) {
		ctx.fillStyle = str;
		return ctx.fillStyle;
	}
	return '';
}
