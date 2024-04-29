import { createDeliveryClient, IDeliveryClient } from '@kontent-ai/delivery-sdk';
import { IConsoleLog } from '../../models/common/common.models.js';

export interface IKontentAiServiceConfig {
	environmentId: string;
	secureApiKey: string;
	previewApiKey: string;
	log: IConsoleLog;
}

export class KontentAiService {
	private readonly deliveryClient: IDeliveryClient;

	constructor(public config: IKontentAiServiceConfig) {
		this.deliveryClient = createDeliveryClient({
			environmentId: config.environmentId,
			secureApiKey: config.secureApiKey,
			previewApiKey: config.previewApiKey
		});
	}

	async isNewContentAvailableAsync(data: {
		isPreview: boolean;
		handleSync: (newContentAvailable: boolean) => Promise<void>;
		storeAccessTokenAsync: (token: string) => Promise<void>;
		fetchAccessTokenAsync: () => Promise<string | undefined>;
	}): Promise<void> {
		const latestAccessToken: string | undefined = await data.fetchAccessTokenAsync();

		if (!latestAccessToken) {
			// init synchronization
			const initResponse = await this.deliveryClient
				.initializeSync()
				.queryConfig({
					usePreviewMode: data.isPreview,
					useSecuredMode: !data.isPreview
				})
				.toPromise();
			const initToken: string | undefined = initResponse.xContinuationToken;

			if (!initToken) {
				throw Error(`Invalid continuation token fetched from initialization sync`);
			}

			// store token
			await data.storeAccessTokenAsync(initToken);

			// sync on initialization
			await data.handleSync(true);

			return;
		}

		// get delta updates
		const deltaUpdatesResponse = await this.deliveryClient
			.syncChanges()
			.queryConfig({
				usePreviewMode: data.isPreview,
				useSecuredMode: !data.isPreview
			})
			.withContinuationToken(latestAccessToken)
			.toPromise();

		if (deltaUpdatesResponse.xContinuationToken && deltaUpdatesResponse.xContinuationToken !== latestAccessToken) {
			// store new token
			await data.storeAccessTokenAsync(deltaUpdatesResponse.xContinuationToken);
		}

		if (deltaUpdatesResponse.data.items.length) {
			// at least 1 item was changed
			await data.handleSync(true);
		} else {
			await data.handleSync(false);
		}
	}
}
