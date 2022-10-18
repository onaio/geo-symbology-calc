import { Configs, PriorityLevel } from '../../types';
import form3623 from '../fixtures/3623-form.json';
import form3623Submissions from '../fixtures/3623-form-submissions.json';
import form3624Submissions from '../fixtures/3624-form-submissions.json';

export { form3623, form3623Submissions, form3624Submissions };

export const apiToken = 'apiToken';
export const createConfigs = (loggerMock: jest.Mock): Configs => ({
  formPair: {
    registrationFormId: '3623',
    visitformId: '3624'
  },
  symbolConfig: {
    [PriorityLevel.VERY_HIGH]: {
      frequency: 3,
      symbologyOnOverflow: [
        {
          overFlowDays: 0,
          color: 'green'
        },
        {
          overFlowDays: 1,
          color: 'yellow'
        },
        {
          overFlowDays: 4,
          color: 'red'
        }
      ]
    },
    [PriorityLevel.HIGH]: {
      frequency: 7,
      symbologyOnOverflow: [
        {
          overFlowDays: 0,
          color: 'green'
        },
        {
          overFlowDays: 1,
          color: 'red'
        }
      ]
    },
    [PriorityLevel.MEDIUM]: {
      frequency: 14,
      symbologyOnOverflow: [
        {
          overFlowDays: 0,
          color: 'green'
        },
        {
          overFlowDays: 1,
          color: 'red'
        }
      ]
    },
    [PriorityLevel.LOW]: {
      frequency: 30,
      symbologyOnOverflow: [
        {
          overFlowDays: 0,
          color: 'green'
        },
        {
          overFlowDays: 1,
          color: 'red'
        }
      ]
    }
  },
  logger: loggerMock,
  apiToken,
  baseUrl: 'https://test-api.ona.io'
});