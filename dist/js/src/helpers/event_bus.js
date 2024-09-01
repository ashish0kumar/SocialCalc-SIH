/**
 * This is a generic event bus based on the Owl event bus.
 * This bus however ensures type safety across events and subscription callbacks.
 */
export class EventBus {
    constructor() {
        this.subscriptions = {};
    }
    /**
     * Add a listener for the 'eventType' events.
     *
     * Note that the 'owner' of this event can be anything, but will more likely
     * be a component or a class. The idea is that the callback will be called with
     * the proper owner bound.
     *
     * Also, the owner should be kind of unique. This will be used to remove the
     * listener.
     */
    on(type, owner, callback) {
        if (!callback) {
            throw new Error("Missing callback");
        }
        if (!this.subscriptions[type]) {
            this.subscriptions[type] = [];
        }
        this.subscriptions[type].push({
            owner,
            callback,
        });
    }
    /**
     * Emit an event of type 'eventType'.  Any extra arguments will be passed to
     * the listeners callback.
     */
    trigger(type, payload) {
        const subs = this.subscriptions[type] || [];
        for (let i = 0, iLen = subs.length; i < iLen; i++) {
            const sub = subs[i];
            sub.callback.call(sub.owner, payload);
        }
    }
    /**
     * Remove a listener
     */
    off(eventType, owner) {
        const subs = this.subscriptions[eventType];
        if (subs) {
            this.subscriptions[eventType] = subs.filter((s) => s.owner !== owner);
        }
    }
    /**
     * Remove all subscriptions.
     */
    clear() {
        this.subscriptions = {};
    }
}
//# sourceMappingURL=event_bus.js.map