import {merge, Observable, Subject, takeUntil, catchError, of, EMPTY, from} from "rxjs";
import {mergeMap, tap} from "rxjs/operators";
import * as path from 'path';
import * as fs from 'fs/promises';
import {glob} from 'glob';
import { OutboxSingleton } from './workers/outbox-singleton';

interface TickerEvent {
	tab: string;
	timestamp: string;
	message: string;
	tick: number;
}

interface WorkerModule {
	default?: Observable<any>;
	[key: string]: any;
}

// Cache for loaded worker modules to avoid re-importing
const workerCache = new Map<string, Observable<any>[]>();

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
					// Wrap each ticker with error handling to prevent stream breaking
					const safeObservable = (value as Observable<any>).pipe(
						catchError((error) => {
							console.error(`Error in ticker ${key} from ${file}:`, error);
							// Return empty to continue the stream
							return EMPTY;
						})
					);
					observables.push(safeObservable);
					console.log(`Loaded ticker observable: ${key} from ${file}`);
				}
			}
		} catch (error) {
			console.error(`Failed to load ticker from ${file}:`, error);
		}
	}

	return observables;
}

async function loadWorkersForCrontab(crontab: string): Promise<Observable<any>[]> {
	// Check cache first
	if (workerCache.has(crontab)) {
		return workerCache.get(crontab)!;
	}

	const observables: Observable<any>[] = [];
	const workerDir = path.join('src', 'workers', crontab);

	try {
		// Check if directory exists
		await fs.access(workerDir);

		// Find all worker files in this crontab directory
		const workerFiles = await glob(`${workerDir}/*.worker.ts`);

		for (const file of workerFiles) {
			try {
				const absolutePath = path.resolve(file);
				const workerModule: WorkerModule = await import(absolutePath);

				// Look for default export or any observable exports
				if (workerModule.default && typeof workerModule.default === 'object' && 'subscribe' in workerModule.default) {
					observables.push(workerModule.default);
					console.log(`Loaded worker: ${path.basename(file)} for crontab: ${crontab}`);
				} else {
					// Check for named exports that are observables
					for (const [key, value] of Object.entries(workerModule)) {
						if (value && typeof value === 'object' && 'subscribe' in value) {
							observables.push(value as Observable<any>);
							console.log(`Loaded worker export '${key}' from ${path.basename(file)} for crontab: ${crontab}`);
						}
					}
				}
			} catch (error) {
				console.error(`Failed to load worker from ${file}:`, error);
			}
		}

		// Cache the loaded workers
		workerCache.set(crontab, observables);
	} catch (error) {
		// Directory doesn't exist or can't be accessed
		console.debug(`No workers directory found for crontab: ${crontab}`);
	}

	return observables;
}

async function executeWorkers(tickerEvent: TickerEvent): Promise<void> {
	const { tab, timestamp, message } = tickerEvent;
	console.log(`\nExecuting workers for crontab '${tab}' at ${timestamp}`);

	const workers = await loadWorkersForCrontab(tab);

	if (workers.length === 0) {
		console.log(`No workers found for crontab: ${tab}`);
		return;
	}

	console.log(`Found ${workers.length} worker(s) for crontab: ${tab}`);

	// Execute all workers for this crontab, with error handling for each
	for (const worker of workers) {
		worker.pipe(
			catchError((error) => {
				console.error(`Error in worker for crontab '${tab}':`, error);
				// Return empty to continue with other workers
				return EMPTY;
			})
		).subscribe({
			next: (value) => {
				console.log(`Worker output [${tab}]:`, value);
			},
			error: (error) => {
				console.error(`Worker subscription error [${tab}]:`, error);
			}
		});
	}
}

/**
 * Initialize required services
 */
async function initializeServices(): Promise<void> {
	try {
		await OutboxSingleton.initialize();
		console.log('Outbox singleton initialized');
	} catch (error) {
		console.error('Failed to initialize Outbox singleton:', error);
		throw error;
	}
}

/**
 * Cleanup services on shutdown
 */
async function cleanupServices(): Promise<void> {
	try {
		await OutboxSingleton.destroy();
		console.log('Outbox singleton destroyed');
	} catch (error) {
		console.error('Error destroying Outbox singleton:', error);
	}
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(shutdown$: Subject<void>): void {
	const handleShutdown = async (signal: string) => {
		console.log(`\nReceived ${signal}, shutting down gracefully...`);
		await cleanupServices();
		shutdown$.next();
		shutdown$.complete();
	};

	process.on('SIGINT', () => handleShutdown('SIGINT'));
	process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

/**
 * Create the main ticker stream with all observables
 */
function createTickerStream(
	tickerObservables: Observable<any>[],
	shutdown$: Subject<void>
): Observable<any> {
	return merge(...tickerObservables).pipe(
		takeUntil(shutdown$),
		tap((event: TickerEvent) => {
			console.log('Ticker event received:', event);
		}),
		mergeMap((event: TickerEvent) =>
			from(executeWorkers(event).catch(error => {
				console.error('Error executing workers:', error);
			}))
		),
		catchError((error) => {
			console.error('Stream error (recovered):', error);
			return EMPTY; // Keep the stream alive
		})
	);
}

/**
 * Subscribe to the ticker stream and handle lifecycle events
 */
function subscribeToTickerStream(tickerStream: Observable<any>): void {
	tickerStream.subscribe({
		next: () => {
			// Worker execution happens in the mergeMap
		},
		error: (error) => {
			console.error('Fatal ticker error:', error);
			process.exit(1);
		},
		complete: () => {
			console.log('All tickers completed, exiting...');
			process.exit(0);
		}
	});
}

/**
 * Main worker startup function
 */
async function startWorker() {
	console.log('Starting worker...');

	try {
		// Initialize services
		await initializeServices();

		// Setup shutdown handling
		const shutdown$ = new Subject<void>();
		setupShutdownHandlers(shutdown$);

		// Load ticker observables
		const tickerObservables = await loadTickerObservables();

		if (tickerObservables.length === 0) {
			console.log('No ticker observables found');
			return;
		}

		console.log(`Found ${tickerObservables.length} ticker observable(s)`);

		// Create and subscribe to the ticker stream
		const tickerStream = createTickerStream(tickerObservables, shutdown$);
		subscribeToTickerStream(tickerStream);

		console.log('Worker started successfully');
		console.log('Waiting for ticker events...\n');
	} catch (error) {
		console.error('Failed to start worker:', error);
		process.exit(1);
	}
}

// Start the worker
startWorker();

