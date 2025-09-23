import {interval, map} from "rxjs";

export const everyMinuteTickerTab = '* * * * *'

export const everyMinuteTicker = interval(60 * 1000).pipe(
	map((tick) => ({
		timestamp: new Date().toISOString(),
		message: 'Every minute ticker ticked',
		tab: everyMinuteTickerTab,
		tick,
	})),
);
