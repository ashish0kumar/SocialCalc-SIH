import { _lt } from "../../translation";
export function handlePasteResult(env, result) {
    if (!result.isSuccessful) {
        if (result.reasons.includes(17 /* WrongPasteSelection */)) {
            env.notifyUser(_lt("This operation is not allowed with multiple selections."));
        }
        if (result.reasons.includes(2 /* WillRemoveExistingMerge */)) {
            env.notifyUser(_lt("This operation is not possible due to a merge. Please remove the merges first than try again."));
        }
    }
}
export function interactivePaste(env, target, pasteOption) {
    const result = env.model.dispatch("PASTE", { target, pasteOption });
    handlePasteResult(env, result);
}
//# sourceMappingURL=paste.js.map