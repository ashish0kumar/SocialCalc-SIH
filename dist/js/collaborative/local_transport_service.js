export class LocalTransportService {
    constructor() {
        this.listeners = [];
    }
    sendMessage(message) {
        for (const { callback } of this.listeners) {
            callback(message);
        }
    }
    onNewMessage(id, callback) {
        this.listeners.push({ id, callback });
    }
    leave(id) {
        this.listeners = this.listeners.filter((listener) => listener.id !== id);
    }
}
//# sourceMappingURL=local_transport_service.js.map