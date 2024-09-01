import { toZone } from "../../src/helpers";
import { nextTick } from "./helpers";
export async function simulateClick(selector, x = 10, y = 10, extra = { bubbles: true }) {
    var _a;
    let target;
    if (typeof selector === "string") {
        target = document.querySelector(selector);
        if (!target) {
            throw new Error(`"${selector}" does not match any element.`);
        }
    }
    else {
        target = selector;
    }
    triggerMouseEvent(selector, "mousedown", x, y, extra);
    if (target !== document.activeElement) {
        (_a = document.activeElement) === null || _a === void 0 ? void 0 : _a.blur();
        target.focus();
    }
    triggerMouseEvent(selector, "mouseup", x, y, extra);
    triggerMouseEvent(selector, "click", x, y, extra);
    await nextTick();
}
export async function clickCell(model, xc, extra = { bubbles: true }) {
    const zone = toZone(xc);
    const viewport = model.getters.getActiveViewport();
    const [x, y, ,] = model.getters.getRect(zone, viewport);
    await simulateClick("canvas", x, y, extra);
}
export async function rightClickCell(model, xc, extra = { bubbles: true }) {
    const zone = toZone(xc);
    const viewport = model.getters.getActiveViewport();
    const [x, y, ,] = model.getters.getRect(zone, viewport);
    triggerMouseEvent("canvas", "contextmenu", x, y, extra);
    await nextTick();
}
export function triggerMouseEvent(selector, type, x, y, extra = { bubbles: true }) {
    const ev = new MouseEvent(type, {
        clientX: x,
        clientY: y,
        bubbles: true,
        ...extra,
    });
    ev.offsetX = x;
    ev.offsetY = y;
    ev.pageX = x;
    ev.pageY = y;
    if (typeof selector === "string") {
        document.querySelector(selector).dispatchEvent(ev);
    }
    else {
        selector.dispatchEvent(ev);
    }
}
export function setInputValueAndTrigger(selector, value, eventType) {
    let rangeInput;
    if (typeof selector === "string") {
        rangeInput = document.querySelector(selector);
    }
    else {
        rangeInput = selector;
    }
    rangeInput.value = value;
    rangeInput.dispatchEvent(new Event(eventType));
}
/** In the past, both keyDown and keyUp were awaiting two `nextTick` instead of one.
 * The reason is believed to be a hack trying to address some indeterministic errors in our tests, in vain.
 * Those indeterminisms were properly fixed afterwards which meant we could theoretically get rid of the
 * superfluous `nextTick`.
 *
 * This comment is meant to leave a trace of this change in case some issues were to arise again.
 */
export async function keyDown(key, options = {}) {
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", Object.assign({ key, bubbles: true }, options)));
    return await nextTick();
}
export async function keyUp(key, options = {}) {
    document.activeElement.dispatchEvent(new KeyboardEvent("keyup", Object.assign({ key, bubbles: true }, options)));
    return await nextTick();
}
//# sourceMappingURL=dom_helper.js.map