import { Registry } from "../registry";
const DEFAULT_MENU_ITEM = (key) => ({
    isVisible: () => true,
    isEnabled: () => true,
    isReadonlyAllowed: false,
    shortCut: "",
    action: false,
    children: [],
    separator: false,
    icon: false,
    id: key,
});
export function createFullMenuItem(key, value) {
    return Object.assign({}, DEFAULT_MENU_ITEM(key), value);
}
/**
 * The class Registry is extended in order to add the function addChild
 *
 */
export class MenuItemRegistry extends Registry {
    /**
     * @override
     */
    add(key, value) {
        this.content[key] = createFullMenuItem(key, value);
        return this;
    }
    /**
     * Add a subitem to an existing item
     * @param path Path of items to add this subitem
     * @param value Subitem to add
     */
    addChild(key, path, value) {
        const root = path.splice(0, 1)[0];
        let node = this.content[root];
        if (!node) {
            throw new Error(`Path ${root + ":" + path.join(":")} not found`);
        }
        for (let p of path) {
            if (typeof node.children === "function") {
                node = undefined;
            }
            else {
                node = node.children.find((elt) => elt.id === p);
            }
            if (!node) {
                throw new Error(`Path ${root + ":" + path.join(":")} not found`);
            }
        }
        node.children.push(createFullMenuItem(key, value));
        return this;
    }
    getChildren(node, env) {
        if (typeof node.children === "function") {
            return node.children(env).sort((a, b) => a.sequence - b.sequence);
        }
        return node.children.sort((a, b) => a.sequence - b.sequence);
    }
    getName(node, env) {
        if (typeof node.name === "function") {
            return node.name(env);
        }
        return node.name;
    }
    getShortCut(node) {
        return node.shortCut ? node.shortCut : "";
    }
    /**
     * Get a list of all elements in the registry, ordered by sequence
     * @override
     */
    getAll() {
        return super.getAll().sort((a, b) => a.sequence - b.sequence);
    }
}
//# sourceMappingURL=menu_items_registry.js.map