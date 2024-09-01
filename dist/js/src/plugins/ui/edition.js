import { composerTokenize } from "../../formulas/index";
import { colors, concat, getComposerSheetName, isEqual, isNumber, markdownLink, positionToZone, rangeReference, toZone, updateSelectionOnDeletion, updateSelectionOnInsertion, } from "../../helpers/index";
import { loopThroughReferenceType } from "../../helpers/reference_type";
import { _lt } from "../../translation";
import { UIPlugin } from "../ui_plugin";
const CELL_DELETED_MESSAGE = _lt("The cell you are trying to edit has been deleted.");
export const SelectionIndicator = "␣";
export class EditionPlugin extends UIPlugin {
    constructor() {
        super(...arguments);
        this.col = 0;
        this.row = 0;
        this.mode = "inactive";
        this.sheetId = "";
        this.currentContent = "";
        this.currentTokens = [];
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.selectionInitialStart = 0;
        this.initialContent = "";
        this.previousRef = "";
        this.previousRange = undefined;
        this.colorIndexByRange = {};
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "CHANGE_COMPOSER_CURSOR_SELECTION":
                return this.validateSelection(this.currentContent.length, cmd.start, cmd.end);
            case "SET_CURRENT_CONTENT":
                if (cmd.selection) {
                    return this.validateSelection(cmd.content.length, cmd.selection.start, cmd.selection.end);
                }
                else {
                    return 0 /* Success */;
                }
            case "START_EDITION":
                if (cmd.selection) {
                    const cell = this.getters.getActiveCell();
                    const content = cmd.text || (cell === null || cell === void 0 ? void 0 : cell.composerContent) || "";
                    return this.validateSelection(content.length, cmd.selection.start, cmd.selection.end);
                }
                else {
                    return 0 /* Success */;
                }
            default:
                return 0 /* Success */;
        }
    }
    handleEvent(event) {
        if (this.mode !== "selecting") {
            return;
        }
        switch (event.mode) {
            case "newAnchor":
                this.insertSelectedRange(event.anchor.zone);
                break;
            default:
                this.replaceSelectedRanges(event.anchor.zone);
                break;
        }
    }
    handle(cmd) {
        switch (cmd.type) {
            case "CHANGE_COMPOSER_CURSOR_SELECTION":
                this.selectionStart = cmd.start;
                this.selectionEnd = cmd.end;
                break;
            case "STOP_COMPOSER_RANGE_SELECTION":
                if (this.isSelectingForComposer()) {
                    this.mode = "editing";
                }
                break;
            case "START_EDITION":
                this.startEdition(cmd.text, cmd.selection);
                break;
            case "STOP_EDITION":
                if (cmd.cancel) {
                    this.cancelEdition();
                    this.resetContent();
                }
                else {
                    this.stopEdition();
                }
                break;
            case "SET_CURRENT_CONTENT":
                this.setContent(cmd.content, cmd.selection);
                break;
            case "REPLACE_COMPOSER_CURSOR_SELECTION":
                this.replaceSelection(cmd.text);
                break;
            case "SELECT_FIGURE":
                this.cancelEdition();
                this.resetContent();
                break;
            case "ADD_COLUMNS_ROWS":
                this.onAddElements(cmd);
                break;
            case "REMOVE_COLUMNS_ROWS":
                if (cmd.dimension === "COL") {
                    this.onColumnsRemoved(cmd);
                }
                else {
                    this.onRowsRemoved(cmd);
                }
                break;
            case "START_CHANGE_HIGHLIGHT":
                this.dispatch("STOP_COMPOSER_RANGE_SELECTION");
                const previousRefToken = this.currentTokens
                    .filter((token) => token.type === "REFERENCE")
                    .find((token) => {
                    let value = token.value;
                    const [xc, sheet] = value.split("!").reverse();
                    const sheetName = sheet || this.getters.getSheetName(this.sheetId);
                    const activeSheetId = this.getters.getActiveSheetId();
                    return (isEqual(this.getters.expandZone(activeSheetId, toZone(xc)), cmd.zone) &&
                        this.getters.getSheetName(activeSheetId) === sheetName);
                });
                this.previousRef = previousRefToken.value;
                this.previousRange = this.getters.getRangeFromSheetXC(this.getters.getActiveSheetId(), this.previousRef);
                this.selectionInitialStart = previousRefToken.start;
                break;
            case "CHANGE_HIGHLIGHT":
                const newRef = this.getZoneReference(cmd.zone, this.previousRange.parts);
                this.selectionStart = this.selectionInitialStart;
                this.selectionEnd = this.selectionInitialStart + this.previousRef.length;
                this.replaceSelection(newRef);
                this.previousRef = newRef;
                this.selectionStart = this.currentContent.length;
                this.selectionEnd = this.currentContent.length;
                break;
            case "DELETE_SHEET":
            case "UNDO":
            case "REDO":
                const sheetIdExists = !!this.getters.tryGetSheet(this.sheetId);
                if (!sheetIdExists && this.mode !== "inactive") {
                    this.sheetId = this.getters.getActiveSheetId();
                    this.cancelEdition();
                    this.resetContent();
                    this.ui.notifyUI({
                        type: "NOTIFICATION",
                        text: CELL_DELETED_MESSAGE,
                    });
                }
                break;
            case "CYCLE_EDITION_REFERENCES":
                this.cycleReferences();
                break;
        }
    }
    unsubscribe() {
        this.mode = "inactive";
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    getEditionMode() {
        return this.mode;
    }
    getCurrentContent() {
        if (this.mode === "inactive") {
            const cell = this.getters.getActiveCell();
            return (cell === null || cell === void 0 ? void 0 : cell.composerContent) || "";
        }
        return this.currentContent;
    }
    getEditionSheet() {
        return this.sheetId;
    }
    getComposerSelection() {
        return {
            start: this.selectionStart,
            end: this.selectionEnd,
        };
    }
    isSelectingForComposer() {
        return this.mode === "selecting";
    }
    showSelectionIndicator() {
        return this.isSelectingForComposer() && this.canStartComposerRangeSelection();
    }
    getCurrentTokens() {
        return this.currentTokens;
    }
    /**
     * Return the (enriched) token just before the cursor.
     */
    getTokenAtCursor() {
        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);
        if (start === end && end === 0) {
            return undefined;
        }
        else {
            return this.currentTokens.find((t) => t.start <= start && t.end >= end);
        }
    }
    // ---------------------------------------------------------------------------
    // Misc
    // ---------------------------------------------------------------------------
    cycleReferences() {
        const tokens = this.getTokensInSelection();
        const refTokens = tokens.filter((token) => token.type === "REFERENCE");
        if (refTokens.length === 0)
            return;
        const updatedReferences = tokens
            .map(loopThroughReferenceType)
            .map((token) => token.value)
            .join("");
        const content = this.currentContent;
        const start = tokens[0].start;
        const end = tokens[tokens.length - 1].end;
        const newContent = content.slice(0, start) + updatedReferences + content.slice(end);
        const lengthDiff = newContent.length - content.length;
        this.setContent(newContent, {
            start: refTokens[0].start,
            end: refTokens[refTokens.length - 1].end + lengthDiff,
        });
    }
    validateSelection(length, start, end) {
        return start >= 0 && start <= length && end >= 0 && end <= length
            ? 0 /* Success */
            : 29 /* WrongComposerSelection */;
    }
    onColumnsRemoved(cmd) {
        if (cmd.elements.includes(this.col) && this.mode !== "inactive") {
            this.dispatch("STOP_EDITION", { cancel: true });
            this.ui.notifyUI({
                type: "NOTIFICATION",
                text: CELL_DELETED_MESSAGE,
            });
            return;
        }
        const { top, left } = updateSelectionOnDeletion({ left: this.col, right: this.col, top: this.row, bottom: this.row }, "left", [...cmd.elements]);
        this.col = left;
        this.row = top;
    }
    onRowsRemoved(cmd) {
        if (cmd.elements.includes(this.row) && this.mode !== "inactive") {
            this.dispatch("STOP_EDITION", { cancel: true });
            this.ui.notifyUI({
                type: "NOTIFICATION",
                text: CELL_DELETED_MESSAGE,
            });
            return;
        }
        const { top, left } = updateSelectionOnDeletion({ left: this.col, right: this.col, top: this.row, bottom: this.row }, "top", [...cmd.elements]);
        this.col = left;
        this.row = top;
    }
    onAddElements(cmd) {
        const { top, left } = updateSelectionOnInsertion({ left: this.col, right: this.col, top: this.row, bottom: this.row }, cmd.dimension === "COL" ? "left" : "top", cmd.base, cmd.position, cmd.quantity);
        this.col = left;
        this.row = top;
    }
    /**
     * Enable the selecting mode
     */
    startComposerRangeSelection() {
        const zone = positionToZone({ col: this.col, row: this.row });
        this.selection.resetAnchor(this, { cell: { col: this.col, row: this.row }, zone });
        this.mode = "selecting";
        this.selectionInitialStart = this.selectionStart;
    }
    /**
     * start the edition of a cell
     * @param str the key that is used to start the edition if it is a "content" key like a letter or number
     * @param selection
     * @private
     */
    startEdition(str, selection) {
        var _a;
        const cell = this.getters.getActiveCell();
        if (str && ((_a = cell === null || cell === void 0 ? void 0 : cell.format) === null || _a === void 0 ? void 0 : _a.includes("%")) && isNumber(str)) {
            selection = selection || { start: str.length, end: str.length };
            str = `${str}%`;
        }
        this.initialContent = (cell === null || cell === void 0 ? void 0 : cell.composerContent) || "";
        this.mode = "editing";
        const [col, row] = this.getters.getPosition();
        this.col = col;
        this.row = row;
        this.sheetId = this.getters.getActiveSheetId();
        this.setContent(str || this.initialContent, selection);
        this.colorIndexByRange = {};
        const zone = positionToZone({ col: this.col, row: this.row });
        this.selection.capture(this, { cell: { col: this.col, row: this.row }, zone }, {
            handleEvent: this.handleEvent.bind(this),
            release: () => (this.mode = "inactive"),
        });
    }
    stopEdition() {
        if (this.mode !== "inactive") {
            const activeSheetId = this.getters.getActiveSheetId();
            this.cancelEdition();
            const [col, row] = this.getters.getMainCell(this.sheetId, this.col, this.row);
            let content = this.currentContent;
            const didChange = this.initialContent !== content;
            if (!didChange) {
                return;
            }
            if (content) {
                const cell = this.getters.getCell(activeSheetId, col, row);
                if (content.startsWith("=")) {
                    const left = this.currentTokens.filter((t) => t.type === "LEFT_PAREN").length;
                    const right = this.currentTokens.filter((t) => t.type === "RIGHT_PAREN").length;
                    const missing = left - right;
                    if (missing > 0) {
                        content += concat(new Array(missing).fill(")"));
                    }
                }
                else if (cell === null || cell === void 0 ? void 0 : cell.isLink()) {
                    content = markdownLink(content, cell.link.url);
                }
                this.dispatch("UPDATE_CELL", {
                    sheetId: this.sheetId,
                    col,
                    row,
                    content,
                });
            }
            else {
                this.dispatch("UPDATE_CELL", {
                    sheetId: this.sheetId,
                    content: "",
                    col,
                    row,
                });
            }
            this.setContent("");
        }
    }
    cancelEdition() {
        if (this.mode === "inactive") {
            return;
        }
        this.mode = "inactive";
        this.selection.release(this);
        const sheetId = this.getters.getActiveSheetId();
        if (sheetId !== this.sheetId) {
            this.dispatch("ACTIVATE_SHEET", {
                sheetIdFrom: this.getters.getActiveSheetId(),
                sheetIdTo: this.sheetId,
            });
        }
    }
    /**
     * Reset the current content to the active cell content
     */
    resetContent() {
        this.setContent(this.initialContent || "");
    }
    setContent(text, selection) {
        const isNewCurrentContent = this.currentContent !== text;
        this.currentContent = text;
        if (selection) {
            this.selectionStart = selection.start;
            this.selectionEnd = selection.end;
        }
        else {
            this.selectionStart = this.selectionEnd = text.length;
        }
        if (isNewCurrentContent || this.mode !== "inactive") {
            this.currentTokens = text.startsWith("=") ? composerTokenize(text) : [];
        }
        if (this.canStartComposerRangeSelection()) {
            this.startComposerRangeSelection();
        }
    }
    insertSelectedRange(zone) {
        // infer if range selected or selecting range from cursor position
        const start = Math.min(this.selectionStart, this.selectionEnd);
        const ref = this.getZoneReference(zone);
        if (this.canStartComposerRangeSelection()) {
            this.insertText(ref, start);
            this.selectionInitialStart = start;
        }
        else {
            this.insertText("," + ref, start);
            this.selectionInitialStart = start + 1;
        }
    }
    /**
     * Replace the current reference selected by the new one.
     * */
    replaceSelectedRanges(zone) {
        const ref = this.getZoneReference(zone);
        this.replaceText(ref, this.selectionInitialStart, this.selectionEnd);
    }
    getZoneReference(zone, fixedParts = [{ colFixed: false, rowFixed: false }]) {
        const sheetId = this.getters.getActiveSheetId();
        let selectedXc = this.getters.zoneToXC(sheetId, zone, fixedParts);
        if (this.getters.getEditionSheet() !== this.getters.getActiveSheetId()) {
            const sheetName = getComposerSheetName(this.getters.getSheetName(this.getters.getActiveSheetId()));
            selectedXc = `${sheetName}!${selectedXc}`;
        }
        return selectedXc;
    }
    /**
     * Replace the current selection by a new text.
     * The cursor is then set at the end of the text.
     */
    replaceSelection(text) {
        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);
        this.replaceText(text, start, end);
    }
    replaceText(text, start, end) {
        this.currentContent =
            this.currentContent.slice(0, start) +
                this.currentContent.slice(end, this.currentContent.length);
        this.insertText(text, start);
    }
    /**
     * Insert a text at the given position.
     * The cursor is then set at the end of the text.
     */
    insertText(text, start) {
        const content = this.currentContent.slice(0, start) + text + this.currentContent.slice(start);
        const end = start + text.length;
        this.dispatch("SET_CURRENT_CONTENT", {
            content,
            selection: { start: end, end },
        });
    }
    /**
     * Highlight all ranges that can be found in the composer content.
     */
    getComposerHighlights() {
        if (!this.currentContent.startsWith("=") || this.mode === "inactive") {
            return [];
        }
        const ranges = [];
        const colorIndexByRange = {};
        for (let token of this.currentTokens.filter((token) => token.type === "REFERENCE")) {
            let value = token.value;
            const [xc, sheet] = value.split("!").reverse();
            if (rangeReference.test(xc)) {
                const refSanitized = (sheet ? `${sheet}!` : `${this.getters.getSheetName(this.getters.getEditionSheet())}!`) +
                    xc.replace(/\$/g, "");
                ranges.push(refSanitized);
                const colorIndex = this.colorIndexByRange[refSanitized];
                if (colorIndex !== undefined) {
                    colorIndexByRange[refSanitized] = colorIndex;
                }
            }
        }
        this.colorIndexByRange = colorIndexByRange;
        let colorIndexes = Object.values(colorIndexByRange);
        let nextColorIndex = 0;
        return ranges.map((r) => {
            if (this.colorIndexByRange[r] === undefined) {
                while (colorIndexes.includes(nextColorIndex)) {
                    nextColorIndex++;
                }
                colorIndexes.push(nextColorIndex);
                this.colorIndexByRange[r] = nextColorIndex;
            }
            return [r, colors[this.colorIndexByRange[r] % colors.length]];
        });
    }
    /**
     * Function used to determine when composer selection can start.
     * Three conditions are necessary:
     * - the previous token is among ["COMMA", "LEFT_PAREN", "OPERATOR"]
     * - the next token is missing or is among ["COMMA", "RIGHT_PAREN", "OPERATOR"]
     * - Previous and next tokens can be separated by spaces
     */
    canStartComposerRangeSelection() {
        if (this.currentContent.startsWith("=")) {
            const tokenAtCursor = this.getTokenAtCursor();
            if (!tokenAtCursor) {
                return false;
            }
            const tokenIdex = this.currentTokens.map((token) => token.start).indexOf(tokenAtCursor.start);
            let count = tokenIdex;
            let currentToken = tokenAtCursor;
            // check previous token
            while (!["COMMA", "LEFT_PAREN", "OPERATOR"].includes(currentToken.type)) {
                if (currentToken.type !== "SPACE" || count < 1) {
                    return false;
                }
                count--;
                currentToken = this.currentTokens[count];
            }
            count = tokenIdex + 1;
            currentToken = this.currentTokens[count];
            // check next token
            while (currentToken && !["COMMA", "RIGHT_PAREN", "OPERATOR"].includes(currentToken.type)) {
                if (currentToken.type !== "SPACE") {
                    return false;
                }
                count++;
                currentToken = this.currentTokens[count];
            }
            return true;
        }
        return false;
    }
    /**
     * Return all the tokens between selectionStart and selectionEnd.
     * Includes token that begin right on selectionStart or end right on selectionEnd.
     */
    getTokensInSelection() {
        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);
        return this.currentTokens.filter((t) => (t.start <= start && t.end >= start) || (t.start >= start && t.start < end));
    }
}
EditionPlugin.getters = [
    "getEditionMode",
    "isSelectingForComposer",
    "showSelectionIndicator",
    "getCurrentContent",
    "getEditionSheet",
    "getComposerSelection",
    "getCurrentTokens",
    "getTokenAtCursor",
    "getComposerHighlights",
];
EditionPlugin.modes = ["normal"];
//# sourceMappingURL=edition.js.map