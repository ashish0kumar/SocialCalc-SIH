export class UuidGenerator {
    constructor() {
        this.nextId = 1;
    }
    setIsFastStrategy(isFast) { }
    uuidv4() {
        return String(this.nextId++);
    }
    setNextId(i) {
        this.nextId = i;
    }
}
//# sourceMappingURL=uuid.js.map