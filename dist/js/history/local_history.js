import { EventBus } from "@odoo/owl";
import { MAX_HISTORY_STEPS } from "../constants";
/**
 * Local History
 *
 * The local history is responsible of tracking the locally state updates
 * It maintains the local undo and redo stack to allow to undo/redo only local
 * changes
 */
export class LocalHistory extends EventBus {
    constructor(dispatch, session) {
        super();
        this.dispatch = dispatch;
        this.session = session;
        /**
         * Ids of the revisions which can be undone
         */
        this.undoStack = [];
        /**
         * Ids of the revisions which can be redone
         */
        this.redoStack = [];
        /**
         * Flag used to block all commands when an undo or redo is triggered, until
         * it is accepted on the server
         */
        this.isWaitingForUndoRedo = false;
        this.session.on("new-local-state-update", this, this.onNewLocalStateUpdate);
        this.session.on("revision-undone", this, ({ commands }) => this.selectiveUndo(commands));
        this.session.on("revision-redone", this, ({ commands }) => this.selectiveRedo(commands));
        this.session.on("pending-revisions-dropped", this, ({ revisionIds }) => this.drop(revisionIds));
        this.session.on("snapshot", this, () => {
            this.undoStack = [];
            this.redoStack = [];
            this.isWaitingForUndoRedo = false;
        });
    }
    allowDispatch(cmd) {
        if (this.isWaitingForUndoRedo) {
            return 47 /* WaitingSessionConfirmation */;
        }
        switch (cmd.type) {
            case "REQUEST_UNDO":
                if (!this.canUndo()) {
                    return 5 /* EmptyUndoStack */;
                }
                break;
            case "REQUEST_REDO":
                if (!this.canRedo()) {
                    return 6 /* EmptyRedoStack */;
                }
                break;
        }
        return 0 /* Success */;
    }
    beforeHandle(cmd) { }
    handle(cmd) {
        switch (cmd.type) {
            case "REQUEST_UNDO":
            case "REQUEST_REDO":
                // History changes (undo & redo) are *not* applied optimistically on the local state.
                // We wait a global confirmation from the server. The goal is to avoid handling concurrent
                // history changes on multiple clients which are very hard to manage correctly.
                this.requestHistoryChange(cmd.type === "REQUEST_UNDO" ? "UNDO" : "REDO");
        }
    }
    finalize() { }
    requestHistoryChange(type) {
        const id = type === "UNDO" ? this.undoStack.pop() : this.redoStack.pop();
        if (!id) {
            return;
        }
        this.isWaitingForUndoRedo = true;
        if (type === "UNDO") {
            this.session.undo(id);
            this.redoStack.push(id);
        }
        else {
            this.session.redo(id);
            this.undoStack.push(id);
        }
    }
    canUndo() {
        return this.undoStack.length > 0;
    }
    canRedo() {
        return this.redoStack.length > 0;
    }
    drop(revisionIds) {
        this.undoStack = this.undoStack.filter((id) => !revisionIds.includes(id));
        this.redoStack = [];
        this.isWaitingForUndoRedo = false;
    }
    onNewLocalStateUpdate({ id }) {
        this.undoStack.push(id);
        this.redoStack = [];
        if (this.undoStack.length > MAX_HISTORY_STEPS) {
            this.undoStack.shift();
        }
    }
    selectiveUndo(commands) {
        this.dispatch("UNDO", { commands });
        this.isWaitingForUndoRedo = false;
    }
    selectiveRedo(commands) {
        this.dispatch("REDO", { commands });
        this.isWaitingForUndoRedo = false;
    }
}
//# sourceMappingURL=local_history.js.map