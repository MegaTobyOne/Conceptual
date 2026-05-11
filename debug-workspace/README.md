# PSPF Debug Workspace

Use this folder as the target workspace for the `Run PSPF Core + Workshop` launch configuration.

The debug Extension Host auto-initialises `.pspf/` on activation through the workspace setting `pspf.core.initialiseOnActivation`.

You can still run `PSPF: Initialise PSPF Workspace` manually; it is idempotent and remains useful for normal workspaces where auto-initialise is not enabled.