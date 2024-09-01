import { range } from "./misc";
export function getNextVisibleCellCoords(sheet, col, row) {
    return [
        findVisibleHeader(sheet, "cols", range(col, sheet.cols.length)),
        findVisibleHeader(sheet, "rows", range(row, sheet.rows.length)),
    ];
}
export function findVisibleHeader(sheet, dimension, indexes) {
    const headers = sheet[dimension];
    return indexes.find((index) => headers[index] && !headers[index].isHidden);
}
export function findLastVisibleColRow(sheet, dimension) {
    let lastIndex = sheet[dimension].length - 1;
    while (lastIndex >= 0 && sheet[dimension][lastIndex].isHidden === true) {
        lastIndex--;
    }
    return sheet[dimension][lastIndex];
}
export function findFirstVisibleColRow(sheet, dimension) {
    return sheet[dimension].find((header) => !header.isHidden);
}
//# sourceMappingURL=visibility.js.map