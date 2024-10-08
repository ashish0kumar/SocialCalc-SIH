/**
 * BasePlugin
 *
 * Since the spreadsheet internal state is quite complex, it is split into
 * multiple parts, each managing a specific concern.
 *
 * This file introduce the BasePlugin, which is the common class that defines
 * how each of these model sub parts should interact with each other.
 * There are two kind of plugins: core plugins handling persistent data
 * and UI plugins handling transient data.
 */
export class BasePlugin {
    constructor(stateObserver, dispatch, config) {
        this.history = Object.assign(Object.create(stateObserver), {
            update: stateObserver.addChange.bind(stateObserver, this),
            selectCell: () => { },
        });
        this.dispatch = dispatch;
        this.currentMode = config.mode;
    }
    // ---------------------------------------------------------------------------
    // Command handling
    // ---------------------------------------------------------------------------
    /**
     * Before a command is accepted, the model will ask each plugin if the command
     * is allowed.  If all of then return true, then we can proceed. Otherwise,
     * the command is cancelled.
     *
     * There should not be any side effects in this method.
     */
    allowDispatch(command) {
        return 0 /* Success */;
    }
    /**
     * This method is useful when a plugin need to perform some action before a
     * command is handled in another plugin. This should only be used if it is not
     * possible to do the work in the handle method.
     */
    beforeHandle(command) { }
    /**
     * This is the standard place to handle any command. Most of the plugin
     * command handling work should take place here.
     */
    handle(command) { }
    /**
     * Sometimes, it is useful to perform some work after a command (and all its
     * subcommands) has been completely handled.  For example, when we paste
     * multiple cells, we only want to reevaluate the cell values once at the end.
     */
    finalize() { }
    /**
     * Combine multiple validation functions into a single function
     * returning the list of result of every validation.
     */
    batchValidations(...validations) {
        return (toValidate) => validations.map((validation) => validation.call(this, toValidate)).flat();
    }
    /**
     * Combine multiple validation functions. Every validation is executed one after
     * the other. As soon as one validation fails, it stops and the cancelled reason
     * is returned.
     */
    chainValidations(...validations) {
        return (toValidate) => {
            for (const validation of validations) {
                let results = validation.call(this, toValidate);
                if (!Array.isArray(results)) {
                    results = [results];
                }
                const cancelledReasons = results.filter((result) => result !== 0 /* Success */);
                if (cancelledReasons.length) {
                    return cancelledReasons;
                }
            }
            return 0 /* Success */;
        };
    }
    checkValidations(command, ...validations) {
        return this.batchValidations(...validations)(command);
    }
}
BasePlugin.getters = [];
BasePlugin.modes = ["headless", "normal"];
//# sourceMappingURL=base_plugin.js.map