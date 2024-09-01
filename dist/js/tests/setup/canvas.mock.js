let size = 1000;
export function setMockSize(s) {
    size = s;
}
export class MockCanvasRenderingContext2D {
    translate() { }
    scale() { }
    clearRect() { }
    beginPath() { }
    moveTo() { }
    lineTo() { }
    stroke() { }
    fillRect() { }
    strokeRect() { }
    fillText() { }
    fill() { }
    save() { }
    rect() { }
    clip() { }
    restore() { }
    setLineDash() { }
    measureText(text) {
        return { width: size };
    }
    drawImage() { }
}
const patch = {
    getContext: function () {
        return new MockCanvasRenderingContext2D();
    },
};
/* js-ignore */
Object.assign(HTMLCanvasElement.prototype, patch);
//# sourceMappingURL=canvas.mock.js.map