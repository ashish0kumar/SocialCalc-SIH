import { _lt } from "../translation";
import { CellValueType, DispatchResult, } from "../types";
import { isEqual } from "./zones";
const SORT_TYPES = [
    CellValueType.number,
    CellValueType.error,
    CellValueType.text,
    CellValueType.boolean,
];
function convertCell(cell, index) {
    return {
        index,
        type: cell ? cell.evaluated.type : CellValueType.empty,
        value: cell ? cell.evaluated.value : "",
    };
}
export function sortCells(cells, sortDirection) {
    const cellsWithIndex = cells.map(convertCell);
    const emptyCells = cellsWithIndex.filter((x) => x.type === CellValueType.empty);
    const nonEmptyCells = cellsWithIndex.filter((x) => x.type !== CellValueType.empty);
    const inverse = sortDirection === "descending" ? -1 : 1;
    return nonEmptyCells
        .sort((left, right) => {
        let typeOrder = SORT_TYPES.indexOf(left.type) - SORT_TYPES.indexOf(right.type);
        if (typeOrder === 0) {
            if (left.type === CellValueType.text || left.type === CellValueType.error) {
                typeOrder = left.value.localeCompare(right.value);
            }
            else
                typeOrder = left.value - right.value;
        }
        return inverse * typeOrder;
    })
        .concat(emptyCells);
}
export function interactiveSortSelection(env, sheetId, anchor, zone, sortDirection) {
    let result = DispatchResult.Success;
    //several columns => bypass the contiguity check
    let multiColumns = zone.right > zone.left;
    if (env.model.getters.doesIntersectMerge(sheetId, zone)) {
        multiColumns = false;
        let table;
        for (let r = zone.top; r <= zone.bottom; r++) {
            table = [];
            for (let c = zone.left; c <= zone.right; c++) {
                let merge = env.model.getters.getMerge(sheetId, c, r);
                if (merge && !table.includes(merge.id.toString())) {
                    table.push(merge.id.toString());
                }
            }
            if (table.length >= 2) {
                multiColumns = true;
                break;
            }
        }
    }
    const [col, row] = anchor;
    if (multiColumns) {
        result = env.model.dispatch("SORT_CELLS", { sheetId, col, row, zone, sortDirection });
    }
    else {
        // check contiguity
        const contiguousZone = env.model.getters.getContiguousZone(sheetId, zone);
        if (isEqual(contiguousZone, zone)) {
            // merge as it is
            result = env.model.dispatch("SORT_CELLS", {
                sheetId,
                col,
                row,
                zone,
                sortDirection,
            });
        }
        else {
            env.askConfirmation(_lt("We found data next to your selection. Since this data was not selected, it will not be sorted. Do you want to extend your selection?"), () => {
                zone = contiguousZone;
                result = env.model.dispatch("SORT_CELLS", {
                    sheetId,
                    col,
                    row,
                    zone,
                    sortDirection,
                });
            }, () => {
                result = env.model.dispatch("SORT_CELLS", {
                    sheetId,
                    col,
                    row,
                    zone,
                    sortDirection,
                });
            });
        }
    }
    if (result.isCancelledBecause(46 /* InvalidSortZone */)) {
        const [col, row] = anchor;
        env.model.selection.selectZone({ cell: { col, row }, zone });
        env.notifyUser(_lt("Cannot sort. To sort, select only cells or only merges that have the same size."));
    }
}
//# sourceMappingURL=sort.js.map