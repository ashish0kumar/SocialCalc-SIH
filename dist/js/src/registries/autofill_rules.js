import { DATETIME_FORMAT } from "../constants";
import { Registry } from "../registry";
import { CellValueType } from "../types/index";
export const autofillRulesRegistry = new Registry();
/**
 * Get the consecutive xc that are of type "number" or "date".
 * Return the one which contains the given cell
 */
function getGroup(cell, cells) {
    let group = [];
    let found = false;
    for (let x of cells) {
        if (x === cell) {
            found = true;
        }
        if ((x === null || x === void 0 ? void 0 : x.evaluated.type) === CellValueType.number) {
            group.push(x.evaluated.value);
        }
        else {
            if (found) {
                return group;
            }
            group = [];
        }
    }
    return group;
}
/**
 * Get the average steps between numbers
 */
function getAverageIncrement(group) {
    const averages = [];
    let last = group[0];
    for (let i = 1; i < group.length; i++) {
        const current = group[i];
        averages.push(current - last);
        last = current;
    }
    return averages.reduce((a, b) => a + b, 0) / averages.length;
}
autofillRulesRegistry
    .add("simple_value_copy", {
    condition: (cell, cells) => {
        var _a;
        return cells.length === 1 && !cell.isFormula() && !((_a = cell.format) === null || _a === void 0 ? void 0 : _a.match(DATETIME_FORMAT));
    },
    generateRule: () => {
        return { type: "COPY_MODIFIER" };
    },
    sequence: 10,
})
    .add("copy_text", {
    condition: (cell) => !cell.isFormula() && cell.evaluated.type === CellValueType.text,
    generateRule: () => {
        return { type: "COPY_MODIFIER" };
    },
    sequence: 20,
})
    .add("update_formula", {
    condition: (cell) => cell.isFormula(),
    generateRule: (_, cells) => {
        return { type: "FORMULA_MODIFIER", increment: cells.length, current: 0 };
    },
    sequence: 30,
})
    .add("increment_number", {
    condition: (cell) => cell.evaluated.type === CellValueType.number,
    generateRule: (cell, cells) => {
        const group = getGroup(cell, cells);
        let increment = 1;
        if (group.length == 2) {
            increment = (group[1] - group[0]) * 2;
        }
        else if (group.length > 2) {
            increment = getAverageIncrement(group) * group.length;
        }
        return {
            type: "INCREMENT_MODIFIER",
            increment,
            current: cell.evaluated.type === CellValueType.number ? cell.evaluated.value : 0,
        };
    },
    sequence: 40,
});
//# sourceMappingURL=autofill_rules.js.map