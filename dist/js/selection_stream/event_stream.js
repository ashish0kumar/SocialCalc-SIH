/**
 * Stateless sequence of events that can be processed by consumers.
 *
 * There are three kind of consumers:
 * - the main consumer
 * - the default consumer
 * - observer consumers
 *
 * Main consumer
 * -------------
 * Anyone can capture the event stream and become the main consumer.
 * If there is already a main consumer, it is kicked off and it will no longer
 * receive events.
 * The main consumer can release the stream at any moment to stop listening
 * events.
 *
 * Default consumer
 * ----------------
 * When the main consumer releases the stream and until the stream is captured
 * again, all events are transmitted to the default consumer.
 *
 * Observer consumers
 * ------------------
 * Observers permanently receive events.
 *
 */
export class EventStream {
    constructor() {
        this.observers = [];
    }
    registerAsDefault(owner, callbacks) {
        this.defaultSubscription = { owner, callbacks };
        if (!this.mainSubscription) {
            this.mainSubscription = this.defaultSubscription;
        }
    }
    /**
     * Register callbacks to observe the steam
     */
    observe(owner, callbacks) {
        this.observers.push({ owner, callbacks });
    }
    /**
     * Capture the stream for yourself
     */
    capture(owner, callbacks) {
        var _a, _b, _c;
        if (this.observers.find((sub) => sub.owner === owner)) {
            throw new Error("You are already subscribed forever");
        }
        if ((_a = this.mainSubscription) === null || _a === void 0 ? void 0 : _a.owner) {
            (_c = (_b = this.mainSubscription.callbacks).release) === null || _c === void 0 ? void 0 : _c.call(_b);
        }
        this.mainSubscription = { owner, callbacks };
    }
    release(owner) {
        var _a, _b, _c, _d;
        if (((_a = this.mainSubscription) === null || _a === void 0 ? void 0 : _a.owner) !== owner ||
            this.observers.find((sub) => sub.owner === owner)) {
            return;
        }
        (_d = (_b = this.mainSubscription) === null || _b === void 0 ? void 0 : (_c = _b.callbacks).release) === null || _d === void 0 ? void 0 : _d.call(_c);
        this.mainSubscription = this.defaultSubscription;
    }
    /**
     * Check if you are currently the main stream consumer
     */
    isListening(owner) {
        var _a;
        return ((_a = this.mainSubscription) === null || _a === void 0 ? void 0 : _a.owner) === owner;
    }
    /**
     * Push an event to the stream and broadcast it to consumers
     */
    send(event) {
        var _a;
        (_a = this.mainSubscription) === null || _a === void 0 ? void 0 : _a.callbacks.handleEvent(event);
        [...this.observers].forEach((sub) => sub.callbacks.handleEvent(event));
    }
}
//# sourceMappingURL=event_stream.js.map