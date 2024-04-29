import { HttpResponseInit } from '@azure/functions';
import { IConsoleLog } from '../models/common/common.models.js';

export interface IResultData {
	jsonBody: any;
}

export async function executeTimerFunctionAsync(func: () => Promise<void>, consoleLog: IConsoleLog): Promise<void> {
	try {
		await func();
	} catch (error) {
		consoleLog.error(error);
		throw error;
	}
}

export async function executeHttpFunctionAsync(
	func: () => Promise<IResultData>,
	consoleLog: IConsoleLog
): Promise<HttpResponseInit> {
	try {
		const result = await func();

		return {
			jsonBody: { data: result.jsonBody },
			status: 200
		};
	} catch (error) {
		let message: string;
		consoleLog.error(error);

		if (error instanceof Error) {
			message = error.message;
		} else {
			message = `Unhandled error. See Azure logs for more details.`;
		}

		return {
			status: 500,
			jsonBody: {
				message: message
			}
		};
	}
}
