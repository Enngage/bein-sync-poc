import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { IConsoleLog } from '../../models/common/common.models.js';

export interface IBlobStorageUploadResponse {
	absoluteUrl: string;
	filename: string;
}

export interface IBlobStorageServiceConfig {
	log: IConsoleLog;
	accountName: string;
	accountKey: string;
}

export interface ILogsRecord {
	date: Date;
	overview: {
		migratedItemsCount: number;
		migratedAssetsCount: number;
	};
	items: { name: string; codename: string; language: string }[];
	assets: { codename: string; filename: string }[];
}

export type OverviewLogRecord = Omit<ILogsRecord, 'items' | 'assets'>;

export type BlobStorageContainer = 'migration-logs';

export class BlobStorageService {
	private readonly serviceClient: BlobServiceClient;

	constructor(private config: IBlobStorageServiceConfig) {
		this.serviceClient = new BlobServiceClient(
			`https://${config.accountName}.blob.core.windows.net`,
			new StorageSharedKeyCredential(config.accountName, config.accountKey)
		);
	}

	async storeOverviewLogFileAsync(data: { record: ILogsRecord }): Promise<IBlobStorageUploadResponse> {
		const filename: string = this.getOverviewLogFilename();
		const recordToStore: OverviewLogRecord = {
			date: data.record.date,
			overview: data.record.overview
		};
		const records: OverviewLogRecord[] = [recordToStore];

		const existingFile = await this.fetchOverviewLogFileAsync();

		if (existingFile) {
			records.push(...JSON.parse(existingFile));
		}

		return await this.storeFileAsync({
			content: JSON.stringify(records),
			filename: filename,
			containerName: 'migration-logs'
		});
	}

	async storeLogFileAsync(data: { record: ILogsRecord }): Promise<IBlobStorageUploadResponse> {
		const filename: string = this.getLogFilename(data.record.date);

		return await this.storeFileAsync({
			content: JSON.stringify(data.record),
			filename: filename,
			containerName: 'migration-logs'
		});
	}

	async fetchOverviewLogFileAsync(): Promise<string | undefined> {
		const filename: string = this.getOverviewLogFilename();
		return await this.fetchFileAsync('migration-logs', filename);
	}

	private async storeFileAsync(data: {
		filename: string;
		content: string;
		containerName: BlobStorageContainer;
	}): Promise<IBlobStorageUploadResponse> {
		const containerClient = await this.getContainerClientAsync(data.containerName);
		const blockBlobClient = containerClient.getBlockBlobClient(data.filename);

		this.config.log.information(`Uploading '${data.filename}'`);
		await blockBlobClient.upload(data.content, data.content.length);
		this.config.log.information(`Upload successful`);

		return {
			absoluteUrl: blockBlobClient.url,
			filename: blockBlobClient.name
		};
	}

	private async fetchFileAsync(containerName: BlobStorageContainer, filename: string): Promise<string | undefined> {
		const containerClient = await this.getContainerClientAsync(containerName);
		const blockBlobClient = containerClient.getBlockBlobClient(filename);
		const blobExists = await blockBlobClient.exists();

		if (!blobExists) {
			this.config.log.information(`File with name '${filename}' does not yet exist`);
			return undefined;
		}

		this.config.log.information(`Downloading file '${filename}'`);
		const downloadBlockBlobResponse = await blockBlobClient.download();
		const content: string = (await this.streamToBuffer(downloadBlockBlobResponse.readableStreamBody)).toString();

		this.config.log.information(`Download successful.`);

		return content;
	}

	private async getContainerClientAsync(containerName: BlobStorageContainer): Promise<ContainerClient> {
		const containerClient = this.serviceClient.getContainerClient(containerName);
		await containerClient.createIfNotExists();

		return containerClient;
	}

	private getOverviewLogFilename(): string {
		return `logs.json`;
	}

	private getLogFilename(date: Date): string {
		return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDay()}-${date.getUTCHours()}-${date.getUTCMinutes()}-${date.getUTCSeconds()}.json`;
	}

	// [Node.js only] A helper method used to read a Node.js readable stream into a Buffer
	// source: https://www.npmjs.com/package/@azure/storage-blob#download-a-blob-and-convert-it-to-a-string-nodejs
	private async streamToBuffer(readableStream: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const chunks: any = [];
			readableStream.on('data', (data: any) => {
				chunks.push(data instanceof Buffer ? data : Buffer.from(data));
			});
			readableStream.on('end', () => {
				resolve(Buffer.concat(chunks));
			});
			readableStream.on('error', reject);
		});
	}
}
