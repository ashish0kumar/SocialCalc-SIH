import { FORMULA_REF_IDENTIFIER } from "../constants";
import { rangeTokenize } from "../formulas/range_tokenizer";
import { cellReference } from "../helpers";
/**
 * parses a formula (as a string) into the same formula,
 * but with the references to other cells extracted
 *
 * =sum(a3:b1) + c3 --> =sum(|0|) + |1|
 *
 * @param formula
 */
export function normalizeV9(formula) {
    const tokens = rangeTokenize(formula);
    let dependencies = [];
    let noRefFormula = "".concat(...tokens.map((token) => {
        if (token.type === "REFERENCE" && cellReference.test(token.value)) {
            const value = token.value.trim();
            if (!dependencies.includes(value)) {
                dependencies.push(value);
            }
            return `${FORMULA_REF_IDENTIFIER}${dependencies.indexOf(value)}${FORMULA_REF_IDENTIFIER}`;
        }
        else {
            return token.value;
        }
    }));
    return { text: noRefFormula, dependencies };
}
//# sourceMappingURL=legacy_tools.js.map