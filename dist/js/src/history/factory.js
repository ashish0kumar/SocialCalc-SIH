import { transformAll } from "../collaborative/ot/ot";
import { Revision } from "../collaborative/revisions";
import { inverseCommand } from "../helpers/inverse_commands";
import { createEmptyStructure } from "../helpers/state_manager_helpers";
import { SelectiveHistory } from "./selective_history";
export function buildRevisionLog(initialRevisionId, recordChanges, dispatch) {
    return new SelectiveHistory(initialRevisionId, (revision) => {
        const commands = revision.commands.slice();
        const { changes } = recordChanges(() => {
            for (const command of commands) {
                dispatch(command);
            }
        });
        revision.setChanges(changes);
    }, (revision) => revertChanges([revision]), (id) => new Revision(id, "empty", [], []), {
        with: (revision) => (toTransform) => {
            return new Revision(toTransform.id, toTransform.clientId, transformAll(toTransform.commands, revision.commands));
        },
        without: (revision) => (toTransform) => {
            return new Revision(toTransform.id, toTransform.clientId, transformAll(toTransform.commands, revision.commands.map(inverseCommand).flat()));
        },
    });
}
/**
 * Revert changes from the given revisions
 */
function revertChanges(revisions) {
    for (const revision of revisions.slice().reverse()) {
        for (let i = revision.changes.length - 1; i >= 0; i--) {
            const change = revision.changes[i];
            applyChange(change, "before");
        }
    }
}
/**
 * Apply the changes of the given HistoryChange to the state
 */
function applyChange(change, target) {
    let val = change.root;
    let key = change.path[change.path.length - 1];
    for (let pathIndex = 0; pathIndex < change.path.slice(0, -1).length; pathIndex++) {
        const p = change.path[pathIndex];
        if (val[p] === undefined) {
            const nextPath = change.path[pathIndex + 1];
            val[p] = createEmptyStructure(nextPath);
        }
        val = val[p];
    }
    if (change[target] === undefined) {
        delete val[key];
    }
    else {
        val[key] = change[target];
    }
}
//# sourceMappingURL=factory.js.map