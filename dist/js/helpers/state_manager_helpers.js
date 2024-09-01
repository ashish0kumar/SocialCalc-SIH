/**
 * Create an empty structure according to the type of the node key:
 * string: object
 * number: array
 */
export function createEmptyStructure(node) {
    if (typeof node === "string") {
        return {};
    }
    else if (typeof node === "number") {
        return [];
    }
    throw new Error(`Cannot create new node`);
}
//# sourceMappingURL=state_manager_helpers.js.map