import { createEmptyStructure } from "./helpers/state_manager_helpers";
export class StateObserver {
    constructor() {
        this.changes = [];
        this.commands = [];
    }
    /**
     * Record the changes which could happen in the given callback, save them in a
     * new revision with the given id and userId.
     */
    recordChanges(callback) {
        this.changes = [];
        this.commands = [];
        callback();
        return { changes: this.changes, commands: this.commands };
    }
    addCommand(command) {
        this.commands.push(command);
    }
    addChange(...args) {
        const val = args.pop();
        const [root, ...path] = args;
        let value = root;
        let key = path[path.length - 1];
        for (let pathIndex = 0; pathIndex <= path.length - 2; pathIndex++) {
            const p = path[pathIndex];
            if (value[p] === undefined) {
                const nextPath = path[pathIndex + 1];
                value[p] = createEmptyStructure(nextPath);
            }
            value = value[p];
        }
        if (value[key] === val) {
            return;
        }
        this.changes.push({
            root,
            path,
            before: value[key],
            after: val,
        });
        if (val === undefined) {
            delete value[key];
        }
        else {
            value[key] = val;
        }
    }
}
//# sourceMappingURL=state_observer.js.map