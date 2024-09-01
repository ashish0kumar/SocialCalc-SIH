export function isSheetDependent(cmd) {
    return "sheetId" in cmd;
}
export function isGridDependent(cmd) {
    return "dimension" in cmd;
}
export function isTargetDependent(cmd) {
    return "target" in cmd;
}
export function isZoneDependent(cmd) {
    return "zone" in cmd;
}
export function isPositionDependent(cmd) {
    return "col" in cmd && "row" in cmd;
}
export const invalidateEvaluationCommands = new Set([
    "RENAME_SHEET",
    "DELETE_SHEET",
    "CREATE_SHEET",
    "ADD_COLUMNS_ROWS",
    "REMOVE_COLUMNS_ROWS",
    "DELETE_CELL",
    "INSERT_CELL",
    "UNDO",
    "REDO",
]);
export const readonlyAllowedCommands = new Set([
    "START",
    "ACTIVATE_SHEET",
    "COPY",
    "PREPARE_SELECTION_INPUT_EXPANSION",
    "STOP_SELECTION_INPUT",
    "RESIZE_VIEWPORT",
    "SET_VIEWPORT_OFFSET",
    "MOVE_POSITION",
    "SELECT_SEARCH_NEXT_MATCH",
    "SELECT_SEARCH_PREVIOUS_MATCH",
    "REFRESH_SEARCH",
    "UPDATE_SEARCH",
    "CLEAR_SEARCH",
    "EVALUATE_CELLS",
    "SET_CURRENT_CONTENT",
    "SET_FORMULA_VISIBILITY",
]);
export const coreTypes = new Set([
    /** CELLS */
    "UPDATE_CELL",
    "UPDATE_CELL_POSITION",
    "CLEAR_CELL",
    "DELETE_CONTENT",
    /** GRID SHAPE */
    "ADD_COLUMNS_ROWS",
    "REMOVE_COLUMNS_ROWS",
    "RESIZE_COLUMNS_ROWS",
    "HIDE_COLUMNS_ROWS",
    "UNHIDE_COLUMNS_ROWS",
    "SET_GRID_LINES_VISIBILITY",
    /** MERGE */
    "ADD_MERGE",
    "REMOVE_MERGE",
    /** SHEETS MANIPULATION */
    "CREATE_SHEET",
    "DELETE_SHEET",
    "DUPLICATE_SHEET",
    "MOVE_SHEET",
    "RENAME_SHEET",
    /** CONDITIONAL FORMAT */
    "ADD_CONDITIONAL_FORMAT",
    "REMOVE_CONDITIONAL_FORMAT",
    "MOVE_CONDITIONAL_FORMAT",
    /** FIGURES */
    "CREATE_FIGURE",
    "DELETE_FIGURE",
    "UPDATE_FIGURE",
    /** FORMATTING */
    "SET_FORMATTING",
    "CLEAR_FORMATTING",
    "SET_BORDER",
    "SET_DECIMAL",
    /** CHART */
    "CREATE_CHART",
    "UPDATE_CHART",
    /** SORT */
    "SORT_CELLS",
]);
export function isCoreCommand(cmd) {
    return coreTypes.has(cmd.type);
}
export function canExecuteInReadonly(cmd) {
    return readonlyAllowedCommands.has(cmd.type);
}
/**
 * Holds the result of a command dispatch.
 * The command may have been successfully dispatched or cancelled
 * for one or more reasons.
 */
export class DispatchResult {
    constructor(results = []) {
        if (!Array.isArray(results)) {
            results = [results];
        }
        results = [...new Set(results)];
        this.reasons = results.filter((result) => result !== 0 /* Success */);
    }
    /**
     * Static helper which returns a successful DispatchResult
     */
    static get Success() {
        return new DispatchResult();
    }
    get isSuccessful() {
        return this.reasons.length === 0;
    }
    /**
     * Check if the dispatch has been cancelled because of
     * the given reason.
     */
    isCancelledBecause(reason) {
        return this.reasons.includes(reason);
    }
}
export var CommandResult;
(function (CommandResult) {
    CommandResult[CommandResult["Success"] = 0] = "Success";
    CommandResult[CommandResult["CancelledForUnknownReason"] = 1] = "CancelledForUnknownReason";
    CommandResult[CommandResult["WillRemoveExistingMerge"] = 2] = "WillRemoveExistingMerge";
    CommandResult[CommandResult["MergeIsDestructive"] = 3] = "MergeIsDestructive";
    CommandResult[CommandResult["CellIsMerged"] = 4] = "CellIsMerged";
    CommandResult[CommandResult["EmptyUndoStack"] = 5] = "EmptyUndoStack";
    CommandResult[CommandResult["EmptyRedoStack"] = 6] = "EmptyRedoStack";
    CommandResult[CommandResult["NotEnoughElements"] = 7] = "NotEnoughElements";
    CommandResult[CommandResult["NotEnoughSheets"] = 8] = "NotEnoughSheets";
    CommandResult[CommandResult["MissingSheetName"] = 9] = "MissingSheetName";
    CommandResult[CommandResult["DuplicatedSheetName"] = 10] = "DuplicatedSheetName";
    CommandResult[CommandResult["ForbiddenCharactersInSheetName"] = 11] = "ForbiddenCharactersInSheetName";
    CommandResult[CommandResult["WrongSheetMove"] = 12] = "WrongSheetMove";
    CommandResult[CommandResult["WrongSheetPosition"] = 13] = "WrongSheetPosition";
    CommandResult[CommandResult["InvalidAnchorZone"] = 14] = "InvalidAnchorZone";
    CommandResult[CommandResult["SelectionOutOfBound"] = 15] = "SelectionOutOfBound";
    CommandResult[CommandResult["TargetOutOfSheet"] = 16] = "TargetOutOfSheet";
    CommandResult[CommandResult["WrongPasteSelection"] = 17] = "WrongPasteSelection";
    CommandResult[CommandResult["EmptyClipboard"] = 18] = "EmptyClipboard";
    CommandResult[CommandResult["EmptyRange"] = 19] = "EmptyRange";
    CommandResult[CommandResult["InvalidRange"] = 20] = "InvalidRange";
    CommandResult[CommandResult["InvalidSheetId"] = 21] = "InvalidSheetId";
    CommandResult[CommandResult["InputAlreadyFocused"] = 22] = "InputAlreadyFocused";
    CommandResult[CommandResult["MaximumRangesReached"] = 23] = "MaximumRangesReached";
    CommandResult[CommandResult["InvalidChartDefinition"] = 24] = "InvalidChartDefinition";
    CommandResult[CommandResult["EmptyDataSet"] = 25] = "EmptyDataSet";
    CommandResult[CommandResult["InvalidDataSet"] = 26] = "InvalidDataSet";
    CommandResult[CommandResult["InvalidLabelRange"] = 27] = "InvalidLabelRange";
    CommandResult[CommandResult["InvalidAutofillSelection"] = 28] = "InvalidAutofillSelection";
    CommandResult[CommandResult["WrongComposerSelection"] = 29] = "WrongComposerSelection";
    CommandResult[CommandResult["MinBiggerThanMax"] = 30] = "MinBiggerThanMax";
    CommandResult[CommandResult["LowerBiggerThanUpper"] = 31] = "LowerBiggerThanUpper";
    CommandResult[CommandResult["MidBiggerThanMax"] = 32] = "MidBiggerThanMax";
    CommandResult[CommandResult["MinBiggerThanMid"] = 33] = "MinBiggerThanMid";
    CommandResult[CommandResult["FirstArgMissing"] = 34] = "FirstArgMissing";
    CommandResult[CommandResult["SecondArgMissing"] = 35] = "SecondArgMissing";
    CommandResult[CommandResult["MinNaN"] = 36] = "MinNaN";
    CommandResult[CommandResult["MidNaN"] = 37] = "MidNaN";
    CommandResult[CommandResult["MaxNaN"] = 38] = "MaxNaN";
    CommandResult[CommandResult["ValueUpperInflectionNaN"] = 39] = "ValueUpperInflectionNaN";
    CommandResult[CommandResult["ValueLowerInflectionNaN"] = 40] = "ValueLowerInflectionNaN";
    CommandResult[CommandResult["MinInvalidFormula"] = 41] = "MinInvalidFormula";
    CommandResult[CommandResult["MidInvalidFormula"] = 42] = "MidInvalidFormula";
    CommandResult[CommandResult["MaxInvalidFormula"] = 43] = "MaxInvalidFormula";
    CommandResult[CommandResult["ValueUpperInvalidFormula"] = 44] = "ValueUpperInvalidFormula";
    CommandResult[CommandResult["ValueLowerInvalidFormula"] = 45] = "ValueLowerInvalidFormula";
    CommandResult[CommandResult["InvalidSortZone"] = 46] = "InvalidSortZone";
    CommandResult[CommandResult["WaitingSessionConfirmation"] = 47] = "WaitingSessionConfirmation";
    CommandResult[CommandResult["MergeOverlap"] = 48] = "MergeOverlap";
    CommandResult[CommandResult["TooManyHiddenElements"] = 49] = "TooManyHiddenElements";
    CommandResult[CommandResult["Readonly"] = 50] = "Readonly";
    CommandResult[CommandResult["InvalidOffset"] = 51] = "InvalidOffset";
    CommandResult[CommandResult["InvalidViewportSize"] = 52] = "InvalidViewportSize";
    CommandResult[CommandResult["FigureDoesNotExist"] = 53] = "FigureDoesNotExist";
    CommandResult[CommandResult["InvalidConditionalFormatId"] = 54] = "InvalidConditionalFormatId";
})(CommandResult || (CommandResult = {}));
//# sourceMappingURL=commands.js.map