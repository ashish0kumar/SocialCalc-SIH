export class Revision {
    /**
     * A revision represents a whole client action (Create a sheet, merge a Zone, Undo, ...).
     * A revision contains the following information:
     *  - id: ID of the revision
     *  - commands: CoreCommands that are linked to the action, and should be
     *              dispatched in other clients
     *  - clientId: Client who initiated the action
     *  - changes: List of changes applied on the state.
     */
    constructor(id, clientId, commands, changes) {
        this._commands = [];
        this._changes = [];
        this.id = id;
        this.clientId = clientId;
        this._commands = [...commands];
        this._changes = changes ? [...changes] : [];
    }
    setChanges(changes) {
        this._changes = changes;
    }
    get commands() {
        return this._commands;
    }
    get changes() {
        return this._changes;
    }
}
//# sourceMappingURL=revisions.js.map