import { DEBOUNCE_TIME, DEFAULT_REVISION_ID, MESSAGE_VERSION } from "../constants";
import { UuidGenerator } from "../helpers";
import { EventBus } from "../helpers/event_bus";
import { debounce, isDefined } from "../helpers/misc";
import { Revision } from "./revisions";
export class ClientDisconnectedError extends Error {
}
export class Session extends EventBus {
    /**
     * Manages the collaboration between multiple users on the same spreadsheet.
     * It can forward local state changes to other users to ensure they all eventually
     * reach the same state.
     * It also manages the positions of each clients in the spreadsheet to provide
     * a visual indication of what other users are doing in the spreadsheet.
     *
     * @param revisions
     * @param transportService communication channel used to send and receive messages
     * between all connected clients
     * @param client the client connected locally
     * @param serverRevisionId
     */
    constructor(revisions, transportService, serverRevisionId = DEFAULT_REVISION_ID) {
        super();
        this.revisions = revisions;
        this.transportService = transportService;
        this.serverRevisionId = serverRevisionId;
        /**
         * Positions of the others client.
         */
        this.clients = {};
        this.clientId = "local";
        this.pendingMessages = [];
        this.waitingAck = false;
        this.processedRevisions = new Set();
        this.uuidGenerator = new UuidGenerator();
        this.debouncedMove = debounce(this._move.bind(this), DEBOUNCE_TIME);
    }
    /**
     * Add a new revision to the collaborative session.
     * It will be transmitted to all other connected clients.
     */
    save(commands, changes) {
        if (!commands.length || !changes.length)
            return;
        const revision = new Revision(this.uuidGenerator.uuidv4(), this.clientId, commands, changes);
        this.revisions.append(revision.id, revision);
        this.trigger("new-local-state-update", { id: revision.id });
        this.sendUpdateMessage({
            type: "REMOTE_REVISION",
            version: MESSAGE_VERSION,
            serverRevisionId: this.serverRevisionId,
            nextRevisionId: revision.id,
            clientId: revision.clientId,
            commands: revision.commands,
        });
    }
    undo(revisionId) {
        this.sendUpdateMessage({
            type: "REVISION_UNDONE",
            version: MESSAGE_VERSION,
            serverRevisionId: this.serverRevisionId,
            nextRevisionId: this.uuidGenerator.uuidv4(),
            undoneRevisionId: revisionId,
        });
    }
    redo(revisionId) {
        this.sendUpdateMessage({
            type: "REVISION_REDONE",
            version: MESSAGE_VERSION,
            serverRevisionId: this.serverRevisionId,
            nextRevisionId: this.uuidGenerator.uuidv4(),
            redoneRevisionId: revisionId,
        });
    }
    /**
     * Notify that the position of the client has changed
     */
    move(position) {
        this.debouncedMove(position);
    }
    join(client) {
        if (client) {
            this.clients[client.id] = client;
            this.clientId = client.id;
        }
        else {
            this.clients["local"] = { id: "local", name: "local" };
            this.clientId = "local";
        }
        this.transportService.onNewMessage(this.clientId, this.onMessageReceived.bind(this));
    }
    loadInitialMessages(messages) {
        this.on("unexpected-revision-id", this, ({ revisionId }) => {
            throw new Error(`The spreadsheet could not be loaded. Revision ${revisionId} is corrupted.`);
        });
        for (const message of messages) {
            this.onMessageReceived(message);
        }
        this.off("unexpected-revision-id", this);
    }
    /**
     * Notify the server that the user client left the collaborative session
     */
    leave() {
        delete this.clients[this.clientId];
        this.transportService.leave(this.clientId);
        this.transportService.sendMessage({
            type: "CLIENT_LEFT",
            clientId: this.clientId,
            version: MESSAGE_VERSION,
        });
    }
    /**
     * Send a snapshot of the spreadsheet to the collaboration server
     */
    snapshot(data) {
        const snapshotId = this.uuidGenerator.uuidv4();
        this.transportService.sendMessage({
            type: "SNAPSHOT",
            nextRevisionId: snapshotId,
            serverRevisionId: this.serverRevisionId,
            data: { ...data, revisionId: snapshotId },
            version: MESSAGE_VERSION,
        });
    }
    getClient() {
        const client = this.clients[this.clientId];
        if (!client) {
            throw new ClientDisconnectedError("The client left the session");
        }
        return client;
    }
    getConnectedClients() {
        return new Set(Object.values(this.clients).filter(isDefined));
    }
    getRevisionId() {
        return this.serverRevisionId;
    }
    isFullySynchronized() {
        return this.pendingMessages.length === 0;
    }
    _move(position) {
        var _a;
        // this method is debounced and might be called after the client
        // left the session.
        if (!this.clients[this.clientId])
            return;
        const currentPosition = (_a = this.clients[this.clientId]) === null || _a === void 0 ? void 0 : _a.position;
        if ((currentPosition === null || currentPosition === void 0 ? void 0 : currentPosition.col) === position.col &&
            currentPosition.row === position.row &&
            currentPosition.sheetId === position.sheetId) {
            return;
        }
        const type = currentPosition ? "CLIENT_MOVED" : "CLIENT_JOINED";
        const client = this.getClient();
        this.clients[this.clientId] = { ...client, position };
        this.transportService.sendMessage({
            type,
            version: MESSAGE_VERSION,
            client: { ...client, position },
        });
    }
    /**
     * Handles messages received from other clients in the collaborative
     * session.
     */
    onMessageReceived(message) {
        if (this.isAlreadyProcessed(message))
            return;
        switch (message.type) {
            case "CLIENT_MOVED":
                this.onClientMoved(message);
                break;
            case "CLIENT_JOINED":
                this.onClientJoined(message);
                break;
            case "CLIENT_LEFT":
                this.onClientLeft(message);
                break;
            case "REVISION_REDONE": {
                this.waitingAck = false;
                this.revisions.redo(message.redoneRevisionId, message.nextRevisionId, message.serverRevisionId);
                this.trigger("revision-redone", {
                    revisionId: message.redoneRevisionId,
                    commands: this.revisions.get(message.redoneRevisionId).commands,
                });
                break;
            }
            case "REVISION_UNDONE":
                this.waitingAck = false;
                this.revisions.undo(message.undoneRevisionId, message.nextRevisionId, message.serverRevisionId);
                this.trigger("revision-undone", {
                    revisionId: message.undoneRevisionId,
                    commands: this.revisions.get(message.undoneRevisionId).commands,
                });
                break;
            case "REMOTE_REVISION":
                this.waitingAck = false;
                if (message.serverRevisionId !== this.serverRevisionId) {
                    this.trigger("unexpected-revision-id", { revisionId: message.serverRevisionId });
                    return;
                }
                const { clientId, commands } = message;
                const revision = new Revision(message.nextRevisionId, clientId, commands);
                if (revision.clientId !== this.clientId) {
                    this.revisions.insert(revision.id, revision, message.serverRevisionId);
                    this.trigger("remote-revision-received", { commands });
                }
                break;
            case "SNAPSHOT_CREATED": {
                this.waitingAck = false;
                const revision = new Revision(message.nextRevisionId, "server", []);
                this.revisions.insert(revision.id, revision, message.serverRevisionId);
                this.dropPendingHistoryMessages();
                this.trigger("snapshot");
                break;
            }
        }
        this.acknowledge(message);
        this.trigger("collaborative-event-received");
    }
    onClientMoved(message) {
        if (message.client.id !== this.clientId) {
            this.clients[message.client.id] = message.client;
        }
    }
    /**
     * Register the new client and send your
     * own position back.
     */
    onClientJoined(message) {
        if (message.client.id !== this.clientId) {
            this.clients[message.client.id] = message.client;
            const client = this.clients[this.clientId];
            if (client) {
                const { position } = client;
                if (position) {
                    this.transportService.sendMessage({
                        type: "CLIENT_MOVED",
                        version: MESSAGE_VERSION,
                        client: { ...client, position },
                    });
                }
            }
        }
    }
    onClientLeft(message) {
        if (message.clientId !== this.clientId) {
            delete this.clients[message.clientId];
        }
    }
    sendUpdateMessage(message) {
        this.pendingMessages.push(message);
        if (this.waitingAck) {
            return;
        }
        this.waitingAck = true;
        this.sendPendingMessage();
    }
    /**
     * Send the next pending message
     */
    sendPendingMessage() {
        let message = this.pendingMessages[0];
        if (!message)
            return;
        if (message.type === "REMOTE_REVISION") {
            const revision = this.revisions.get(message.nextRevisionId);
            if (revision.commands.length === 0) {
                /**
                 * The command is empty, we have to drop all the next local revisions
                 * to avoid issues with undo/redo
                 */
                this.revisions.drop(revision.id);
                const revisionIds = this.pendingMessages
                    .filter((message) => message.type === "REMOTE_REVISION")
                    .map((message) => message.nextRevisionId);
                this.trigger("pending-revisions-dropped", { revisionIds });
                this.pendingMessages = [];
                return;
            }
            message = {
                ...message,
                clientId: revision.clientId,
                commands: revision.commands,
            };
        }
        this.transportService.sendMessage({
            ...message,
            serverRevisionId: this.serverRevisionId,
        });
    }
    acknowledge(message) {
        switch (message.type) {
            case "REMOTE_REVISION":
            case "REVISION_REDONE":
            case "REVISION_UNDONE":
            case "SNAPSHOT_CREATED":
                this.pendingMessages = this.pendingMessages.filter((msg) => msg.nextRevisionId !== message.nextRevisionId);
                this.serverRevisionId = message.nextRevisionId;
                this.processedRevisions.add(message.nextRevisionId);
                this.sendPendingMessage();
                break;
        }
    }
    isAlreadyProcessed(message) {
        switch (message.type) {
            case "REMOTE_REVISION":
            case "REVISION_REDONE":
            case "REVISION_UNDONE":
                return this.processedRevisions.has(message.nextRevisionId);
            default:
                return false;
        }
    }
    dropPendingHistoryMessages() {
        this.pendingMessages = this.pendingMessages.filter(({ type }) => type !== "REVISION_REDONE" && type !== "REVISION_UNDONE");
    }
}
//# sourceMappingURL=session.js.map