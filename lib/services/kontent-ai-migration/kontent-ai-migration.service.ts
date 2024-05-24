import {
	IExportAdapterResult,
	IKontentAiExportRequestItem,
	migrateAsync,
	Log
} from '@kontent-ai-consulting/migration-toolkit';
import Colors from 'colors';
import { IConsoleLog } from '../../models/common/common.models.js';
import { BlobStorageService, ILogsRecord } from '../blob-storage/index.js';
import { createDeliveryClient } from '@kontent-ai/delivery-sdk';

export interface IKontentAiMigrationServiceConfig {
	accountName: string;
	accountKey: string;
	sourceEnvironmentId: string;
	sourceDeliveryKey: string;
	sourceMapiKey: string;
	targetEnvironmentId: string;
	targetMapiKey: string;
	usePreview: boolean;
	useSecureApi: boolean;
	log: IConsoleLog;
}

export interface IKontentAiMigrationResult {
	logRecord: ILogsRecord;
	overviewLogFileUrl: string;
	logFileUrl: string;
}

export interface IKontentAiMigrateContentConfig {
	contentTypeCodenameToExport?: string;
	limit?: number;
}

export class KontentAiMigrationService {
	private readonly fetchItemsLimit: number = 50;
	private readonly migrationToolkitLog: Log = {
		console: (data) =>
			this.config.log.information(`${Colors.yellow(`Migration Log: `)} ${Colors.white(data.message)}`)
	};

	constructor(private config: IKontentAiMigrationServiceConfig) {}

	async migrateContentAsync(config: IKontentAiMigrateContentConfig): Promise<IKontentAiMigrationResult> {
		this.config.log.information(`Kontent ai project: ${this.config.sourceEnvironmentId}`);
		this.config.log.information(`Using preview: ${this.config.usePreview}`);
		this.config.log.information(`Blob account: ${this.config.accountName}`);

		const blobStorageService = new BlobStorageService({
			accountKey: this.config.accountKey,
			accountName: this.config.accountName,
			log: this.config.log
		});

		const itemsToMigrate = await this.getItemsToMigrateAsync(config);

		console.log(`Items to migrate: ${itemsToMigrate.length}`);

		if (itemsToMigrate.length) {
			await migrateAsync({
				log: this.migrationToolkitLog,
				sourceEnvironment: {
					id: this.config.sourceEnvironmentId,
					apiKey: this.config.sourceMapiKey,
					items: itemsToMigrate
				},
				targetEnvironment: {
					id: this.config.targetEnvironmentId,
					apiKey: this.config.targetMapiKey,
					skipFailedItems: false
				}
			});
		}

		const logsRecord: ILogsRecord = {
			date: new Date(),
			overview: {
				migratedItemsCount: itemsToMigrate.length
			},
			items: itemsToMigrate.map((m) => {
				return {
					codename: m.itemCodename,
					language: m.languageCodename
				};
			})
		};

		this.config.log.information(`Storing logs record in blob storage`);

		const overviewLogFile = await blobStorageService.storeOverviewLogFileAsync({
			record: logsRecord
		});
		const logFile = await blobStorageService.storeLogFileAsync({
			record: logsRecord
		});

		return {
			logRecord: logsRecord,
			overviewLogFileUrl: overviewLogFile.absoluteUrl,
			logFileUrl: logFile.absoluteUrl
		};
	}

	private async getItemsToMigrateAsync(
		config: IKontentAiMigrateContentConfig
	): Promise<IKontentAiExportRequestItem[]> {
		const deliveryClient = createDeliveryClient({
			environmentId: this.config.sourceEnvironmentId,
			secureApiKey: this.config.sourceDeliveryKey,
			defaultQueryConfig: {
				useSecuredMode: this.config.useSecureApi
			}
		});

		if (config.limit && config.limit > this.fetchItemsLimit) {
			throw Error(
				`Current limit for migration is set to '${this.fetchItemsLimit}'. Your value is '${config.limit}'. Please use a smaller value.`
			);
		}

		let query = deliveryClient
			.items()
			.depthParameter(0)
			.orderByDescending('system.last_modified')
			.limitParameter(
				config.limit && config.limit < this.fetchItemsLimit ? config.limit : this.fetchItemsLimit
			);

		if (config.contentTypeCodenameToExport) {
			query = query.type(config.contentTypeCodenameToExport);
		}

		const itemsToExport = await query.toPromise();

		const exportItems: IKontentAiExportRequestItem[] = itemsToExport.data.items.map((m) => {
			return {
				itemCodename: m.system.codename,
				languageCodename: m.system.language
			};
		});

		return exportItems;
	}
}
