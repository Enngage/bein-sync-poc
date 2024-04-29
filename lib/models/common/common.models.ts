export interface IConsoleLog {
	error: (message: any) => void;
	information: (message: any) => void;
}

export type LearnPortalProjectType = 'preview' | 'published';
