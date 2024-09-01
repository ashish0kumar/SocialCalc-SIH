import { groupConsecutive } from "../helpers/index";
import { Registry } from "../registry";
import { coreTypes, } from "../types/commands";
export const inverseCommandRegistry = new Registry()
    .add("ADD_COLUMNS_ROWS", inverseAddColumnsRows)
    .add("REMOVE_COLUMNS_ROWS", inverseRemoveColumnsRows)
    .add("ADD_MERGE", inverseAddMerge)
    .add("REMOVE_MERGE", inverseRemoveMerge)
    .add("CREATE_SHEET", inverseCreateSheet)
    .add("DELETE_SHEET", inverseDeleteSheet)
    .add("DUPLICATE_SHEET", inverseDuplicateSheet)
    .add("CREATE_FIGURE", inverseCreateFigure)
    .add("CREATE_CHART", inverseCreateChart)
    .add("HIDE_COLUMNS_ROWS", inverseHideColumnsRows)
    .add("UNHIDE_COLUMNS_ROWS", inverseUnhideColumnsRows);
for (const cmd of coreTypes.values()) {
    try {
        inverseCommandRegistry.get(cmd);
    }
    catch (_) {
        inverseCommandRegistry.add(cmd, identity);
    }
}
function identity(cmd) {
    return [cmd];
}
function inverseAddColumnsRows(cmd) {
    const elements = [];
    let start = cmd.base;
    if (cmd.position === "after") {
        start++;
    }
    for (let i = 0; i < cmd.quantity; i++) {
        elements.push(i + start);
    }
    return [
        {
            type: "REMOVE_COLUMNS_ROWS",
            dimension: cmd.dimension,
            elements,
            sheetId: cmd.sheetId,
        },
    ];
}
function inverseAddMerge(cmd) {
    return [{ type: "REMOVE_MERGE", sheetId: cmd.sheetId, target: cmd.target }];
}
function inverseRemoveMerge(cmd) {
    return [{ type: "ADD_MERGE", sheetId: cmd.sheetId, target: cmd.target }];
}
function inverseCreateSheet(cmd) {
    return [{ type: "DELETE_SHEET", sheetId: cmd.sheetId }];
}
function inverseDuplicateSheet(cmd) {
    return [{ type: "DELETE_SHEET", sheetId: cmd.sheetIdTo }];
}
function inverseRemoveColumnsRows(cmd) {
    const commands = [];
    const elements = [...cmd.elements].sort((a, b) => a - b);
    for (let group of groupConsecutive(elements)) {
        const column = group[0] === 0 ? 0 : group[0] - 1;
        const position = group[0] === 0 ? "before" : "after";
        commands.push({
            type: "ADD_COLUMNS_ROWS",
            dimension: cmd.dimension,
            quantity: group.length,
            base: column,
            sheetId: cmd.sheetId,
            position,
        });
    }
    return commands;
}
function inverseDeleteSheet(cmd) {
    return [{ type: "CREATE_SHEET", sheetId: cmd.sheetId, position: 1 }];
}
function inverseCreateFigure(cmd) {
    return [{ type: "DELETE_FIGURE", id: cmd.figure.id, sheetId: cmd.sheetId }];
}
function inverseCreateChart(cmd) {
    return [{ type: "DELETE_FIGURE", id: cmd.id, sheetId: cmd.sheetId }];
}
function inverseHideColumnsRows(cmd) {
    return [
        {
            type: "UNHIDE_COLUMNS_ROWS",
            sheetId: cmd.sheetId,
            dimension: cmd.dimension,
            elements: cmd.elements,
        },
    ];
}
function inverseUnhideColumnsRows(cmd) {
    return [
        {
            type: "HIDE_COLUMNS_ROWS",
            sheetId: cmd.sheetId,
            dimension: cmd.dimension,
            elements: cmd.elements,
        },
    ];
}
//# sourceMappingURL=inverse_command_registry.js.map