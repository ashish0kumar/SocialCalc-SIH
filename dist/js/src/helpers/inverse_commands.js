import { inverseCommandRegistry } from "../registries/inverse_command_registry";
export function inverseCommand(cmd) {
    return inverseCommandRegistry.get(cmd.type)(cmd);
}
//# sourceMappingURL=inverse_commands.js.map