import { MockCanvasRenderingContext2D } from "../setup/canvas.mock";
MockCanvasRenderingContext2D.prototype.measureText = function () {
    return { width: 100 };
};
export class MockGridRenderingContext {
    constructor(model, width, height, observer) {
        this._context = document.createElement("canvas").getContext("2d");
        this.dpr = 1;
        this.thinLineWidth = 0.4;
        model.dispatch("RESIZE_VIEWPORT", { width, height });
        this.viewport = model.getters.getActiveViewport();
        const handler = {
            get: (target, val) => {
                if (val in this._context.__proto__) {
                    return (...args) => {
                        if (observer.onFunctionCall) {
                            observer.onFunctionCall(val, args);
                        }
                    };
                }
                else {
                    if (observer.onGet) {
                        observer.onGet(val);
                    }
                }
                return target[val];
            },
            set: (target, key, val) => {
                if (observer.onSet) {
                    observer.onSet(key, val);
                }
                target[key] = val;
                return true;
            },
        };
        this.ctx = new Proxy({}, handler);
    }
}
/**
 * Create a rendering context watching the blue dotted
 * outline around copied zones
 */
export function watchClipboardOutline(model) {
    const viewportSize = 1000;
    const viewport = {
        bottom: viewportSize,
        left: 0,
        offsetX: 0,
        offsetY: 0,
        right: viewportSize,
        top: 0,
    };
    let lineDash = false;
    let outlinedRects = [];
    const ctx = new MockGridRenderingContext(model, viewportSize, viewportSize, {
        onFunctionCall: (val, args) => {
            if (val === "setLineDash") {
                lineDash = true;
            }
            else if (lineDash && val === "strokeRect") {
                outlinedRects.push(args);
            }
            else {
                lineDash = false;
            }
        },
    });
    const isDotOutlined = (zones) => {
        return zones.every((zone) => {
            const [x, y, width, height] = model.getters.getRect(zone, viewport);
            return outlinedRects.some((rect) => rect[0] === x && rect[1] === y && rect[2] === width && rect[3] === height);
        });
    };
    const reset = () => {
        outlinedRects = [];
        lineDash = false;
    };
    return { ctx, isDotOutlined, reset };
}
//# sourceMappingURL=renderer_helpers.js.map