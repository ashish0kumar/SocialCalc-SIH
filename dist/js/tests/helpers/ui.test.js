import { interactiveRenameSheet } from "../../src/helpers/ui/sheet";
import { Model } from "../../src/model";
import { createSheetWithName } from "../test_helpers/commands_helpers";
import { makeInteractiveTestEnv } from "../test_helpers/helpers";
describe("UI Helpers", () => {
    test.each([
        ["", "The sheet name cannot be empty."],
        [
            "hééélo///",
            "Some used characters are not allowed in a sheet name (Forbidden characters are ' * ? / \\ [ ]).",
        ],
    ])("Rename a sheet with interaction with wrong name %s", async (sheetName, expectedErrorMessage) => {
        const nameCallback = jest.fn().mockReturnValueOnce(sheetName).mockReturnValueOnce("new name");
        const titleTextSpy = jest.fn();
        const errorTextSpy = jest.fn();
        const editText = (title, callback, options) => {
            var _a;
            titleTextSpy(title.toString());
            errorTextSpy((_a = options === null || options === void 0 ? void 0 : options.error) === null || _a === void 0 ? void 0 : _a.toString());
            callback(nameCallback());
        };
        const model = new Model({});
        const env = makeInteractiveTestEnv(model, { editText });
        interactiveRenameSheet(env, model.getters.getActiveSheetId());
        expect(titleTextSpy).toHaveBeenCalledTimes(2);
        expect(titleTextSpy).toHaveBeenNthCalledWith(1, "Rename Sheet");
        expect(titleTextSpy).toHaveBeenNthCalledWith(2, "Rename Sheet");
        expect(errorTextSpy).toHaveBeenCalledTimes(2);
        expect(errorTextSpy).toHaveBeenNthCalledWith(1, undefined);
        expect(errorTextSpy).toHaveBeenNthCalledWith(2, expectedErrorMessage);
    });
    test("Rename a sheet with interaction with same name as other sheet", async () => {
        const sheetName = "existing sheet";
        const nameCallback = jest.fn().mockReturnValueOnce(sheetName).mockReturnValueOnce("new name");
        const titleTextSpy = jest.fn();
        const errorTextSpy = jest.fn();
        const editText = (title, callback, options) => {
            var _a;
            titleTextSpy(title.toString());
            errorTextSpy((_a = options === null || options === void 0 ? void 0 : options.error) === null || _a === void 0 ? void 0 : _a.toString());
            callback(nameCallback());
        };
        const model = new Model({});
        const env = makeInteractiveTestEnv(model, { editText });
        createSheetWithName(model, { sheetId: "42", activate: false }, sheetName);
        interactiveRenameSheet(env, model.getters.getActiveSheetId());
        expect(titleTextSpy).toHaveBeenCalledTimes(2);
        expect(titleTextSpy).toHaveBeenCalledWith("Rename Sheet");
        expect(errorTextSpy).toHaveBeenCalledTimes(2);
        expect(errorTextSpy).toHaveBeenNthCalledWith(1, undefined);
        expect(errorTextSpy).toHaveBeenNthCalledWith(2, `A sheet with the name ${sheetName} already exists. Please select another name.`);
    });
});
//# sourceMappingURL=ui.test.js.map