import { InvocationContext } from '@azure/functions';
import { IConsoleLog } from '../models/common/common.models.js';

export function getConsoleLog(context: InvocationContext): IConsoleLog {
	return {
		error: (message) => context.error(message),
		information: (message) => context.log(message)
	};
}
