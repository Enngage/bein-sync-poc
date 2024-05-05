import { app } from '@azure/functions';
import { environmentHelper } from '../../../lib/helpers/environment-helper.js';
import { KontentAiMigrationService } from '../../../lib/services/kontent-ai-migration/index.js';
import { getConsoleLog } from '../../../lib/helpers/log-helper.js';
import { executeHttpFunctionAsync } from '../../../lib/helpers/function-execution-helper.js';

const contentTypeQueryParam: string = 'contentType';
const limitQueryParam: string = 'limit';

app.http('MigrateContent', {
	methods: ['GET'],
	authLevel: 'anonymous',
	handler: async (request, context) => {
		const consoleLog = getConsoleLog(context);

		return await executeHttpFunctionAsync(async () => {
			const contentTypeToExport: string | undefined = request.query.get(contentTypeQueryParam) ?? undefined;
			const limit: string | undefined = request.query.get(limitQueryParam) ?? undefined;

			const syncService = new KontentAiMigrationService({
				// storage
				accountName: environmentHelper.getRequiredValue('BLOB_STORAGE_ACCOUNT_NAME'),
				accountKey: environmentHelper.getRequiredValue('BLOB_STORAGE_ACCOUNT_KEY'),
				// kontent
				sourceEnvironmentId: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_ENVIRONMENT_ID'),
				sourceDeliveryKey: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_DELIVERY_KEY'),
				sourceMapiKey: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_MAPI_KEY'),
				targetEnvironmentId: environmentHelper.getRequiredValue('KONTENT_AI_TARGET_ENVIRONMENT_ID'),
				targetDeliveryKey: environmentHelper.getRequiredValue('KONTENT_AI_TARGET_DELIVERY_KEY'),
				targetMapiKey: environmentHelper.getRequiredValue('KONTENT_AI_TARGET_MAPI_KEY'),
				usePreview: false,
				// log
				log: consoleLog
			});

			const migrationResult = await syncService.migrateContentAsync({
				contentTypeCodenameToExport: contentTypeToExport,
				limit: limit ? +limit : undefined
			});

			return {
				jsonBody: {
					result: 'success',
					overviewLogFile: migrationResult.overviewLogFileUrl,
					logFile: migrationResult.logFileUrl,
					data: {
						...migrationResult.logRecord
					}
				}
			};
		}, consoleLog);
	}
});
