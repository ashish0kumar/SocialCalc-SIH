import { UuidGenerator } from "../helpers";
import { Registry } from "../registry";
class TopBarComponentRegistry extends Registry {
    constructor() {
        super(...arguments);
        this.mapping = {};
        this.uuidGenerator = new UuidGenerator();
    }
    add(name, value) {
        const component = { ...value, id: this.uuidGenerator.uuidv4() };
        return super.add(name, component);
    }
}
export const topbarComponentRegistry = new TopBarComponentRegistry();
//# sourceMappingURL=topbar_component_registry.js.map