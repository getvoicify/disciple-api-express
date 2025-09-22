import {map, timer} from "rxjs";

export const everyMinuteTickerTab = '* * * * *'

export const everyMinuteTicker = timer(0, 60 * 1000).pipe(
	map((tick) => ({
		timestamp: new Date().toISOString(),
		message: 'Every minute ticker ticked',
		tab: everyMinuteTickerTab,
		tick,
	})),
);
