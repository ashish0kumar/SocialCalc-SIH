import { DEFAULT_REVISION_ID } from "../../src/constants";
export class MockTransportService {
    constructor() {
        this.listeners = [];
        this.pendingMessages = [];
        this.isConcurrent = false;
        this.serverRevisionId = DEFAULT_REVISION_ID;
    }
    onNewMessage(id, callback) {
        this.listeners.push({ id, callback });
    }
    sendMessage(message) {
        const msg = JSON.parse(JSON.stringify(message));
        switch (msg.type) {
            case "REMOTE_REVISION":
            case "REVISION_UNDONE":
            case "REVISION_REDONE":
                if (this.serverRevisionId === msg.serverRevisionId) {
                    this.serverRevisionId = msg.nextRevisionId;
                    this.broadcast(msg);
                }
                break;
            case "SNAPSHOT":
                if (this.serverRevisionId === msg.serverRevisionId) {
                    this.serverRevisionId = msg.nextRevisionId;
                    this.broadcast({
                        type: "SNAPSHOT_CREATED",
                        nextRevisionId: msg.nextRevisionId,
                        serverRevisionId: msg.serverRevisionId,
                        version: 1,
                    });
                    this.snapshot = msg.data;
                }
                break;
            default:
                this.broadcast(msg);
                break;
        }
    }
    leave(id) {
        this.listeners = this.listeners.filter((listener) => listener.id !== id);
    }
    concurrent(concurrentExecutionCallback) {
        this.isConcurrent = true;
        concurrentExecutionCallback();
        for (let message of this.pendingMessages) {
            this.notifyListeners(message);
        }
        this.isConcurrent = false;
        this.pendingMessages = [];
    }
    notifyListeners(message) {
        for (const { callback } of this.listeners) {
            callback(JSON.parse(JSON.stringify(message)));
        }
    }
    broadcast(message) {
        if (this.isConcurrent) {
            this.pendingMessages.push(message);
        }
        else {
            this.notifyListeners(message);
        }
    }
}
//# sourceMappingURL=transport_service.js.map