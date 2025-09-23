import {of, tap} from "rxjs";

export const processOutboxWorker$ = of([]).pipe(
	tap(() => {
		console.log('Processing outbox...');
	}),
);
