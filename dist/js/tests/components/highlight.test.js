import { App, Component, useSubEnv, xml } from "@odoo/owl";
import { Highlight } from "../../src/components/highlight/highlight";
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, HEADER_HEIGHT, HEADER_WIDTH, } from "../../src/constants";
import { toZone } from "../../src/helpers";
import { Model } from "../../src/model";
import { DispatchResult } from "../../src/types/commands";
import { merge } from "../test_helpers/commands_helpers";
import { triggerMouseEvent } from "../test_helpers/dom_helper";
import { makeTestFixture, nextTick } from "../test_helpers/helpers";
function getColStartPosition(col) {
    return (HEADER_WIDTH +
        model.getters.getCol(model.getters.getActiveSheetId(), col).start -
        model.getters.getActiveViewport().offsetX);
}
function getColEndPosition(col) {
    return (HEADER_WIDTH +
        model.getters.getCol(model.getters.getActiveSheetId(), col).end -
        model.getters.getActiveViewport().offsetX);
}
function getRowStartPosition(row) {
    return (HEADER_HEIGHT +
        model.getters.getRow(model.getters.getActiveSheetId(), row).start -
        model.getters.getActiveViewport().offsetY);
}
function getRowEndPosition(row) {
    return (HEADER_HEIGHT +
        model.getters.getRow(model.getters.getActiveSheetId(), row).end -
        model.getters.getActiveViewport().offsetY);
}
async function selectNWCellCorner(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColStartPosition(left), getRowStartPosition(top));
    await nextTick();
}
async function selectNECellCorner(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColEndPosition(left), getRowStartPosition(top));
    await nextTick();
}
async function selectSWCellCorner(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColStartPosition(left), getRowEndPosition(top));
    await nextTick();
}
async function selectSECellCorner(el, xc) {
    debugger;
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColEndPosition(left), getRowEndPosition(top));
    await nextTick();
}
async function selectTopCellBorder(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColStartPosition(left) + 10, getRowStartPosition(top) + 2);
    await nextTick();
}
async function selectBottomCellBorder(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColStartPosition(left) + 10, getRowEndPosition(top) - 2);
    await nextTick();
}
async function selectLeftCellBorder(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColStartPosition(left) + 2, getRowStartPosition(top) + 10);
    await nextTick();
}
async function selectRightCellBorder(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousedown", getColEndPosition(left) - 2, getRowStartPosition(top) + 10);
    await nextTick();
}
async function moveToCell(el, xc) {
    const { top, left } = toZone(xc);
    triggerMouseEvent(el, "mousemove", getColStartPosition(left) + 10, getRowStartPosition(top) + 10);
    await nextTick();
}
let model;
let app;
let fixture;
let parent;
let cornerEl;
let borderEl;
class Parent extends Component {
    setup() {
        this.props.model.dispatch = jest.fn((command) => DispatchResult.Success);
        useSubEnv({
            model: this.props.model,
        });
    }
    get model() {
        return this.props.model;
    }
}
Parent.components = { Highlight };
Parent.template = xml /*xml*/ `
    <Highlight zone="props.zone" color="props.color"/>
  `;
async function mountHighlight(zone, color) {
    app = new App(Parent, { props: { zone: toZone(zone), color, model } });
    return await app.mount(fixture);
}
beforeEach(async () => {
    fixture = makeTestFixture();
    model = new Model();
    model.dispatch("RESIZE_VIEWPORT", {
        width: 1000,
        height: 1000,
    });
});
afterEach(() => {
    app.destroy();
    fixture.remove();
});
describe("Corner component", () => {
    describe("can drag all corners", () => {
        test("start on nw corner", async () => {
            parent = await mountHighlight("B2", "#666");
            cornerEl = fixture.querySelector(".o-corner-nw");
            // select B2 nw corner
            selectNWCellCorner(cornerEl, "B2");
            expect(model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to A1
            moveToCell(cornerEl, "A1");
            expect(model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("A1:B2"),
            });
        });
        test("start on ne corner", async () => {
            parent = await mountHighlight("B2", "#666");
            cornerEl = fixture.querySelector(".o-corner-ne");
            // select B2 ne corner
            selectNECellCorner(cornerEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to C1
            moveToCell(cornerEl, "C1");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("B1:C2"),
            });
        });
        test("start on sw corner", async () => {
            parent = await mountHighlight("B2", "#666");
            cornerEl = fixture.querySelector(".o-corner-sw");
            // select B2 sw corner
            selectSWCellCorner(cornerEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to A3
            moveToCell(cornerEl, "A3");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("A2:B3"),
            });
        });
        test("start on se corner", async () => {
            parent = await mountHighlight("B2", "#666");
            cornerEl = fixture.querySelector(".o-corner-se");
            // select B2 se corner
            selectSECellCorner(cornerEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to C3
            moveToCell(cornerEl, "C3");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("B2:C3"),
            });
        });
    });
    test("do nothing if drag outside the grid", async () => {
        parent = await mountHighlight("A1", "#666");
        cornerEl = fixture.querySelector(".o-corner-nw");
        // select A1 nw corner
        selectNWCellCorner(cornerEl, "A1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1"),
        });
        // move outside the grid
        triggerMouseEvent(cornerEl, "mousemove", getColStartPosition(0) - 100, getRowStartPosition(0) - 100);
        await nextTick();
        expect(parent.model.dispatch).toHaveBeenCalledTimes(1);
    });
    test("drag highlight corner on merged cells expands the final highlight zone", async () => {
        merge(model, "B1:C1");
        parent = await mountHighlight("B2", "#666");
        cornerEl = fixture.querySelector(".o-corner-nw");
        // select B2 se corner
        selectNWCellCorner(cornerEl, "B2");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("B2"),
        });
        // move to B1
        moveToCell(cornerEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("B1:C2"),
        });
    });
    test("can edge-scroll horizontally", async () => {
        const { width } = model.getters.getViewportDimensionWithHeaders();
        model.dispatch("RESIZE_COLUMNS_ROWS", {
            dimension: "COL",
            sheetId: model.getters.getActiveSheetId(),
            elements: [0, 1],
            size: width / 2,
        });
        parent = await mountHighlight("B1", "#666");
        cornerEl = fixture.querySelector(".o-corner-nw");
        // select B1 nw corner
        selectNWCellCorner(cornerEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("B1"),
        });
        // move to C1
        moveToCell(cornerEl, "C1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("SET_VIEWPORT_OFFSET", {
            offsetX: width / 2,
            offsetY: 0,
        });
    });
    test("can edge-scroll vertically", async () => {
        const { height } = model.getters.getViewportDimensionWithHeaders();
        model.dispatch("RESIZE_COLUMNS_ROWS", {
            dimension: "ROW",
            sheetId: model.getters.getActiveSheetId(),
            elements: [0, 1],
            size: height / 2,
        });
        parent = await mountHighlight("A2", "#666");
        cornerEl = fixture.querySelector(".o-corner-nw");
        // select A2 nw corner
        selectTopCellBorder(cornerEl, "A2");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A2"),
        });
        // move to A3
        moveToCell(cornerEl, "A3");
        expect(parent.model.dispatch).toHaveBeenCalledWith("SET_VIEWPORT_OFFSET", {
            offsetX: 0,
            offsetY: height / 2,
        });
    });
});
describe("Border component", () => {
    describe("can drag all borders", () => {
        test("start on top border", async () => {
            parent = await mountHighlight("B2", "#666");
            borderEl = fixture.querySelector(".o-border-n");
            // select B2 top border
            selectTopCellBorder(borderEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to C2
            moveToCell(borderEl, "C2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("C2"),
            });
        });
        test("start on left border", async () => {
            parent = await mountHighlight("B2", "#666");
            borderEl = fixture.querySelector(".o-border-w");
            // select B2 left border
            selectLeftCellBorder(borderEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to C2
            moveToCell(borderEl, "C2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("C2"),
            });
        });
        test("start on right border", async () => {
            parent = await mountHighlight("B2", "#666");
            borderEl = fixture.querySelector(".o-border-w");
            // select B2 right border
            selectRightCellBorder(borderEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to C2
            moveToCell(borderEl, "C2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("C2"),
            });
        });
        test("start on bottom border", async () => {
            parent = await mountHighlight("B2", "#666");
            borderEl = fixture.querySelector(".o-border-w");
            // select B2 bottom border
            selectBottomCellBorder(borderEl, "B2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
                zone: toZone("B2"),
            });
            // move to C2
            moveToCell(borderEl, "C2");
            expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
                zone: toZone("C2"),
            });
        });
    });
    test("drag the A1:B2 highlight, start on A1 top border, finish on C1 --> set C1:D2 highlight", async () => {
        parent = await mountHighlight("A1:B2", "#666");
        borderEl = fixture.querySelector(".o-border-n");
        // select A1 top border
        selectTopCellBorder(borderEl, "A1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1:B2"),
        });
        // move to B1
        moveToCell(borderEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("B1:C2"),
        });
        // move to C1
        moveToCell(borderEl, "C1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("C1:D2"),
        });
    });
    test("drag the A1:B2 highlight, start on B1 top border, finish on C1 --> set B1:C2 highlight", async () => {
        parent = await mountHighlight("A1:B2", "#666");
        borderEl = fixture.querySelector(".o-border-n");
        // select B1 top border
        selectTopCellBorder(borderEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1:B2"),
        });
        // move to C1
        moveToCell(borderEl, "C1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("B1:C2"),
        });
    });
    test("cannot drag highlight zone if already beside limit border", async () => {
        parent = await mountHighlight("A1:B2", "#666");
        borderEl = fixture.querySelector(".o-border-s");
        // select B2 bottom border
        selectBottomCellBorder(borderEl, "B2");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1:B2"),
        });
        // move to A2
        moveToCell(borderEl, "A2");
        expect(parent.model.dispatch).toHaveBeenCalledTimes(1);
    });
    test("drag highlight order on merged cells expands the final highlight zone", async () => {
        merge(model, "B1:C1");
        parent = await mountHighlight("A1", "#666");
        borderEl = fixture.querySelector(".o-border-n");
        // select A1 top border
        selectTopCellBorder(borderEl, "A1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1"),
        });
        // move to B1
        moveToCell(borderEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("B1:C1"),
        });
    });
    test("drag highlight on merged cells expands the highlight zone", async () => {
        merge(model, "B1:C1");
        parent = await mountHighlight("A1", "#666");
        borderEl = fixture.querySelector(".o-border-n");
        // select A1 top border
        selectTopCellBorder(borderEl, "A1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1"),
        });
        // move to B1
        moveToCell(borderEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("B1:C1"),
        });
    });
    test("resize highlights on a scrolled viewport", async () => {
        //scroll between B2/C3
        model.dispatch("SET_VIEWPORT_OFFSET", {
            offsetX: (DEFAULT_CELL_WIDTH * 3) / 2,
            offsetY: (DEFAULT_CELL_HEIGHT * 3) / 2,
        });
        parent = await mountHighlight("A1:D4", "#666");
        borderEl = fixture.querySelector(".o-corner-se");
        selectSECellCorner(borderEl, "D4");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1:D4"),
        });
        moveToCell(borderEl, "E5");
        expect(parent.model.dispatch).toHaveBeenLastCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("A1:E5"),
        });
    });
    test("drag highlights on a scrolled viewport", async () => {
        //scroll between B2/C3
        model.dispatch("SET_VIEWPORT_OFFSET", {
            offsetX: (DEFAULT_CELL_WIDTH * 3) / 2,
            offsetY: (DEFAULT_CELL_HEIGHT * 3) / 2,
        });
        parent = await mountHighlight("A1:D4", "#666");
        borderEl = fixture.querySelector(".o-border-s");
        selectBottomCellBorder(borderEl, "D4");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A1:D4"),
        });
        moveToCell(borderEl, "E5");
        expect(parent.model.dispatch).toHaveBeenLastCalledWith("CHANGE_HIGHLIGHT", {
            zone: toZone("B2:E5"),
        });
    });
    test("can edge-scroll horizontally", async () => {
        const { width } = model.getters.getViewportDimensionWithHeaders();
        model.dispatch("RESIZE_COLUMNS_ROWS", {
            dimension: "COL",
            sheetId: model.getters.getActiveSheetId(),
            elements: [0, 1],
            size: width / 2,
        });
        parent = await mountHighlight("B1", "#666");
        borderEl = fixture.querySelector(".o-border-n");
        // select B1 top border
        selectTopCellBorder(borderEl, "B1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("B1"),
        });
        // move to C1
        moveToCell(borderEl, "C1");
        expect(parent.model.dispatch).toHaveBeenCalledWith("SET_VIEWPORT_OFFSET", {
            offsetX: width / 2,
            offsetY: 0,
        });
    });
    test("can edge-scroll vertically", async () => {
        const { height } = model.getters.getViewportDimensionWithHeaders();
        model.dispatch("RESIZE_COLUMNS_ROWS", {
            dimension: "ROW",
            sheetId: model.getters.getActiveSheetId(),
            elements: [0, 1],
            size: height / 2,
        });
        parent = await mountHighlight("A2", "#666");
        borderEl = fixture.querySelector(".o-border-n");
        // select A2 top border
        selectTopCellBorder(borderEl, "A2");
        expect(parent.model.dispatch).toHaveBeenCalledWith("START_CHANGE_HIGHLIGHT", {
            zone: toZone("A2"),
        });
        // move to A3
        moveToCell(borderEl, "A3");
        expect(parent.model.dispatch).toHaveBeenCalledWith("SET_VIEWPORT_OFFSET", {
            offsetX: 0,
            offsetY: height / 2,
        });
    });
});
//# sourceMappingURL=highlight.test.js.map