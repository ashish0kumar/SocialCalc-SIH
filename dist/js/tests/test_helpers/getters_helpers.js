import { toCartesian, toXC } from "../../src/helpers/index";
import { CellValueType } from "../../src/types";
import { setSelection } from "./commands_helpers";
/**
 * Get the active XC
 */
export function getActiveXc(model) {
    return toXC(...model.getters.getPosition());
}
/**
 * Get the cell at the given XC
 */
export function getCell(model, xc, sheetId = model.getters.getActiveSheetId()) {
    let [col, row] = toCartesian(xc);
    return model.getters.getCell(sheetId, col, row);
}
export function getCellError(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = getCell(model, xc, sheetId);
    return cell && cell.evaluated.type === CellValueType.error ? cell.evaluated.error : undefined;
}
/**
 * Get the string representation of the content of a cell (the value for formula
 * cell, or the formula, depending on ShowFormula)
 */
export function getCellContent(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = getCell(model, xc, sheetId);
    return cell ? model.getters.getCellText(cell, model.getters.shouldShowFormulas()) : "";
}
/**
 * Get the string representation of the content of a cell, and always formula
 * for formula cells
 */
export function getCellText(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const cell = getCell(model, xc, sheetId);
    return cell ? model.getters.getCellText(cell, true) : "";
}
export function getRangeFormattedValues(model, xc, sheetId = model.getters.getActiveSheetId()) {
    return model.getters.getRangeFormattedValues(model.getters.getRangeFromSheetXC(sheetId, xc));
}
export function getRangeValues(model, xc, sheetId = model.getters.getActiveSheetId()) {
    return model.getters.getRangeValues(model.getters.getRangeFromSheetXC(sheetId, xc));
}
/**
 * Get the sheet at the given index
 */
export function getSheet(model, index = 0) {
    return model.getters.getSheets()[index];
}
/**
 * Get the borders at the given XC
 */
export function getBorder(model, xc, sheetId = model.getters.getActiveSheetId()) {
    const [col, row] = toCartesian(xc);
    return model.getters.getCellBorder(sheetId, col, row);
}
/**
 * Get the list of the merges
 */
export function getMerges(model) {
    const merges = model.getters.getMerges(model.getters.getActiveSheetId());
    return Object.fromEntries(merges.map((merge) => [merge.id, merge]));
}
export function automaticSum(model, xc, { anchor } = {}, sheetId) {
    return automaticSumMulti(model, [xc], { anchor }, sheetId);
}
export function automaticSumMulti(model, xcs, { anchor } = {}, sheetId) {
    if (!sheetId) {
        sheetId = model.getters.getActiveSheetId();
    }
    setSelection(model, xcs, { anchor });
    return model.dispatch("SUM_SELECTION");
}
//# sourceMappingURL=getters_helpers.js.map