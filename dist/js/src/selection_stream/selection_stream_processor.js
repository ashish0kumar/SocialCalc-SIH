import { findVisibleHeader, isEqual, isInside, organizeZone, positionToZone, range, union, } from "../helpers";
import { DispatchResult, } from "../types";
import { EventStream } from "./event_stream";
/**
 * Processes all selection updates (usually from user inputs) and emits an event
 * with the new selected anchor
 */
export class SelectionStreamProcessor {
    constructor(getters) {
        this.getters = getters;
        this.stream = new EventStream();
        this.anchor = { cell: { col: 0, row: 0 }, zone: positionToZone({ col: 0, row: 0 }) };
        this.defaultAnchor = this.anchor;
    }
    capture(owner, anchor, callbacks) {
        this.stream.capture(owner, callbacks);
        this.anchor = anchor;
    }
    /**
     * Register as default subscriber and capture the event stream.
     */
    registerAsDefault(owner, anchor, callbacks) {
        this.stream.registerAsDefault(owner, callbacks);
        this.defaultAnchor = anchor;
        this.capture(owner, anchor, callbacks);
    }
    resetDefaultAnchor(owner, anchor) {
        if (this.stream.isListening(owner)) {
            this.anchor = anchor;
        }
        this.defaultAnchor = anchor;
    }
    resetAnchor(owner, anchor) {
        if (this.stream.isListening(owner)) {
            this.anchor = anchor;
        }
    }
    observe(owner, callbacks) {
        this.stream.observe(owner, callbacks);
    }
    release(owner) {
        this.stream.release(owner);
        this.anchor = this.defaultAnchor;
    }
    /**
     * Select a new anchor
     */
    selectZone(anchor) {
        const sheetId = this.getters.getActiveSheetId();
        anchor = {
            ...anchor,
            zone: this.getters.expandZone(sheetId, anchor.zone),
        };
        return this.processEvent({
            type: "ZonesSelected",
            anchor,
            mode: "overrideSelection",
        });
    }
    /**
     * Select a single cell as the new anchor.
     */
    selectCell(col, row) {
        const zone = positionToZone({ col, row });
        return this.selectZone({ zone, cell: { col, row } });
    }
    /**
     * Set the selection to one of the cells adjacent to the current anchor cell.
     */
    moveAnchorCell(deltaCol, deltaRow) {
        const { col, row } = this.getNextAvailablePosition(deltaCol, deltaRow);
        return this.selectCell(col, row);
    }
    /**
     * Update the current anchor such that it includes the given
     * cell position.
     */
    setAnchorCorner(col, row) {
        const sheetId = this.getters.getActiveSheetId();
        const { col: anchorCol, row: anchorRow } = this.anchor.cell;
        const zone = {
            left: Math.min(anchorCol, col),
            top: Math.min(anchorRow, row),
            right: Math.max(anchorCol, col),
            bottom: Math.max(anchorRow, row),
        };
        const expandedZone = this.getters.expandZone(sheetId, zone);
        const anchor = { zone: expandedZone, cell: { col: anchorCol, row: anchorRow } };
        return this.processEvent({
            type: "AlterZoneCorner",
            mode: "updateAnchor",
            anchor: anchor,
        });
    }
    /**
     * Add a new cell to the current selection
     */
    addCellToSelection(col, row) {
        const sheetId = this.getters.getActiveSheetId();
        [col, row] = this.getters.getMainCell(sheetId, col, row);
        const zone = positionToZone({ col, row });
        return this.processEvent({
            type: "ZonesSelected",
            anchor: { zone, cell: { col, row } },
            mode: "newAnchor",
        });
    }
    /**
     * Increase or decrease the size of the current anchor zone.
     * The anchor cell remains where it is. It's the opposite side
     * of the anchor zone which moves.
     */
    resizeAnchorZone(deltaCol, deltaRow) {
        const sheet = this.getters.getActiveSheet();
        const anchor = this.anchor;
        const { col: anchorCol, row: anchorRow } = anchor.cell;
        const { left, right, top, bottom } = anchor.zone;
        let result = anchor.zone;
        const expand = (z) => {
            z = organizeZone(z);
            const { left, right, top, bottom } = this.getters.expandZone(sheet.id, z);
            return {
                left: Math.max(0, left),
                right: Math.min(sheet.cols.length - 1, right),
                top: Math.max(0, top),
                bottom: Math.min(sheet.rows.length - 1, bottom),
            };
        };
        const { col: refCol, row: refRow } = this.getReferencePosition();
        // check if we can shrink selection
        let n = 0;
        while (result !== null) {
            n++;
            if (deltaCol < 0) {
                const newRight = this.getNextAvailableCol(deltaCol, right - (n - 1), refRow);
                result = refCol <= right - n ? expand({ top, left, bottom, right: newRight }) : null;
            }
            if (deltaCol > 0) {
                const newLeft = this.getNextAvailableCol(deltaCol, left + (n - 1), refRow);
                result = left + n <= refCol ? expand({ top, left: newLeft, bottom, right }) : null;
            }
            if (deltaRow < 0) {
                const newBottom = this.getNextAvailableRow(deltaRow, refCol, bottom - (n - 1));
                result = refRow <= bottom - n ? expand({ top, left, bottom: newBottom, right }) : null;
            }
            if (deltaRow > 0) {
                const newTop = this.getNextAvailableRow(deltaRow, refCol, top + (n - 1));
                result = top + n <= refRow ? expand({ top: newTop, left, bottom, right }) : null;
            }
            result = result ? organizeZone(result) : result;
            if (result && !isEqual(result, anchor.zone)) {
                return this.processEvent({
                    type: "ZonesSelected",
                    mode: "updateAnchor",
                    anchor: { zone: result, cell: { col: anchorCol, row: anchorRow } },
                });
            }
        }
        const currentZone = {
            top: anchorRow,
            bottom: anchorRow,
            left: anchorCol,
            right: anchorCol,
        };
        const zoneWithDelta = organizeZone({
            top: this.getNextAvailableRow(deltaRow, refCol, top),
            left: this.getNextAvailableCol(deltaCol, left, refRow),
            bottom: this.getNextAvailableRow(deltaRow, refCol, bottom),
            right: this.getNextAvailableCol(deltaCol, right, refRow),
        });
        result = expand(union(currentZone, zoneWithDelta));
        const newAnchor = { zone: result, cell: { col: anchorCol, row: anchorRow } };
        return this.processEvent({
            type: "ZonesSelected",
            anchor: newAnchor,
            mode: "updateAnchor",
        });
    }
    selectColumn(index, mode) {
        const sheet = this.getters.getActiveSheet();
        const bottom = sheet.rows.length - 1;
        let zone = { left: index, right: index, top: 0, bottom };
        const top = sheet.rows.findIndex((row) => !row.isHidden);
        let col, row;
        switch (mode) {
            case "overrideSelection":
            case "newAnchor":
                col = index;
                row = top;
                break;
            case "updateAnchor":
                ({ col, row } = this.anchor.cell);
                zone = union(zone, { left: col, right: col, top, bottom });
                break;
        }
        return this.processEvent({
            type: "HeadersSelected",
            anchor: { zone, cell: { col, row } },
            mode,
        });
    }
    selectRow(index, mode) {
        const right = this.getters.getActiveSheet().cols.length - 1;
        let zone = { top: index, bottom: index, left: 0, right };
        const left = this.getters.getActiveSheet().cols.findIndex((col) => !col.isHidden);
        let col, row;
        switch (mode) {
            case "overrideSelection":
            case "newAnchor":
                col = left;
                row = index;
                break;
            case "updateAnchor":
                ({ col, row } = this.anchor.cell);
                zone = union(zone, { left, right, top: row, bottom: row });
                break;
        }
        return this.processEvent({
            type: "HeadersSelected",
            anchor: { zone, cell: { col, row } },
            mode,
        });
    }
    /**
     * Select the entire sheet
     */
    selectAll() {
        const sheet = this.getters.getActiveSheet();
        const bottom = sheet.rows.length - 1;
        const right = sheet.cols.length - 1;
        const zone = { left: 0, top: 0, bottom, right };
        return this.processEvent({
            type: "HeadersSelected",
            mode: "overrideSelection",
            anchor: { zone, cell: { col: 0, row: 0 } },
        });
    }
    /**
     * Process a new anchor selection event. If the new anchor is inside
     * the sheet boundaries, the event is pushed to the event stream to
     * be processed.
     */
    processEvent(newAnchorEvent) {
        const event = { ...newAnchorEvent, previousAnchor: this.anchor };
        const commandResult = this.checkAnchorZone(event);
        if (commandResult !== 0 /* Success */) {
            return new DispatchResult(commandResult);
        }
        this.anchor = event.anchor;
        this.stream.send(event);
        return DispatchResult.Success;
    }
    checkAnchorZone(event) {
        const { cell, zone } = event.anchor;
        if (!isInside(cell.col, cell.row, zone)) {
            return 14 /* InvalidAnchorZone */;
        }
        const { left, right, top, bottom } = zone;
        const sheet = this.getters.getActiveSheet();
        const refCol = findVisibleHeader(sheet, "cols", range(left, right + 1));
        const refRow = findVisibleHeader(sheet, "rows", range(top, bottom + 1));
        if (refRow === undefined || refCol === undefined) {
            return 15 /* SelectionOutOfBound */;
        }
        return 0 /* Success */;
    }
    /**
     *  ---- PRIVATE ----
     */
    /** Computes the next cell position in the direction of deltaX and deltaY
     * by crossing through merges and skipping hidden cells.
     * Note that the resulting position might be out of the sheet, it needs to be validated.
     */
    getNextAvailablePosition(deltaX, deltaY) {
        const { col, row } = this.anchor.cell;
        return {
            col: this.getNextAvailableCol(deltaX, col, row),
            row: this.getNextAvailableRow(deltaY, col, row),
        };
    }
    getNextAvailableCol(delta, colIndex, rowIndex) {
        const { cols, id: sheetId } = this.getters.getActiveSheet();
        const position = { col: colIndex, row: rowIndex };
        const isInPositionMerge = (nextCol) => this.getters.isInSameMerge(sheetId, colIndex, rowIndex, nextCol, rowIndex);
        return this.getNextAvailableHeader(delta, cols, colIndex, position, isInPositionMerge);
    }
    getNextAvailableRow(delta, colIndex, rowIndex) {
        const { rows, id: sheetId } = this.getters.getActiveSheet();
        const position = { col: colIndex, row: rowIndex };
        const isInPositionMerge = (nextRow) => this.getters.isInSameMerge(sheetId, colIndex, rowIndex, colIndex, nextRow);
        return this.getNextAvailableHeader(delta, rows, rowIndex, position, isInPositionMerge);
    }
    getNextAvailableHeader(delta, headers, startingHeaderIndex, position, isInPositionMerge) {
        var _a, _b, _c;
        const sheetId = this.getters.getActiveSheetId();
        const { col, row } = position;
        if (delta === 0) {
            return startingHeaderIndex;
        }
        let header = startingHeaderIndex + delta;
        if (this.getters.isInMerge(sheetId, col, row)) {
            while (isInPositionMerge(header)) {
                header += delta;
            }
            while ((_a = headers[header]) === null || _a === void 0 ? void 0 : _a.isHidden) {
                header += delta;
            }
        }
        else if ((_b = headers[header]) === null || _b === void 0 ? void 0 : _b.isHidden) {
            while ((_c = headers[header]) === null || _c === void 0 ? void 0 : _c.isHidden) {
                header += delta;
            }
        }
        const outOfBound = header < 0 || header > headers.length - 1;
        if (outOfBound) {
            if (headers[startingHeaderIndex].isHidden) {
                return this.getNextAvailableHeader(-delta, headers, startingHeaderIndex, position, isInPositionMerge);
            }
            else {
                return startingHeaderIndex;
            }
        }
        return header;
    }
    /**
     * Finds a visible cell in the currently selected zone starting with the anchor.
     * If the anchor is hidden, browses from left to right and top to bottom to
     * find a visible cell.
     */
    getReferencePosition() {
        const sheet = this.getters.getActiveSheet();
        const anchor = this.anchor;
        const { left, right, top, bottom } = anchor.zone;
        const { col: anchorCol, row: anchorRow } = anchor.cell;
        return {
            col: sheet.cols[anchorCol].isHidden
                ? findVisibleHeader(sheet, "cols", range(left, right + 1)) || anchorCol
                : anchorCol,
            row: sheet.rows[anchorRow].isHidden
                ? findVisibleHeader(sheet, "rows", range(top, bottom + 1)) || anchorRow
                : anchorRow,
        };
    }
}
//# sourceMappingURL=selection_stream_processor.js.map