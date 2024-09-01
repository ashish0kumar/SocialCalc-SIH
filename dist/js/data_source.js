import { EventBus } from "./helpers/event_bus";
import { debounce } from "./helpers/misc";
import { Registry } from "./registry";
/**
 * DataSourceRegistry is used to contains all the DataSource of spreadsheet.
 * It's role is to ensure that an evaluation is triggered when a data source is
 * ready, and to provide a way to wait for the loading of all the data sources
 */
export class DataSourceRegistry extends EventBus {
    constructor() {
        super(...arguments);
        this.registry = new Registry();
    }
    /**
     * Add a new DataSource.
     *
     * Note that it will load the metadata directly
     */
    add(key, value) {
        this.registry.add(key, value);
        const debouncedLoaded = debounce(() => this.trigger("data-loaded", { id: key }), 0);
        value.on("data-loaded", this, () => debouncedLoaded());
        value.on("metadata-loaded", this, () => this.trigger("metadata-loaded"));
        value.on("error-caught", this, (data) => this.trigger("error-caught", { id: key, data }));
        value.loadMetadata();
        return this;
    }
    /**
     * Get an item from the registry
     */
    get(key) {
        return this.registry.get(key);
    }
    /**
     * Get a list of all elements in the registry
     */
    getAll() {
        return this.registry.getAll();
    }
    /**
     * Get a list of all elements in the registry
     */
    getKeys() {
        return this.registry.getKeys();
    }
    /**
     * Remove an item from the registry
     */
    remove(key) {
        const value = this.get(key);
        value.off("data-loaded", this);
        value.off("metadata-loaded", this);
        value.off("error-caught", this);
        this.registry.remove(key);
    }
    /**
     * Wait for the loading of all the data sources
     */
    async waitForReady() {
        const proms = [];
        for (const source of this.getAll()) {
            proms.push(source.get());
        }
        return Promise.all(proms);
    }
}
/**
 * DataSource is an abstract class that contains the logic of fetching and
 * maintaining access to data that have to be loaded.
 *
 * A class which extends this class have to implement two different methods:
 * * `_fetchMetadata`: This method should fetch the metadata, i.e. data that
 * should be fetch only once.
 *
 * * `_fetch`: This method should fetch the data from the server.
 *
 * To get the data from this class, there is three options:
 * * `get`: async function that will returns the data when it's loaded
 * * `getSync`: get the data that are currently loaded, undefined if no data
 * are loaded
 * * specific method: Subclass can implement concrete method to have access to a
 * particular data.
 */
export class DataSource extends EventBus {
    /**
     * Load the metadata
     */
    async loadMetadata() {
        if (!this.metadataPromise) {
            this.metadataPromise = this._fetchMetadata().then((metadata) => {
                this.metadata = metadata;
                this.trigger("metadata-loaded");
                return metadata;
            });
        }
        await this.metadataPromise;
    }
    /**
     * This method should be use to get the data
     */
    async get(params) {
        if (params && params.forceFetch) {
            this.data = undefined;
            this.dataPromise = undefined;
        }
        await this.loadMetadata();
        if (!this.dataPromise) {
            this.dataPromise = this._fetch(params).then((data) => {
                this.data = data;
                this.lastUpdate = Date.now();
                this.trigger("data-loaded");
                return data;
            });
        }
        return this.dataPromise;
    }
    /**
     * Get the data ONLY if it's ready (data are loaded). Returns undefined if
     * it's not ready
     */
    getSync() {
        return this.data;
    }
    /**
     * Get the metadata ONLY if it's ready (loaded). Returns undefined if it's
     * not ready
     */
    getMetadataSync() {
        return this.metadata;
    }
    getLastUpdate() {
        return this.lastUpdate;
    }
}
//# sourceMappingURL=data_source.js.map