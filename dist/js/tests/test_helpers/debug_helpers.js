import { concat } from "../../src/helpers";
export function getDebugInfo(tree) {
    let id = 0;
    const instructionsIds = {};
    const allStrings = [];
    function printBranch(branch, level = 0) {
        const stringArray = [];
        for (let i = 0; i < level - 1; i++) {
            stringArray.push("".padEnd(10));
        }
        if (level > 0) {
            stringArray.push(">".padEnd(10));
        }
        for (let instruction of branch.getOperations()) {
            const idToShow = `${instruction.id.toString().substring(0, 4)}(${id})`;
            stringArray.push(idToShow.padEnd(10));
            instructionsIds[id++] = {
                // @ts-ignore
                data: instruction.data,
                id: instruction.id,
            };
        }
        allStrings.push(concat(stringArray));
    }
    let level = 0;
    for (const branch of tree["branches"]) {
        printBranch(branch, level);
        if (branch !== tree["branches"][tree["branches"].length - 1]) {
            const index = branch
                .getOperations()
                .findIndex((i) => tree["branchingOperationIds"].get(branch) === i.id);
            if (index === -1) {
                allStrings.push("Detached");
                level = 0;
            }
            else {
                level += index + 1;
            }
        }
    }
    allStrings.push("");
    allStrings.push("Instructions:");
    for (let [id, instruction] of Object.entries(instructionsIds)) {
        const data = instruction.data._commands
            ? JSON.stringify(instruction.data._commands)
            : JSON.stringify(instruction.data);
        allStrings.push(`${id}: ${data}`);
    }
    return allStrings.join("\n");
}
/**
 * Display the branches of the revisions of the given model
 */
export function printDebugModel(model) {
    // @ts-ignore
    console.log(getDebugInfo(model["session"]["revisions"]["tree"]));
}
//# sourceMappingURL=debug_helpers.js.map