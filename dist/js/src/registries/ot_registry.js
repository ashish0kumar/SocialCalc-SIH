import { Registry } from "../registry";
export class OTRegistry extends Registry {
    /**
     * Add a transformation function to the registry. When the executed command
     * happened, all the commands in toTransforms should be transformed using the
     * transformation function given
     */
    addTransformation(executed, toTransforms, fn) {
        for (let toTransform of toTransforms) {
            if (!this.content[toTransform]) {
                this.content[toTransform] = new Map();
            }
            this.content[toTransform].set(executed, fn);
        }
        return this;
    }
    /**
     * Get the transformation function to transform the command toTransform, after
     * that the executed command happened.
     */
    getTransformation(toTransform, executed) {
        return this.content[toTransform] && this.content[toTransform].get(executed);
    }
}
export const otRegistry = new OTRegistry();
//# sourceMappingURL=ot_registry.js.map