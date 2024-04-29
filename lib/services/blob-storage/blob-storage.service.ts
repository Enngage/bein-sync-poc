import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { IConsoleLog, LearnPortalProjectType } from '../../models/common/common.models.js';

export interface IBlobStorageUploadResponse {
	absoluteUrl: string;
	filename: string;
}

export interface IBlobStorageServiceConfig {
	log: IConsoleLog;
	accountName: string;
	accountKey: string;
}

export type ContinuationTokenType = 'newContentAvailable';
export type BlobStorageContainer = 'sync-tokens' | 'migration-logs';

export class BlobStorageService {
	private readonly serviceClient: BlobServiceClient;

	constructor(private config: IBlobStorageServiceConfig) {
		this.serviceClient = new BlobServiceClient(
			`https://${config.accountName}.blob.core.windows.net`,
			new StorageSharedKeyCredential(config.accountName, config.accountKey)
		);
	}

	async storeContinuationTokenAsync(data: {
		token: string;
		tokenType: ContinuationTokenType;
		projectType: LearnPortalProjectType;
		projectId: string;
	}): Promise<IBlobStorageUploadResponse> {
		const filename: string = this.getContinuationTokenFilename(data.projectType, data.tokenType, data.projectId);

		return await this.storeFileAsync({
			content: data.token,
			filename: filename,
			containerName: 'sync-tokens'
		});
	}

	async fetchContinuationTokenAsync(
		tokenType: ContinuationTokenType,
		projectType: LearnPortalProjectType,
		projectId: string
	): Promise<string | undefined> {
		const filename: string = this.getContinuationTokenFilename(projectType, tokenType, projectId);
		return await this.fetchFileAsync('sync-tokens', filename);
	}

	private async storeFileAsync(data: {
		filename: string;
		content: string;
		containerName: BlobStorageContainer;
	}): Promise<IBlobStorageUploadResponse> {
		const containerClient = await this.getContainerClientAsync(data.containerName);
		const blockBlobClient = containerClient.getBlockBlobClient(data.filename);

		this.config.log.information(`Uploading '${data.filename}' with content '${data.content}'`);
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

		this.config.log.information(`Download successful. Content: '${content}'`);

		return content;
	}

	private async getContainerClientAsync(containerName: BlobStorageContainer): Promise<ContainerClient> {
		const containerClient = this.serviceClient.getContainerClient(containerName);
		await containerClient.createIfNotExists();

		return containerClient;
	}

	private getContinuationTokenFilename(
		projectType: LearnPortalProjectType,
		tokenType: ContinuationTokenType,
		projectId: string
	): string {
		return `x-continuation-token-${projectType}-${tokenType}-${projectId}.txt`;
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
