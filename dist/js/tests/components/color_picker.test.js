import { mount } from "@odoo/owl";
import { ColorPicker } from "../../src/components/color_picker";
import { makeTestFixture } from "../test_helpers/helpers";
let fixture;
beforeEach(async () => {
    fixture = makeTestFixture();
});
afterEach(() => {
    fixture.remove();
});
async function mountColorPicker(props) {
    // @ts-ignore
    return await mount(ColorPicker, fixture, { props });
}
describe("Color Picker tests", () => {
    test("Color picker is correctly positioned right without props given", async () => {
        var _a, _b, _c;
        await mountColorPicker({ onColorPicked: () => ({}) });
        expect((_a = document.querySelector(".o-color-picker")) === null || _a === void 0 ? void 0 : _a.classList).toContain("right");
        expect((_b = document.querySelector(".o-color-picker")) === null || _b === void 0 ? void 0 : _b.classList).not.toContain("left");
        expect((_c = document.querySelector(".o-color-picker")) === null || _c === void 0 ? void 0 : _c.classList).not.toContain("center");
    });
    test("Color picker is correctly positioned right", async () => {
        var _a, _b, _c;
        await mountColorPicker({ onColorPicked: () => ({}), dropdownDirection: "right" });
        expect((_a = document.querySelector(".o-color-picker")) === null || _a === void 0 ? void 0 : _a.classList).toContain("right");
        expect((_b = document.querySelector(".o-color-picker")) === null || _b === void 0 ? void 0 : _b.classList).not.toContain("left");
        expect((_c = document.querySelector(".o-color-picker")) === null || _c === void 0 ? void 0 : _c.classList).not.toContain("center");
    });
    test("Color picker is correctly positioned left", async () => {
        var _a, _b, _c;
        await mountColorPicker({ onColorPicked: () => ({}), dropdownDirection: "left" });
        expect((_a = document.querySelector(".o-color-picker")) === null || _a === void 0 ? void 0 : _a.classList).toContain("left");
        expect((_b = document.querySelector(".o-color-picker")) === null || _b === void 0 ? void 0 : _b.classList).not.toContain("right");
        expect((_c = document.querySelector(".o-color-picker")) === null || _c === void 0 ? void 0 : _c.classList).not.toContain("center");
    });
    test("Color picker is correctly centered", async () => {
        var _a, _b, _c;
        await mountColorPicker({
            onColorPicked: () => ({}),
            dropdownDirection: "center",
        });
        expect((_a = document.querySelector(".o-color-picker")) === null || _a === void 0 ? void 0 : _a.classList).toContain("center");
        expect((_b = document.querySelector(".o-color-picker")) === null || _b === void 0 ? void 0 : _b.classList).not.toContain("right");
        expect((_c = document.querySelector(".o-color-picker")) === null || _c === void 0 ? void 0 : _c.classList).not.toContain("left");
    });
});
//# sourceMappingURL=color_picker.test.js.map