import { DATETIME_FORMAT } from "../../constants";
import { groupConsecutive, isInside, isOneDimensional, positions, range, union, zoneToDimension, } from "../../helpers";
import { CellValueType } from "../../types";
import { UIPlugin } from "../ui_plugin";
export class AutomaticSumPlugin extends UIPlugin {
    handle(cmd) {
        switch (cmd.type) {
            case "SUM_SELECTION":
                const sheetId = this.getters.getActiveSheetId();
                const { zones, anchor } = this.getters.getSelection();
                for (const zone of zones) {
                    const sums = this.getAutomaticSums(sheetId, zone, anchor);
                    this.dispatchCellUpdates(sheetId, sums);
                }
                break;
        }
    }
    getAutomaticSums(sheetId, zone, anchor) {
        return this.shouldFindData(sheetId, zone)
            ? this.sumAdjacentData(sheetId, zone, anchor)
            : this.sumData(sheetId, zone);
    }
    // ---------------------------------------------------------------------------
    // Private methods
    // ---------------------------------------------------------------------------
    sumData(sheetId, zone) {
        const dimensions = this.dimensionsToSum(sheetId, zone);
        const sums = this.sumDimensions(sheetId, zone, dimensions).filter(({ zone }) => !this.getters.isEmpty(sheetId, zone));
        if (dimensions.has("ROW") && dimensions.has("COL")) {
            sums.push(this.sumTotal(zone));
        }
        return sums;
    }
    sumAdjacentData(sheetId, zone, anchor) {
        const [col, row] = isInside(anchor[0], anchor[1], zone) ? anchor : [zone.left, zone.top];
        const dataZone = this.findAdjacentData(sheetId, col, row);
        if (!dataZone) {
            return [];
        }
        if (this.getters.isSingleCellOrMerge(sheetId, zone) ||
            isOneDimensional(union(dataZone, zone))) {
            return [{ position: [col, row], zone: dataZone }];
        }
        else {
            return this.sumDimensions(sheetId, union(dataZone, zone), this.transpose(this.dimensionsToSum(sheetId, zone)));
        }
    }
    /**
     * Find a zone to automatically sum a column or row of numbers.
     *
     * We first decide which direction will be summed (column or row).
     * Here is the strategy:
     *  1. If the left cell is a number and the top cell is not: choose horizontal
     *  2. Try to find a valid vertical zone. If it's valid: choose vertical
     *  3. Try to find a valid horizontal zone. If it's valid: choose horizontal
     *  4. Otherwise, no zone is returned
     *
     * Now, how to find a valid zone?
     * The zone starts directly above or on the left of the starting point
     * (depending on the direction).
     * The zone ends where the first continuous sequence of numbers ends.
     * Empty or text cells can be part of the zone while no number has been found.
     * Other kind of cells (boolean, dates, etc.) are not valid in the zone and the
     * search stops immediately if one is found.
     *
     *  -------                                       -------
     * |   1   |                                     |   1   |
     *  -------                                       -------
     * |       |                                     |       |
     *  -------  <= end of the sequence, stop here    -------
     * |   2   |                                     |   2   |
     *  -------                                       -------
     * |   3   | <= start of the number sequence     |   3   |
     *  -------                                       -------
     * |       | <= ignored                          | FALSE | <= invalid, no zone is found
     *  -------                                       -------
     * |   A   | <= ignored                          |   A   | <= ignored
     *  -------                                       -------
     */
    findAdjacentData(sheetId, col, row) {
        const sheet = this.getters.getSheet(sheetId);
        const zone = this.findSuitableZoneToSum(sheet, ...this.getters.getMainCell(sheetId, col, row));
        if (zone) {
            return this.getters.expandZone(sheetId, zone);
        }
        return undefined;
    }
    /**
     * Return the zone to sum if a valid one is found.
     * @see getAutomaticSumZone
     */
    findSuitableZoneToSum(sheet, col, row) {
        const topCell = this.getters.getCell(sheet.id, col, row - 1);
        const leftCell = this.getters.getCell(sheet.id, col - 1, row);
        if (this.isNumber(leftCell) && !this.isNumber(topCell)) {
            return this.findHorizontalZone(sheet, col, row);
        }
        const verticalZone = this.findVerticalZone(sheet, col, row);
        if (this.isZoneValid(verticalZone)) {
            return verticalZone;
        }
        const horizontalZone = this.findHorizontalZone(sheet, col, row);
        if (this.isZoneValid(horizontalZone)) {
            return horizontalZone;
        }
        return undefined;
    }
    findVerticalZone(sheet, col, row) {
        const zone = {
            top: 0,
            bottom: row - 1,
            left: col,
            right: col,
        };
        const top = this.reduceZoneStart(sheet, zone, zone.bottom);
        return { ...zone, top };
    }
    findHorizontalZone(sheet, col, row) {
        const zone = {
            top: row,
            bottom: row,
            left: 0,
            right: col - 1,
        };
        const left = this.reduceZoneStart(sheet, zone, zone.right);
        return { ...zone, left };
    }
    /**
     * Reduces a column or row zone to a valid zone for the automatic sum.
     * @see getAutomaticSumZone
     * @param sheet
     * @param zone one dimensional zone (a single row or a single column). The zone is
     *             assumed to start at the beginning of the column (top=0) or the row (left=0)
     * @param end end index of the zone (`bottom` or `right` depending on the dimension)
     * @returns the starting position of the valid zone or Infinity if the zone is not valid.
     */
    reduceZoneStart(sheet, zone, end) {
        const cells = this.getters.getCellsInZone(sheet.id, zone);
        const cellPositions = range(end, -1, -1);
        const invalidCells = cellPositions.filter((position) => { var _a; return cells[position] && !((_a = cells[position]) === null || _a === void 0 ? void 0 : _a.isAutoSummable); });
        const maxValidPosition = Math.max(...invalidCells);
        const numberSequences = groupConsecutive(cellPositions.filter((position) => this.isNumber(cells[position])));
        const firstSequence = numberSequences[0] || [];
        if (Math.max(...firstSequence) < maxValidPosition) {
            return Infinity;
        }
        return Math.min(...firstSequence);
    }
    shouldFindData(sheetId, zone) {
        return this.getters.isEmpty(sheetId, zone) || this.getters.isSingleCellOrMerge(sheetId, zone);
    }
    isNumber(cell) {
        var _a;
        return (cell === null || cell === void 0 ? void 0 : cell.evaluated.type) === CellValueType.number && !((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT));
    }
    isZoneValid(zone) {
        return zone.bottom >= zone.top && zone.right >= zone.left;
    }
    lastColIsEmpty(sheetId, zone) {
        return this.getters.isEmpty(sheetId, { ...zone, left: zone.right });
    }
    lastRowIsEmpty(sheetId, zone) {
        return this.getters.isEmpty(sheetId, { ...zone, top: zone.bottom });
    }
    /**
     * Decides which dimensions (columns or rows) should be summed
     * based on its shape and what's inside the zone.
     */
    dimensionsToSum(sheetId, zone) {
        const dimensions = new Set();
        if (isOneDimensional(zone)) {
            dimensions.add(zoneToDimension(zone).width === 1 ? "COL" : "ROW");
            return dimensions;
        }
        if (this.lastColIsEmpty(sheetId, zone)) {
            dimensions.add("ROW");
        }
        if (this.lastRowIsEmpty(sheetId, zone)) {
            dimensions.add("COL");
        }
        if (dimensions.size === 0) {
            dimensions.add("COL");
        }
        return dimensions;
    }
    /**
     * Sum each column and/or row in the zone in the appropriate cells,
     * depending on the available space.
     */
    sumDimensions(sheetId, zone, dimensions) {
        return [
            ...(dimensions.has("COL") ? this.sumColumns(zone, sheetId) : []),
            ...(dimensions.has("ROW") ? this.sumRows(zone, sheetId) : []),
        ];
    }
    /**
     * Sum the total of the zone in the bottom right cell, assuming
     * the last row contains summed columns.
     */
    sumTotal(zone) {
        const { bottom, right } = zone;
        return { position: [right, bottom], zone: { ...zone, top: bottom, right: right - 1 } };
    }
    sumColumns(zone, sheetId) {
        const target = this.nextEmptyRow(sheetId, { ...zone, bottom: zone.bottom - 1 });
        zone = { ...zone, bottom: Math.min(zone.bottom, target.bottom - 1) };
        return positions(target).map((position) => ({
            position,
            zone: { ...zone, right: position[0], left: position[0] },
        }));
    }
    sumRows(zone, sheetId) {
        const target = this.nextEmptyCol(sheetId, { ...zone, right: zone.right - 1 });
        zone = { ...zone, right: Math.min(zone.right, target.right - 1) };
        return positions(target).map((position) => ({
            position,
            zone: { ...zone, top: position[1], bottom: position[1] },
        }));
    }
    dispatchCellUpdates(sheetId, sums) {
        for (const sum of sums) {
            const [col, row] = sum.position;
            this.dispatch("UPDATE_CELL", {
                sheetId,
                col,
                row,
                content: `=SUM(${this.getters.zoneToXC(sheetId, sum.zone)})`,
            });
        }
    }
    /**
     * Find the first row where all cells below the zone are empty.
     */
    nextEmptyRow(sheetId, zone) {
        let start = zone.bottom + 1;
        const { left, right } = zone;
        while (!this.getters.isEmpty(sheetId, { bottom: start, top: start, left, right })) {
            start++;
        }
        return {
            ...zone,
            top: start,
            bottom: start,
        };
    }
    /**
     * Find the first column where all cells right of the zone are empty.
     */
    nextEmptyCol(sheetId, zone) {
        let start = zone.right + 1;
        const { top, bottom } = zone;
        while (!this.getters.isEmpty(sheetId, { left: start, right: start, top, bottom })) {
            start++;
        }
        return {
            ...zone,
            left: start,
            right: start,
        };
    }
    /**
     * Transpose the given dimensions.
     * COL becomes ROW
     * ROW becomes COL
     */
    transpose(dimensions) {
        return new Set([...dimensions.values()].map((dimension) => (dimension === "COL" ? "ROW" : "COL")));
    }
}
AutomaticSumPlugin.getters = ["getAutomaticSums"];
AutomaticSumPlugin.modes = ["normal", "headless"];
//# sourceMappingURL=automatic_sum.js.map