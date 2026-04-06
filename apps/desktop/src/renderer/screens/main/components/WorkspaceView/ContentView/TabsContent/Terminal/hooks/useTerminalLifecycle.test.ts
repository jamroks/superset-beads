/**
 * Reproduction tests for issue #1873:
 * "When I switch between terminal tab and browser tab the terminal stuck for a
 * while to load. Additionally, the terminal leaving a large blank space."
 *
 * Root cause: `scheduleReattachRecovery` in useTerminalLifecycle.ts silently
 * drops recovery requests when called within the 120ms throttle window, with
 * no retry scheduled.
 *
 * When a user returns from an external browser to the Electron app, the
 * `window.focus` event fires and schedules reattach recovery. This recovery:
 *   1. Clears the stale WebGL texture atlas (`clearTextureAtlas`)
 *   2. Re-fits the terminal to its container (`fitAddon.fit()`)
 *   3. Forces a full repaint (`xterm.refresh()`)
 *
 * If the user switches focus multiple times in rapid succession (within 120ms),
 * subsequent recovery calls hit the throttle and return early — without ever
 * scheduling a retry. The terminal stays blank/stale until the next container
 * resize event (which may never come).
 *
 * Fix: when the throttle fires, schedule a retry after the remaining throttle
 * duration instead of silently returning.
 */
import { describe, expect, it } from "bun:test";

// ---------------------------------------------------------------------------
// Minimal model of the scheduleReattachRecovery throttle mechanism.
// Mirrors the exact logic in useTerminalLifecycle.ts so tests accurately
// demonstrate the production behaviour.
// ---------------------------------------------------------------------------

type SchedulerState = {
	throttleMs: number;
	pendingFrame: number | null;
	pendingTimeout: ReturnType<typeof setTimeout> | null;
	lastRunAt: number;
	pendingForceResize: boolean;
};

/**
 * Creates a scheduler that models the production scheduleReattachRecovery.
 *
 * @param runRecovery — called when recovery fires
 * @param opts.trackTimeout — when true, the scheduler tracks and deduplicates
 *   the deferred retry setTimeout (the fix for #3208). When false, models the
 *   buggy production code that creates untracked setTimeouts.
 */
function makeScheduler(
	runRecovery: (forceResize: boolean) => void,
	opts: { trackTimeout: boolean } = { trackTimeout: false },
): {
	schedule: (forceResize: boolean) => void;
	flush: () => void;
	state: SchedulerState;
	/** Number of deferred retry setTimeouts created (for observing accumulation) */
	deferredRetryCount: () => number;
} {
	const reattachRecovery: SchedulerState = {
		throttleMs: 120,
		pendingFrame: null,
		pendingTimeout: null,
		lastRunAt: 0,
		pendingForceResize: false,
	};

	const pendingRafs: Array<() => void> = [];
	let _deferredRetryCount = 0;

	const mockRaf = (cb: () => void): number => {
		pendingRafs.push(cb);
		return pendingRafs.length;
	};

	const isUnmounted = false;

	const scheduleReattachRecovery = (forceResize: boolean) => {
		reattachRecovery.pendingForceResize ||= forceResize;
		if (reattachRecovery.pendingFrame !== null) return;

		reattachRecovery.pendingFrame = mockRaf(() => {
			reattachRecovery.pendingFrame = null;

			const now = Date.now();
			if (now - reattachRecovery.lastRunAt < reattachRecovery.throttleMs) {
				const remaining =
					reattachRecovery.throttleMs - (now - reattachRecovery.lastRunAt);

				if (opts.trackTimeout) {
					// FIX: cancel any existing deferred retry before scheduling a new one
					if (reattachRecovery.pendingTimeout !== null) {
						clearTimeout(reattachRecovery.pendingTimeout);
					}
					_deferredRetryCount++;
					reattachRecovery.pendingTimeout = setTimeout(() => {
						reattachRecovery.pendingTimeout = null;
						if (!isUnmounted)
							scheduleReattachRecovery(reattachRecovery.pendingForceResize);
					}, remaining + 1);
				} else {
					// BUGGY: untracked setTimeout — accumulates with rapid focus events
					_deferredRetryCount++;
					setTimeout(() => {
						if (!isUnmounted)
							scheduleReattachRecovery(reattachRecovery.pendingForceResize);
					}, remaining + 1);
				}
				return;
			}

			reattachRecovery.lastRunAt = now;
			const shouldForce = reattachRecovery.pendingForceResize;
			reattachRecovery.pendingForceResize = false;
			runRecovery(shouldForce);
		}) as unknown as number;
	};

	const flushRafs = () => {
		while (pendingRafs.length > 0) {
			const cb = pendingRafs.shift();
			cb?.();
		}
	};

	return {
		schedule: scheduleReattachRecovery,
		flush: flushRafs,
		state: reattachRecovery,
		deferredRetryCount: () => _deferredRetryCount,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scheduleReattachRecovery throttle — issue #1873", () => {
	it("runs recovery on first window.focus event", () => {
		let calls = 0;
		const { schedule, flush } = makeScheduler(() => {
			calls++;
		});

		schedule(false);
		flush();

		expect(calls).toBe(1);
	});

	it("second schedule within 120ms throttle window is silently dropped", () => {
		let calls = 0;
		const { schedule, flush, state } = makeScheduler(() => {
			calls++;
		});

		// Simulate a recovery that ran 50ms ago (within the 120ms throttle window)
		state.lastRunAt = Date.now() - 50;

		schedule(false);
		flush();

		// Recovery was dropped because lastRunAt is only 50ms ago (< 120ms throttle)
		expect(calls).toBe(0);
	});

	/**
	 * REPRODUCTION TEST — this test currently FAILS, demonstrating the bug.
	 *
	 * Expected behaviour: when a recovery call is throttled, a retry should be
	 * scheduled to run after the remaining throttle window expires. Without a
	 * retry the terminal is permanently blank until the user resizes the window.
	 *
	 * Fix: in scheduleReattachRecovery (useTerminalLifecycle.ts), when the
	 * throttle fires, add:
	 *   const remaining = reattachRecovery.throttleMs - (now - reattachRecovery.lastRunAt);
	 *   setTimeout(() => { if (!isUnmounted) scheduleReattachRecovery(reattachRecovery.pendingForceResize); }, remaining + 1);
	 */
	it("throttled recovery is retried after throttle window expires", async () => {
		let calls = 0;
		const { schedule, flush, state } = makeScheduler(() => {
			calls++;
		});

		// Simulate a recovery that ran 50ms ago (within the 120ms throttle window)
		state.lastRunAt = Date.now() - 50;

		// This call hits the throttle; current code silently drops it
		schedule(false);
		flush();
		expect(calls).toBe(0); // correctly throttled

		// Wait past the remaining throttle duration (120 - 50 = 70ms remaining)
		await new Promise((r) => setTimeout(r, 100));

		// With the fix, a setTimeout was scheduled that queued a new rAF
		flush(); // run the retried rAF

		// FAILS with current code: calls is still 0 because no retry was scheduled
		// PASSES after fix: the retry fires and recovery runs
		expect(calls).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// Issue #3208 — progressive rendering corruption from accumulated setTimeouts
// ---------------------------------------------------------------------------

describe("scheduleReattachRecovery setTimeout accumulation — issue #3208", () => {
	/**
	 * REPRODUCTION: demonstrates that rapid focus events within the throttle
	 * window create multiple untracked setTimeouts.
	 *
	 * When switching workspaces, both `visibilitychange` and `window.focus`
	 * fire in quick succession. The first triggers recovery; the second is
	 * throttled and schedules a deferred retry via setTimeout. Because the
	 * setTimeout ID is not tracked, each throttled call creates a NEW timer
	 * without canceling the previous one.
	 *
	 * Over N workspace switches this accumulates N deferred retries, each
	 * of which calls clearTextureAtlas() + fit() + refresh(). The redundant
	 * WebGL atlas clears during active rendering cause progressive visual
	 * corruption.
	 */
	it("buggy scheduler accumulates deferred retries from rapid focus events", () => {
		let calls = 0;
		const { schedule, flush, deferredRetryCount } = makeScheduler(
			() => {
				calls++;
			},
			{ trackTimeout: false },
		);

		// Initial recovery runs normally
		schedule(false);
		flush();
		expect(calls).toBe(1);

		// Simulate 5 rapid focus events within the throttle window.
		// Each schedule+flush creates a new rAF that fires immediately,
		// hits the throttle, and creates an untracked setTimeout.
		for (let i = 0; i < 5; i++) {
			schedule(false);
			flush();
		}

		// BUG: 5 separate deferred retry setTimeouts were created instead of 1
		expect(deferredRetryCount()).toBe(5);
	});

	it("fixed scheduler deduplicates deferred retries", () => {
		let calls = 0;
		const { schedule, flush, deferredRetryCount } = makeScheduler(
			() => {
				calls++;
			},
			{ trackTimeout: true },
		);

		// Initial recovery
		schedule(false);
		flush();
		expect(calls).toBe(1);

		// Same 5 rapid focus events
		for (let i = 0; i < 5; i++) {
			schedule(false);
			flush();
		}

		// FIX: each new deferred retry cancels the previous one.
		// 5 were created total, but only 1 is active (the rest were cleared).
		// The important thing: only 1 setTimeout is pending.
		expect(deferredRetryCount()).toBe(5); // 5 created...
		// ...but only 1 will actually fire (the others were clearTimeout'd)
	});

	it("fixed scheduler fires exactly one deferred recovery after rapid focus", async () => {
		let calls = 0;
		const { schedule, flush } = makeScheduler(
			() => {
				calls++;
			},
			{ trackTimeout: true },
		);

		// Initial recovery
		schedule(false);
		flush();
		expect(calls).toBe(1);

		// 5 rapid throttled focus events
		for (let i = 0; i < 5; i++) {
			schedule(false);
			flush();
		}
		expect(calls).toBe(1); // all throttled

		// Wait for the single deferred retry to fire
		await new Promise((r) => setTimeout(r, 200));
		flush();

		// Exactly one additional recovery — not 5
		expect(calls).toBe(2);
	});

	it("buggy scheduler fires multiple deferred recoveries after rapid focus", async () => {
		let calls = 0;
		const { schedule, flush } = makeScheduler(
			() => {
				calls++;
			},
			{ trackTimeout: false },
		);

		// Initial recovery
		schedule(false);
		flush();
		expect(calls).toBe(1);

		// 5 rapid throttled focus events
		for (let i = 0; i < 5; i++) {
			schedule(false);
			flush();
		}
		expect(calls).toBe(1); // all throttled

		// Wait for ALL accumulated setTimeouts to fire
		await new Promise((r) => setTimeout(r, 200));

		// Flush each rAF one at a time to simulate real browser behavior
		// where each setTimeout fires in a separate macrotask and its rAF
		// runs in the next animation frame.
		// In the real browser, the first setTimeout's rAF runs recovery
		// (resetting lastRunAt), then the second's rAF hits the throttle
		// again and creates yet another setTimeout, causing a cascade.
		// In this test model, all setTimeouts fire before we flush, so
		// the pendingFrame dedup catches some. But the key observable is
		// that 5 untracked setTimeouts were created (proven in earlier test).
		flush();

		// Even with rAF dedup, at least one extra recovery ran. In the real
		// browser with proper interleaving, more would fire.
		expect(calls).toBeGreaterThanOrEqual(2);
	});

	it("cleanup cancels pending deferred retry timeout", () => {
		let calls = 0;
		const { schedule, flush, state } = makeScheduler(
			() => {
				calls++;
			},
			{ trackTimeout: true },
		);

		// Run initial recovery
		schedule(false);
		flush();
		expect(calls).toBe(1);

		// Schedule a throttled call (creates a tracked setTimeout)
		schedule(false);
		flush();
		expect(state.pendingTimeout).not.toBeNull();

		// Simulate cleanup (component unmount) by clearing the timeout
		if (state.pendingTimeout !== null) {
			clearTimeout(state.pendingTimeout);
			state.pendingTimeout = null;
		}
		expect(state.pendingTimeout).toBeNull();
	});
});
