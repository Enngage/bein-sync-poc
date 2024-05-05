import {
	ExportToolkit,
	IExportAdapterResult,
	IKontentAiExportRequestItem,
	ImportService,
	ImportToolkit,
	KontentAiExportAdapter,
	Log
} from '@kontent-ai-consulting/migration-toolkit';
import Colors from 'colors';
import { IConsoleLog } from '../../models/common/common.models.js';
import { BlobStorageService } from '../blob-storage/index.js';
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

export interface IKontentAiMigrateContentConfig {
	contentTypeCodenameToExport?: string;
	limit?: number;
}

export class KontentAiMigrationService {
	private readonly migrationToolkitLog: Log = {
		console: (data) =>
			this.config.log.information(`${Colors.yellow(`Migration Log: `)} ${Colors.white(data.message)}`)
	};

	constructor(private config: IKontentAiMigrationServiceConfig) {}

	async migrateContentAsync(config: IKontentAiMigrateContentConfig): Promise<void> {
		this.config.log.information(`Kontent ai project: ${this.config.sourceEnvironmentId}`);
		this.config.log.information(`Using preview: ${this.config.usePreview}`);
		this.config.log.information(`Blob account: ${this.config.accountName}`);

		const blobStorageService = new BlobStorageService({
			accountKey: this.config.accountKey,
			accountName: this.config.accountName,
			log: this.config.log
		});

		const exportData = await this.getExportDataAsync(config);
		console.log('items: ', exportData.items.length);
		console.log('assets: ', exportData.assets.length);

		await this.importDataAsync(config, exportData);
	}

	private async importDataAsync(config: IKontentAiMigrateContentConfig, data: IExportAdapterResult): Promise<void> {
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

		let query = deliveryClient.itemsFeed().orderByDescending('system.last_modified');

		if (config.contentTypeCodenameToExport) {
			query = query.type(config.contentTypeCodenameToExport);
		}

		if (config.limit) {
			query = query.limitParameter(config.limit);
		}

		const itemsToExport = await query.toAllPromise();

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
