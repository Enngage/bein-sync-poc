import {
	ExportToolkit,
	IExportAdapterResult,
	ImportService,
	ImportToolkit,
	KontentAiExportAdapter,
	Log
} from '@kontent-ai-consulting/migration-toolkit';
import Colors from 'colors';
import { IConsoleLog } from '../../models/common/common.models.js';
import { BlobStorageService } from '../blob-storage/index.js';

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
	contentTypeCodenameToExport: string;
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
		const adapter = new KontentAiExportAdapter({
			environmentId: this.config.sourceEnvironmentId,
			managementApiKey: this.config.sourceMapiKey,
			isPreview: false,
			isSecure: false,
			// customize what items are exported
			customItemsExport: async (client) => {
				// return only the items you want to export by applying filters, parameters etc..
				const response = await client.items().type(config.contentTypeCodenameToExport).toAllPromise();
				return response.data.items;
			},
			log: this.migrationToolkitLog
		});

		const data = adapter.exportAsync();

		return data;
	}
}
