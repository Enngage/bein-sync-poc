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
			const limitRaw: string | undefined = request.query.get(limitQueryParam) ?? undefined;

			const limit: number | undefined = limitRaw ? +limitRaw : undefined;

			if (!limit) {
				throw Error(`Please provide '${limitQueryParam}' parameter to url query.`);
			}

			const syncService = new KontentAiMigrationService({
				// storage
				accountName: environmentHelper.getRequiredValue('BLOB_STORAGE_ACCOUNT_NAME'),
				accountKey: environmentHelper.getRequiredValue('BLOB_STORAGE_ACCOUNT_KEY'),
				// kontent
				sourceEnvironmentId: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_ENVIRONMENT_ID'),
				sourceDeliveryKey: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_DELIVERY_KEY'),
				sourceMapiKey: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_MAPI_KEY'),
				targetEnvironmentId: environmentHelper.getRequiredValue('KONTENT_AI_TARGET_ENVIRONMENT_ID'),
				targetMapiKey: environmentHelper.getRequiredValue('KONTENT_AI_TARGET_MAPI_KEY'),
				usePreview: false,
				useSecureApi: environmentHelper.getRequiredValue('KONTENT_AI_SOURCE_ENABLE_SECURE_API')?.toLowerCase() === 'true',
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
