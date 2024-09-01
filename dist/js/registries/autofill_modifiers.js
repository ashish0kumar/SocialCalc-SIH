import { formatValue } from "../helpers/cells/index";
import { Registry } from "../registry";
/**
 * An AutofillModifierImplementation is used to describe how to handle a
 * AutofillModifier.
 */
export const autofillModifiersRegistry = new Registry();
autofillModifiersRegistry
    .add("INCREMENT_MODIFIER", {
    apply: (rule, data) => {
        var _a;
        rule.current += rule.increment;
        const content = rule.current.toString();
        const tooltipValue = formatValue(rule.current, (_a = data.cell) === null || _a === void 0 ? void 0 : _a.format);
        return {
            cellData: {
                border: data.border,
                style: data.cell && data.cell.style,
                format: data.cell && data.cell.format,
                content,
            },
            tooltip: content ? { props: { content: tooltipValue } } : undefined,
        };
    },
})
    .add("COPY_MODIFIER", {
    apply: (rule, data, getters) => {
        var _a, _b;
        const content = ((_a = data.cell) === null || _a === void 0 ? void 0 : _a.content) || "";
        return {
            cellData: {
                border: data.border,
                style: data.cell && data.cell.style,
                format: data.cell && data.cell.format,
                content,
            },
            tooltip: content ? { props: { content: (_b = data.cell) === null || _b === void 0 ? void 0 : _b.formattedValue } } : undefined,
        };
    },
})
    .add("FORMULA_MODIFIER", {
    apply: (rule, data, getters, direction) => {
        rule.current += rule.increment;
        let x = 0;
        let y = 0;
        switch (direction) {
            case 0 /* UP */:
                x = 0;
                y = -rule.current;
                break;
            case 1 /* DOWN */:
                x = 0;
                y = rule.current;
                break;
            case 2 /* LEFT */:
                x = -rule.current;
                y = 0;
                break;
            case 3 /* RIGHT */:
                x = rule.current;
                y = 0;
                break;
        }
        if (!data.cell || !data.cell.isFormula()) {
            return { cellData: {} };
        }
        const sheetId = data.sheetId;
        const ranges = getters.createAdaptedRanges(data.cell.dependencies, x, y, sheetId);
        const content = getters.buildFormulaContent(sheetId, data.cell, ranges);
        return {
            cellData: {
                border: data.border,
                style: data.cell.style,
                format: data.cell.format,
                content,
            },
            tooltip: content ? { props: { content } } : undefined,
        };
    },
});
//# sourceMappingURL=autofill_modifiers.js.map