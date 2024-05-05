import {
	IExportAdapterResult,
	IKontentAiExportRequestItem,
	ImportToolkit,
	KontentAiExportAdapter,
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
	targetDeliveryKey: string;
	targetMapiKey: string;
	usePreview: boolean;
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
	private readonly deliveryItemsLimit: number = 2000;
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

		const exportData = await this.getExportDataAsync(config);

		const logsRecord: ILogsRecord = {
			date: new Date(),
			overview: {
				migratedItemsCount: exportData.items.length,
				migratedAssetsCount: exportData.assets.length
			},
			items: exportData.items.map((m) => {
				return {
					name: m.system.name,
					codename: m.system.codename,
					language: m.system.language
				};
			}),
			assets: exportData.assets.map((m) => {
				return {
					codename: m.codename ?? 'n/a',
					filename: m.filename
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

		await this.importDataAsync(exportData);

		return {
			logRecord: logsRecord,
			overviewLogFileUrl: overviewLogFile.absoluteUrl,
			logFileUrl: logFile.absoluteUrl
		};
	}

	private async importDataAsync(data: IExportAdapterResult): Promise<void> {
		const importToolkit = new ImportToolkit({
			log: this.migrationToolkitLog,
			environmentId: this.config.targetEnvironmentId,
			managementApiKey: this.config.targetMapiKey,
			skipFailedItems: false,
			sourceType: 'file',
			canImport: {
				asset: (item) => true,
				contentItem: (item) => true
			}
		});

		await importToolkit.importAsync(data);
	}

	private async getExportDataAsync(config: IKontentAiMigrateContentConfig): Promise<IExportAdapterResult> {
		const deliveryClient = createDeliveryClient({
			environmentId: this.config.sourceEnvironmentId
		});

		if (config.limit && config.limit > this.deliveryItemsLimit) {
			throw Error(
				`Current limit for migration is set to '${this.deliveryItemsLimit}'. Your value is '${config.limit}'. Please use a smaller value.`
			);
		}

		let query = deliveryClient
			.items()
			.depthParameter(0)
			.orderByDescending('system.last_modified')
			.limitParameter(
				config.limit && config.limit < this.deliveryItemsLimit ? config.limit : this.deliveryItemsLimit
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

		const adapter = new KontentAiExportAdapter({
			environmentId: this.config.sourceEnvironmentId,
			managementApiKey: this.config.sourceMapiKey,
			exportItems: exportItems,
			log: this.migrationToolkitLog
		});

		const data = adapter.exportAsync();

		return data;
	}
}
