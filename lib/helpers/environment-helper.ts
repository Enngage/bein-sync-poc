export class EnvironmentHelper {
	getRequiredValue(variableName: string): string {
		let value = this.getOptionalValue(variableName);

		if (!value) {
			throw Error(`Missing environment variable '${variableName}'`);
		}

		return value;
	}

	getOptionalValue(variableName: string): string | undefined {
		// get value from environment variables first
		let value = process.env[variableName];

		if (!value) {
			return undefined;
		}

		return value;
	}
}

export const environmentHelper = new EnvironmentHelper();
