import { transform } from "../../../src/collaborative/ot/ot";
describe("OT with DELETE_FIGURE", () => {
    const deleteFigure = {
        type: "DELETE_FIGURE",
        sheetId: "42",
        id: "42",
    };
    const updateChart = {
        type: "UPDATE_CHART",
        definition: {},
    };
    const updateFigure = {
        type: "UPDATE_FIGURE",
        sheetId: "42",
    };
    describe.each([updateChart, updateFigure])("UPDATE_CHART & UPDATE_FIGURE", (cmd) => {
        test("Same ID", () => {
            expect(transform({ ...cmd, id: "42" }, deleteFigure)).toBeUndefined();
        });
        test("distinct ID", () => {
            expect(transform({ ...cmd, id: "otherId" }, deleteFigure)).toEqual({ ...cmd, id: "otherId" });
        });
    });
});
//# sourceMappingURL=ot.test.js.map