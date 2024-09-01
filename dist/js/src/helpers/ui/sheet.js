import { FORBIDDEN_SHEET_CHARS } from "../../constants";
import { _lt } from "../../translation";
export function interactiveRenameSheet(env, sheetId, errorText) {
    const placeholder = env.model.getters.getSheetName(sheetId);
    const title = _lt("Rename Sheet");
    const callback = (name) => {
        if (name === null || name === placeholder) {
            return;
        }
        if (name === "") {
            interactiveRenameSheet(env, sheetId, _lt("The sheet name cannot be empty."));
        }
        const result = env.model.dispatch("RENAME_SHEET", { sheetId, name });
        if (!result.isSuccessful) {
            if (result.reasons.includes(10 /* DuplicatedSheetName */)) {
                interactiveRenameSheet(env, sheetId, _lt("A sheet with the name %s already exists. Please select another name.", name));
            }
            if (result.reasons.includes(11 /* ForbiddenCharactersInSheetName */)) {
                interactiveRenameSheet(env, sheetId, _lt("Some used characters are not allowed in a sheet name (Forbidden characters are %s).", FORBIDDEN_SHEET_CHARS.join(" ")));
            }
        }
    };
    env.editText(title, callback, {
        placeholder: placeholder,
        error: errorText,
    });
}
//# sourceMappingURL=sheet.js.map