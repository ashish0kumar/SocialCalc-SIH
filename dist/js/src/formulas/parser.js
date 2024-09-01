import { DEFAULT_ERROR_MESSAGE } from "../constants";
import { parseNumber, removeStringQuotes } from "../helpers/index";
import { _lt } from "../translation";
import { InvalidReferenceError } from "../types/errors";
import { tokenize } from "./tokenizer";
const UNARY_OPERATORS = ["-", "+"];
const ASSOCIATIVE_OPERATORS = ["*", "+", "&"];
const OP_PRIORITY = {
    "^": 30,
    "*": 20,
    "/": 20,
    "+": 15,
    "-": 15,
    "&": 13,
    ">": 10,
    "<>": 10,
    ">=": 10,
    "<": 10,
    "<=": 10,
    "=": 10,
};
const FUNCTION_BP = 6;
function bindingPower(token) {
    switch (token.type) {
        case "NUMBER":
        case "SYMBOL":
        case "REFERENCE":
            return 0;
        case "COMMA":
            return 3;
        case "LEFT_PAREN":
            return 5;
        case "RIGHT_PAREN":
            return 5;
        case "OPERATOR":
            return OP_PRIORITY[token.value] || 15;
    }
    throw new Error(_lt("Unknown token: %s", token.value));
}
function parsePrefix(current, tokens) {
    var _a, _b;
    switch (current.type) {
        case "DEBUGGER":
            const next = parseExpression(tokens, 1000);
            next.debug = true;
            return next;
        case "NUMBER":
            return { type: "NUMBER", value: parseNumber(current.value) };
        case "STRING":
            return { type: "STRING", value: removeStringQuotes(current.value) };
        case "FUNCTION":
            if (tokens.shift().type !== "LEFT_PAREN") {
                throw new Error(_lt("Wrong function call"));
            }
            else {
                const args = [];
                if (tokens[0].type !== "RIGHT_PAREN") {
                    if (tokens[0].type === "COMMA") {
                        args.push({ type: "UNKNOWN", value: "" });
                    }
                    else {
                        args.push(parseExpression(tokens, FUNCTION_BP));
                    }
                    while (tokens[0].type === "COMMA") {
                        tokens.shift();
                        if (tokens[0].type === "RIGHT_PAREN") {
                            args.push({ type: "UNKNOWN", value: "" });
                            break;
                        }
                        if (tokens[0].type === "COMMA") {
                            args.push({ type: "UNKNOWN", value: "" });
                        }
                        else {
                            args.push(parseExpression(tokens, FUNCTION_BP));
                        }
                    }
                }
                if (tokens.shift().type !== "RIGHT_PAREN") {
                    throw new Error(_lt("Wrong function call"));
                }
                return { type: "FUNCALL", value: current.value, args };
            }
        case "INVALID_REFERENCE":
            throw new InvalidReferenceError();
        case "REFERENCE":
            if (((_a = tokens[0]) === null || _a === void 0 ? void 0 : _a.value) === ":" && ((_b = tokens[1]) === null || _b === void 0 ? void 0 : _b.type) === "REFERENCE") {
                tokens.shift();
                const rightReference = tokens.shift();
                return {
                    type: "REFERENCE",
                    value: `${current.value}:${rightReference === null || rightReference === void 0 ? void 0 : rightReference.value}`,
                };
            }
            return {
                type: "REFERENCE",
                value: current.value,
            };
        case "SYMBOL":
            if (["TRUE", "FALSE"].includes(current.value.toUpperCase())) {
                return { type: "BOOLEAN", value: current.value.toUpperCase() === "TRUE" };
            }
            else {
                if (current.value) {
                    throw new Error(_lt("Invalid formula"));
                }
                return { type: "STRING", value: current.value };
            }
        case "LEFT_PAREN":
            const result = parseExpression(tokens, 5);
            if (!tokens.length || tokens[0].type !== "RIGHT_PAREN") {
                throw new Error(_lt("Unmatched left parenthesis"));
            }
            tokens.shift();
            return result;
        default:
            if (current.type === "OPERATOR" && UNARY_OPERATORS.includes(current.value)) {
                return {
                    type: "UNARY_OPERATION",
                    value: current.value,
                    right: parseExpression(tokens, OP_PRIORITY[current.value]),
                };
            }
            throw new Error(_lt("Unexpected token: %s", current.value));
    }
}
function parseInfix(left, current, tokens) {
    if (current.type === "OPERATOR") {
        const bp = bindingPower(current);
        const right = parseExpression(tokens, bp);
        return {
            type: "BIN_OPERATION",
            value: current.value,
            left,
            right,
        };
    }
    throw new Error(DEFAULT_ERROR_MESSAGE);
}
function parseExpression(tokens, bp) {
    const token = tokens.shift();
    if (!token) {
        throw new Error(DEFAULT_ERROR_MESSAGE);
    }
    let expr = parsePrefix(token, tokens);
    while (tokens[0] && bindingPower(tokens[0]) > bp) {
        expr = parseInfix(expr, tokens.shift(), tokens);
    }
    return expr;
}
/**
 * Parse an expression (as a string) into an AST.
 */
export function parse(str) {
    return parseTokens(tokenize(str));
}
export function parseTokens(tokens) {
    tokens = tokens.filter((x) => x.type !== "SPACE");
    if (tokens[0].type === "OPERATOR" && tokens[0].value === "=") {
        tokens.splice(0, 1);
    }
    const result = parseExpression(tokens, 0);
    if (tokens.length) {
        throw new Error(DEFAULT_ERROR_MESSAGE);
    }
    return result;
}
/**
 * Allows to visit all nodes of an AST and apply a mapping function
 * to nodes of a specific type.
 * Useful if you want to convert some part of a formula.
 *
 * e.g.
 * ```ts
 * convertAstNodes(ast, "FUNCALL", convertFormulaToExcel)
 *
 * function convertFormulaToExcel(ast: ASTFuncall) {
 *   // ...
 *   return modifiedAst
 * }
 * ```
 */
export function convertAstNodes(ast, type, fn) {
    if (type === ast.type) {
        ast = fn(ast);
    }
    switch (ast.type) {
        case "FUNCALL":
            return {
                ...ast,
                args: ast.args.map((child) => convertAstNodes(child, type, fn)),
            };
        case "UNARY_OPERATION":
            return {
                ...ast,
                right: convertAstNodes(ast.right, type, fn),
            };
        case "BIN_OPERATION":
            return {
                ...ast,
                right: convertAstNodes(ast.right, type, fn),
                left: convertAstNodes(ast.left, type, fn),
            };
        default:
            return ast;
    }
}
/**
 * Converts an ast formula to the corresponding string
 */
export function astToFormula(ast) {
    switch (ast.type) {
        case "FUNCALL":
            const args = ast.args.map((arg) => astToFormula(arg));
            return `${ast.value}(${args.join(",")})`;
        case "NUMBER":
            return ast.value.toString();
        case "REFERENCE":
            return ast.value;
        case "STRING":
            return `"${ast.value}"`;
        case "BOOLEAN":
            return ast.value ? "TRUE" : "FALSE";
        case "UNARY_OPERATION":
            return ast.value + rightOperandToFormula(ast);
        case "BIN_OPERATION":
            return leftOperandToFormula(ast) + ast.value + rightOperandToFormula(ast);
        default:
            return ast.value;
    }
}
/**
 * Convert the left operand of a binary operation to the corresponding string
 * and enclose the result inside parenthesis if necessary.
 */
function leftOperandToFormula(binaryOperationAST) {
    const mainOperator = binaryOperationAST.value;
    const leftOperation = binaryOperationAST.left;
    const leftOperator = leftOperation.value;
    const needParenthesis = leftOperation.type === "BIN_OPERATION" && OP_PRIORITY[leftOperator] < OP_PRIORITY[mainOperator];
    return needParenthesis ? `(${astToFormula(leftOperation)})` : astToFormula(leftOperation);
}
/**
 * Convert the right operand of a binary or unary operation to the corresponding string
 * and enclose the result inside parenthesis if necessary.
 */
function rightOperandToFormula(binaryOperationAST) {
    const mainOperator = binaryOperationAST.value;
    const rightOperation = binaryOperationAST.right;
    const rightPriority = OP_PRIORITY[rightOperation.value];
    const mainPriority = OP_PRIORITY[mainOperator];
    let needParenthesis = false;
    if (rightOperation.type !== "BIN_OPERATION") {
        needParenthesis = false;
    }
    else if (rightPriority < mainPriority) {
        needParenthesis = true;
    }
    else if (rightPriority === mainPriority && !ASSOCIATIVE_OPERATORS.includes(mainOperator)) {
        needParenthesis = true;
    }
    return needParenthesis ? `(${astToFormula(rightOperation)})` : astToFormula(rightOperation);
}
//# sourceMappingURL=parser.js.map