import { concat } from "../helpers";
import { tokenize } from "./tokenizer";
/**
 * finds a sequence of token that represent a range and replace them with a single token
 * The range can be
 *  ?spaces symbol ?spaces operator: ?spaces symbol ?spaces
 */
export function mergeSymbolsIntoRanges(result, removeSpace = false) {
    let operator = undefined;
    let refStart = undefined;
    let refEnd = undefined;
    let startIncludingSpaces = undefined;
    const reset = () => {
        startIncludingSpaces = undefined;
        refStart = undefined;
        operator = undefined;
        refEnd = undefined;
    };
    for (let i = 0; i < result.length; i++) {
        const token = result[i];
        if (startIncludingSpaces) {
            if (refStart) {
                if (token.type === "SPACE") {
                    continue;
                }
                else if (token.type === "OPERATOR" && token.value === ":") {
                    operator = i;
                }
                else if (operator && token.type === "REFERENCE") {
                    refEnd = i;
                }
                else {
                    if (startIncludingSpaces && refStart && operator && refEnd) {
                        const newToken = {
                            type: "REFERENCE",
                            value: concat(result
                                .slice(startIncludingSpaces, i)
                                .filter((x) => !removeSpace || x.type !== "SPACE")
                                .map((x) => x.value)),
                        };
                        result.splice(startIncludingSpaces, i - startIncludingSpaces, newToken);
                        i = startIncludingSpaces + 1;
                        reset();
                    }
                    else {
                        if (token.type === "REFERENCE") {
                            startIncludingSpaces = i;
                            refStart = i;
                            operator = undefined;
                        }
                        else {
                            reset();
                        }
                    }
                }
            }
            else {
                if (token.type === "REFERENCE") {
                    refStart = i;
                    operator = refEnd = undefined;
                }
                else {
                    reset();
                }
            }
        }
        else {
            if (["SPACE", "REFERENCE"].includes(token.type)) {
                startIncludingSpaces = i;
                refStart = token.type === "REFERENCE" ? i : undefined;
                operator = refEnd = undefined;
            }
            else {
                reset();
            }
        }
    }
    const i = result.length - 1;
    if (startIncludingSpaces && refStart && operator && refEnd) {
        const newToken = {
            type: "REFERENCE",
            value: concat(result
                .slice(startIncludingSpaces, i + 1)
                .filter((x) => !removeSpace || x.type !== "SPACE")
                .map((x) => x.value)),
        };
        result.splice(startIncludingSpaces, i - startIncludingSpaces + 1, newToken);
    }
    return result;
}
/**
 * Take the result of the tokenizer and transform it to be usable in the
 * manipulations of range
 *
 * @param formula
 */
export function rangeTokenize(formula) {
    const tokens = tokenize(formula);
    return mergeSymbolsIntoRanges(tokens, true);
}
//# sourceMappingURL=range_tokenizer.js.map