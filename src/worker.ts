import {merge, Observable, Subject, takeUntil} from "rxjs";
import * as path from 'path';
import {glob} from 'glob';

async function loadTickerObservables(): Promise<Observable<any>[]> {
	const tickerFiles = await glob('src/**/*.ticker.ts');
	const observables: Observable<any>[] = [];

	for (const file of tickerFiles) {
		try {
			const absolutePath = path.resolve(file);
			const tickerModule = await import(absolutePath);

			// Look for exported observables (assuming they end with 'Ticker')
			for (const [key, value] of Object.entries(tickerModule)) {
				if (key.endsWith('Ticker') && value && typeof value === 'object' && 'subscribe' in value) {
					observables.push(value as Observable<any>);
					console.log(`Loaded ticker observable: ${key} from ${file}`);
				}
			}
		} catch (error) {
			console.error(`Failed to load ticker from ${file}:`, error);
		}
	}

	return observables;
}

async function startWorker() {
	console.log('Starting worker...');

	// Create a subject to handle shutdown signal
	const shutdown$ = new Subject<void>();

	// Handle SIGINT (Ctrl+C) gracefully
	process.on('SIGINT', () => {
		console.log('\nReceived SIGINT, shutting down gracefully...');
		shutdown$.next();
		shutdown$.complete();
	});

	try {
		const tickerObservables = await loadTickerObservables();

		if (tickerObservables.length === 0) {
			console.log('No ticker observables found');
			return;
		}

		console.log(`Found ${tickerObservables.length} ticker observable(s)`);

		// Merge all observables into one and complete on SIGINT
		const combinedTicker = merge(...tickerObservables).pipe(
			takeUntil(shutdown$)
		);

		combinedTicker.subscribe({
			next: (value) => {
				console.log('Ticker event:', value);
			},
			error: (error) => {
				console.error('Ticker error:', error);
				process.exit(1);
			},
			complete: () => {
				console.log('All tickers completed, exiting...');
				process.exit(0);
			}
		});

		console.log('Worker started successfully');
	} catch (error) {
		console.error('Failed to start worker:', error);
		process.exit(1);
	}
}

// Start the worker
startWorker();

