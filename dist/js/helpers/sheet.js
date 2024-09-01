import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "../constants";
import { numberToLetters } from "./coordinates";
export function createDefaultCols(colNumber) {
    const cols = [];
    let current = 0;
    for (let i = 0; i < colNumber; i++) {
        const size = DEFAULT_CELL_WIDTH;
        const col = {
            start: current,
            end: current + size,
            size: size,
            name: numberToLetters(i),
        };
        cols.push(col);
        current = col.end;
    }
    return cols;
}
export function createDefaultRows(rowNumber) {
    const rows = [];
    let current = 0;
    for (let i = 0; i < rowNumber; i++) {
        const size = DEFAULT_CELL_HEIGHT;
        const row = {
            start: current,
            end: current + size,
            size: size,
            name: String(i + 1),
            cells: {},
        };
        rows.push(row);
        current = row.end;
    }
    return rows;
}
export function createCols(savedCols, colNumber) {
    var _a;
    const cols = [];
    let current = 0;
    for (let i = 0; i < colNumber; i++) {
        const size = savedCols[i] ? savedCols[i].size || DEFAULT_CELL_WIDTH : DEFAULT_CELL_WIDTH;
        const hidden = ((_a = savedCols[i]) === null || _a === void 0 ? void 0 : _a.isHidden) || false;
        const end = hidden ? current : current + size;
        const col = {
            start: current,
            end: end,
            size: size,
            name: numberToLetters(i),
        };
        if (hidden) {
            col.isHidden = hidden;
        }
        cols.push(col);
        current = col.end;
    }
    return cols;
}
export function createRows(savedRows, rowNumber) {
    var _a;
    const rows = [];
    let current = 0;
    for (let i = 0; i < rowNumber; i++) {
        const size = savedRows[i] ? savedRows[i].size || DEFAULT_CELL_HEIGHT : DEFAULT_CELL_HEIGHT;
        const hidden = ((_a = savedRows[i]) === null || _a === void 0 ? void 0 : _a.isHidden) || false;
        const end = hidden ? current : current + size;
        const row = {
            start: current,
            end: end,
            size: size,
            name: String(i + 1),
            cells: {},
        };
        if (hidden) {
            row.isHidden = hidden;
        }
        rows.push(row);
        current = row.end;
    }
    return rows;
}
export function exportCols(cols, exportDefaults = false) {
    const exportedCols = {};
    for (let i in cols) {
        const col = cols[i];
        if (col.size !== DEFAULT_CELL_WIDTH || exportDefaults) {
            exportedCols[i] = { size: col.size };
        }
        if (col.isHidden) {
            exportedCols[i] = exportedCols[i] || {};
            exportedCols[i]["isHidden"] = col.isHidden;
        }
    }
    return exportedCols;
}
export function exportRows(rows, exportDefaults = false) {
    const exportedRows = {};
    for (let i in rows) {
        const row = rows[i];
        if (row.size !== DEFAULT_CELL_HEIGHT || exportDefaults) {
            exportedRows[i] = { size: row.size };
        }
        if (row.isHidden) {
            exportedRows[i] = exportedRows[i] || {};
            exportedRows[i]["isHidden"] = row.isHidden;
        }
    }
    return exportedRows;
}
//# sourceMappingURL=sheet.js.map