import { SELECTION_BORDER_COLOR } from "../../constants";
import { formatValue } from "../../helpers/cells/index";
import { mergeOverlappingZones, overlap, positions } from "../../helpers/index";
import { isCoreCommand, } from "../../types/index";
import { UIPlugin } from "../ui_plugin";
/**
 * Clipboard Plugin
 *
 * This clipboard manages all cut/copy/paste interactions internal to the
 * application, and with the OS clipboard as well.
 */
export class ClipboardPlugin extends UIPlugin {
    constructor() {
        super(...arguments);
        this.status = "invisible";
        this._isPaintingFormat = false;
    }
    // ---------------------------------------------------------------------------
    // Command Handling
    // ---------------------------------------------------------------------------
    allowDispatch(cmd) {
        switch (cmd.type) {
            case "PASTE":
                return this.isPasteAllowed(this.state, cmd.target, !!cmd.force);
            case "INSERT_CELL": {
                const { cut, paste } = this.getInsertCellsTargets(cmd.zone, cmd.shiftDimension);
                const state = this.getClipboardState(cut, "CUT");
                return this.isPasteAllowed(state, paste, false);
            }
            case "DELETE_CELL": {
                const { cut, paste } = this.getDeleteCellsTargets(cmd.zone, cmd.shiftDimension);
                const state = this.getClipboardState(cut, "CUT");
                return this.isPasteAllowed(state, paste, false);
            }
        }
        return 0 /* Success */;
    }
    handle(cmd) {
        switch (cmd.type) {
            case "COPY":
            case "CUT":
                this.state = this.getClipboardState(cmd.target, cmd.type);
                this.status = "visible";
                break;
            case "PASTE":
                if (!this.state) {
                    break;
                }
                const pasteOption = cmd.pasteOption || (this._isPaintingFormat ? "onlyFormat" : undefined);
                this._isPaintingFormat = false;
                const height = this.state.cells.length;
                const width = this.state.cells[0].length;
                this.paste(this.state, cmd.target, pasteOption);
                this.selectPastedZone(width, height, cmd.target);
                this.status = "invisible";
                break;
            case "DELETE_CELL": {
                const { cut, paste } = this.getDeleteCellsTargets(cmd.zone, cmd.shiftDimension);
                const state = this.getClipboardState(cut, "CUT");
                this.paste(state, paste);
                break;
            }
            case "INSERT_CELL": {
                const { cut, paste } = this.getInsertCellsTargets(cmd.zone, cmd.shiftDimension);
                const state = this.getClipboardState(cut, "CUT");
                this.paste(state, paste);
                break;
            }
            case "PASTE_FROM_OS_CLIPBOARD":
                this.pasteFromClipboard(cmd.target, cmd.text);
                break;
            case "ACTIVATE_PAINT_FORMAT":
                this.state = this.getClipboardState(cmd.target, "COPY");
                this._isPaintingFormat = true;
                this.status = "visible";
                break;
            default:
                if (isCoreCommand(cmd)) {
                    this.status = "invisible";
                }
        }
    }
    // ---------------------------------------------------------------------------
    // Getters
    // ---------------------------------------------------------------------------
    /**
     * Format the current clipboard to a string suitable for being pasted in other
     * programs.
     *
     * - add a tab character between each consecutive cells
     * - add a newline character between each line
     *
     * Note that it returns \t if the clipboard is empty. This is necessary for the
     * clipboard copy event to add it as data, otherwise an empty string is not
     * considered as a copy content.
     */
    getClipboardContent() {
        if (!this.state || !this.state.cells.length) {
            return "\t";
        }
        return (this.state.cells
            .map((cells) => {
            return cells
                .map((c) => c.cell ? this.getters.getCellText(c.cell, this.getters.shouldShowFormulas()) : "")
                .join("\t");
        })
            .join("\n") || "\t");
    }
    isPaintingFormat() {
        return this._isPaintingFormat;
    }
    // ---------------------------------------------------------------------------
    // Private methods
    // ---------------------------------------------------------------------------
    getDeleteCellsTargets(zone, dimension) {
        const sheet = this.getters.getActiveSheet();
        let cut;
        if (dimension === "COL") {
            cut = {
                ...zone,
                left: zone.right + 1,
                right: sheet.cols.length - 1,
            };
        }
        else {
            cut = {
                ...zone,
                top: zone.bottom + 1,
                bottom: sheet.rows.length - 1,
            };
        }
        return { cut: [cut], paste: [zone] };
    }
    getInsertCellsTargets(zone, dimension) {
        const sheet = this.getters.getActiveSheet();
        let cut;
        let paste;
        if (dimension === "COL") {
            cut = {
                ...zone,
                right: sheet.cols.length - 1,
            };
            paste = {
                ...zone,
                left: zone.right + 1,
                right: zone.right + 1,
            };
        }
        else {
            cut = {
                ...zone,
                bottom: sheet.rows.length - 1,
            };
            paste = { ...zone, top: zone.bottom + 1, bottom: sheet.rows.length - 1 };
        }
        return { cut: [cut], paste: [paste] };
    }
    /**
     * If the position is the top-left of an existing merge, remove it
     */
    removeMergeIfTopLeft(position) {
        const { sheetId, col, row } = position;
        const [left, top] = this.getters.getMainCell(sheetId, col, row);
        if (top === row && left === col) {
            const merge = this.getters.getMerge(sheetId, col, row);
            if (merge) {
                this.dispatch("REMOVE_MERGE", { sheetId, target: [merge] });
            }
        }
    }
    /**
     * If the origin position given is the top left of a merge, merge the target
     * position.
     */
    pasteMergeIfExist(origin, target) {
        let { sheetId, col, row } = origin;
        const [mainCellColOrigin, mainCellRowOrigin] = this.getters.getMainCell(sheetId, col, row);
        if (mainCellColOrigin === col && mainCellRowOrigin === row) {
            const merge = this.getters.getMerge(sheetId, col, row);
            if (!merge) {
                return;
            }
            ({ sheetId, col, row } = target);
            this.dispatch("ADD_MERGE", {
                sheetId,
                force: true,
                target: [
                    {
                        left: col,
                        top: row,
                        right: col + merge.right - merge.left,
                        bottom: row + merge.bottom - merge.top,
                    },
                ],
            });
        }
    }
    /**
     * Compute the complete zones where to paste the current clipboard
     */
    getPasteZones(target, cells) {
        if (!cells.length || !cells[0].length) {
            return target;
        }
        const pasteZones = [];
        const height = cells.length;
        const width = cells[0].length;
        const selection = target[target.length - 1];
        const col = selection.left;
        const row = selection.top;
        const repetitionCol = Math.max(1, Math.floor((selection.right + 1 - col) / width));
        const repetitionRow = Math.max(1, Math.floor((selection.bottom + 1 - row) / height));
        for (let x = 1; x <= repetitionCol; x++) {
            for (let y = 1; y <= repetitionRow; y++) {
                pasteZones.push({
                    left: col,
                    top: row,
                    right: col - 1 + x * width,
                    bottom: row - 1 + y * height,
                });
            }
        }
        return pasteZones;
    }
    /**
     * Get the clipboard state from the given zones.
     */
    getClipboardState(zones, operation) {
        const lefts = new Set(zones.map((z) => z.left));
        const rights = new Set(zones.map((z) => z.right));
        const tops = new Set(zones.map((z) => z.top));
        const bottoms = new Set(zones.map((z) => z.bottom));
        const areZonesCompatible = (tops.size === 1 && bottoms.size === 1) || (lefts.size === 1 && rights.size === 1);
        // In order to don't paste several times the same cells in intersected zones
        // --> we merge zones that have common cells
        const clippedZones = areZonesCompatible
            ? mergeOverlappingZones(zones)
            : [zones[zones.length - 1]];
        const cellsPosition = clippedZones.map((zone) => positions(zone)).flat();
        const columnsIndex = [...new Set(cellsPosition.map((p) => p[0]))].sort((a, b) => a - b);
        const rowsIndex = [...new Set(cellsPosition.map((p) => p[1]))].sort((a, b) => a - b);
        const cellsInClipboard = [];
        const merges = [];
        const sheetId = this.getters.getActiveSheetId();
        for (let row of rowsIndex) {
            let cellsInRow = [];
            for (let col of columnsIndex) {
                cellsInRow.push({
                    cell: this.getters.getCell(sheetId, col, row),
                    border: this.getters.getCellBorder(sheetId, col, row) || undefined,
                    position: { col, row, sheetId },
                });
                const merge = this.getters.getMerge(sheetId, col, row);
                if (merge && merge.top === row && merge.left === col) {
                    merges.push(merge);
                }
            }
            cellsInClipboard.push(cellsInRow);
        }
        return {
            cells: cellsInClipboard,
            operation,
            sheetId,
            zones: clippedZones,
            merges,
        };
    }
    pasteFromClipboard(target, content) {
        this.status = "invisible";
        const values = content
            .replace(/\r/g, "")
            .split("\n")
            .map((vals) => vals.split("\t"));
        const { left: activeCol, top: activeRow } = target[0];
        const width = Math.max.apply(Math, values.map((a) => a.length));
        const height = values.length;
        const sheet = this.getters.getActiveSheet();
        this.addMissingDimensions(sheet, width, height, activeCol, activeRow);
        for (let i = 0; i < values.length; i++) {
            for (let j = 0; j < values[i].length; j++) {
                this.dispatch("UPDATE_CELL", {
                    row: activeRow + i,
                    col: activeCol + j,
                    content: values[i][j],
                    sheetId: sheet.id,
                });
            }
        }
        const zone = {
            left: activeCol,
            top: activeRow,
            right: activeCol + width - 1,
            bottom: activeRow + height - 1,
        };
        this.selection.selectZone({ cell: { col: activeCol, row: activeRow }, zone });
    }
    isPasteAllowed(state, target, force) {
        const sheetId = this.getters.getActiveSheetId();
        if (!state) {
            return 18 /* EmptyClipboard */;
        }
        if (target.length > 1) {
            // cannot paste if we have a clipped zone larger than a cell and multiple
            // zones selected
            if (state.cells.length > 1 || state.cells[0].length > 1) {
                return 17 /* WrongPasteSelection */;
            }
        }
        if (!force) {
            for (let zone of this.getPasteZones(target, state.cells)) {
                if (this.getters.doesIntersectMerge(sheetId, zone)) {
                    return 2 /* WillRemoveExistingMerge */;
                }
            }
        }
        return 0 /* Success */;
    }
    /**
     * Paste the clipboard content in the given target
     */
    paste(state, target, options) {
        if (state.operation === "CUT") {
            this.clearClippedZones(state);
        }
        if (target.length > 1) {
            for (const zone of target) {
                for (let col = zone.left; col <= zone.right; col++) {
                    for (let row = zone.top; row <= zone.bottom; row++) {
                        this.pasteZone(state, col, row, options);
                    }
                }
            }
        }
        else {
            const height = state.cells.length;
            const width = state.cells[0].length;
            const selection = target[0];
            const repX = Math.max(1, Math.floor((selection.right + 1 - selection.left) / width));
            const repY = Math.max(1, Math.floor((selection.bottom + 1 - selection.top) / height));
            for (let x = 0; x < repX; x++) {
                for (let y = 0; y < repY; y++) {
                    this.pasteZone(state, selection.left + x * width, selection.top + y * height, options);
                }
            }
        }
        if (state.operation === "CUT") {
            this.dispatch("REMOVE_MERGE", { sheetId: state.sheetId, target: state.merges });
            this.state = undefined;
        }
    }
    /**
     * Update the selection with the newly pasted zone
     */
    selectPastedZone(width, height, target) {
        const selection = target[0];
        const col = selection.left;
        const row = selection.top;
        const repX = Math.max(1, Math.floor((selection.right + 1 - selection.left) / width));
        const repY = Math.max(1, Math.floor((selection.bottom + 1 - selection.top) / height));
        if (height > 1 || width > 1) {
            const newZone = {
                left: col,
                top: row,
                right: col + repX * width - 1,
                bottom: row + repY * height - 1,
            };
            this.selection.selectZone({ cell: { col, row }, zone: newZone });
        }
    }
    /**
     * Clear the clipped zones: remove the cells and clear the formatting
     */
    clearClippedZones(state) {
        for (const row of state.cells) {
            for (const cell of row) {
                if (cell.cell) {
                    this.dispatch("CLEAR_CELL", cell.position);
                }
            }
        }
        this.dispatch("CLEAR_FORMATTING", {
            sheetId: state.sheetId,
            target: state.zones,
        });
    }
    pasteZone(state, col, row, pasteOption) {
        const height = state.cells.length;
        const width = state.cells[0].length;
        // This condition is used to determine if we have to paste the CF or not.
        // We have to do it when the command handled is "PASTE", not "INSERT_CELL"
        // or "DELETE_CELL". So, the state should be the local state
        const shouldPasteCF = pasteOption !== "onlyValue" && this.state && this.state === state;
        const sheet = this.getters.getActiveSheet();
        // first, add missing cols/rows if needed
        this.addMissingDimensions(sheet, width, height, col, row);
        // then, perform the actual paste operation
        for (let r = 0; r < height; r++) {
            const rowCells = state.cells[r];
            for (let c = 0; c < width; c++) {
                const origin = rowCells[c];
                const position = { col: col + c, row: row + r, sheetId: sheet.id };
                this.removeMergeIfTopLeft(position);
                this.pasteMergeIfExist(origin.position, position);
                this.pasteCell(origin, position, state.operation, state.zones, pasteOption);
                if (shouldPasteCF) {
                    this.dispatch("PASTE_CONDITIONAL_FORMAT", {
                        origin: origin.position,
                        target: position,
                        operation: state.operation,
                    });
                }
            }
        }
    }
    /**
     * Add columns and/or rows to ensure that col + width and row + height are still
     * in the sheet
     */
    addMissingDimensions(sheet, width, height, col, row) {
        const { cols, rows, id: sheetId } = sheet;
        const missingRows = height + row - rows.length;
        if (missingRows > 0) {
            this.dispatch("ADD_COLUMNS_ROWS", {
                dimension: "ROW",
                base: rows.length - 1,
                sheetId,
                quantity: missingRows,
                position: "after",
            });
        }
        const missingCols = width + col - cols.length;
        if (missingCols > 0) {
            this.dispatch("ADD_COLUMNS_ROWS", {
                dimension: "COL",
                base: cols.length - 1,
                sheetId,
                quantity: missingCols,
                position: "after",
            });
        }
    }
    /**
     * Paste the cell at the given position to the target position
     */
    pasteCell(origin, target, operation, zones, pasteOption) {
        const { sheetId, col, row } = target;
        const targetCell = this.getters.getCell(sheetId, col, row);
        if (pasteOption !== "onlyValue") {
            const targetBorders = this.getters.getCellBorder(sheetId, col, row);
            const originBorders = origin.border;
            const border = {
                top: (targetBorders === null || targetBorders === void 0 ? void 0 : targetBorders.top) || (originBorders === null || originBorders === void 0 ? void 0 : originBorders.top),
                bottom: (targetBorders === null || targetBorders === void 0 ? void 0 : targetBorders.bottom) || (originBorders === null || originBorders === void 0 ? void 0 : originBorders.bottom),
                left: (targetBorders === null || targetBorders === void 0 ? void 0 : targetBorders.left) || (originBorders === null || originBorders === void 0 ? void 0 : originBorders.left),
                right: (targetBorders === null || targetBorders === void 0 ? void 0 : targetBorders.right) || (originBorders === null || originBorders === void 0 ? void 0 : originBorders.right),
            };
            this.dispatch("SET_BORDER", { sheetId, col, row, border });
        }
        if (origin.cell) {
            if (pasteOption === "onlyFormat") {
                this.dispatch("UPDATE_CELL", {
                    ...target,
                    style: origin.cell.style,
                    format: origin.cell.format,
                });
                return;
            }
            if (pasteOption === "onlyValue") {
                const content = formatValue(origin.cell.evaluated.value);
                this.dispatch("UPDATE_CELL", { ...target, content });
                return;
            }
            let content = origin.cell.content;
            if (origin.cell.isFormula()) {
                const offsetX = col - origin.position.col;
                const offsetY = row - origin.position.row;
                content = this.getUpdatedContent(sheetId, origin.cell, offsetX, offsetY, zones, operation);
            }
            this.dispatch("UPDATE_CELL", {
                ...target,
                content,
                style: origin.cell.style || null,
                format: origin.cell.format,
            });
        }
        else if (targetCell) {
            if (pasteOption === "onlyValue") {
                this.dispatch("UPDATE_CELL", { ...target, content: "" });
            }
            else if (pasteOption === "onlyFormat") {
                this.dispatch("UPDATE_CELL", { ...target, style: null, format: "" });
            }
            else {
                this.dispatch("CLEAR_CELL", target);
            }
        }
    }
    /**
     * Get the newly updated formula, after applying offsets
     */
    getUpdatedContent(sheetId, cell, offsetX, offsetY, zones, operation) {
        if (operation === "CUT") {
            const ranges = [];
            for (const range of cell.dependencies) {
                if (this.isZoneOverlapClippedZone(zones, range.zone)) {
                    ranges.push(...this.getters.createAdaptedRanges([range], offsetX, offsetY, sheetId));
                }
                else {
                    ranges.push(range);
                }
            }
            return this.getters.buildFormulaContent(sheetId, cell, ranges);
        }
        const ranges = this.getters.createAdaptedRanges(cell.dependencies, offsetX, offsetY, sheetId);
        return this.getters.buildFormulaContent(sheetId, cell, ranges);
    }
    /**
     * Check if the given zone and at least one of the clipped zones overlap
     */
    isZoneOverlapClippedZone(zones, zone) {
        return zones.some((clippedZone) => overlap(zone, clippedZone));
    }
    // ---------------------------------------------------------------------------
    // Grid rendering
    // ---------------------------------------------------------------------------
    drawGrid(renderingContext) {
        const { viewport, ctx, thinLineWidth } = renderingContext;
        if (this.status !== "visible" ||
            !this.state ||
            !this.state.zones ||
            !this.state.zones.length ||
            this.state.sheetId !== this.getters.getActiveSheetId()) {
            return;
        }
        ctx.setLineDash([8, 5]);
        ctx.strokeStyle = SELECTION_BORDER_COLOR;
        ctx.lineWidth = 3.3 * thinLineWidth;
        for (const zone of this.state.zones) {
            const [x, y, width, height] = this.getters.getRect(zone, viewport);
            if (width > 0 && height > 0) {
                ctx.strokeRect(x, y, width, height);
            }
        }
    }
}
ClipboardPlugin.layers = [2 /* Clipboard */];
ClipboardPlugin.getters = ["getClipboardContent", "isPaintingFormat"];
ClipboardPlugin.modes = ["normal"];
//# sourceMappingURL=clipboard.js.map