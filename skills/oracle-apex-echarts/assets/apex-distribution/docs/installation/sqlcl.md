# SQLcl installation

Use the supported `sql` wrapper and a saved connection; never put a password on
the command line. Extract the APEX distribution, change into it, and run:

```text
sql -S -L -name <saved-dev-connection> @audit-installation.sql <application_id>
sql -S -L -name <saved-dev-connection> @install.sql <application_id>
sql -S -L -name <saved-dev-connection> @validate-installation.sql <application_id>
```

The audit is strictly read-only and distinguishes absent, compatible, and
partial/incompatible states. Inspection does not authorize the following
compile or import commands.

`install.sql` has `whenever sqlerror/oserror`, explicit rollback on failure,
explicit exit, and no interactive `accept`, `pause`, or help. It validates the
application's parsing schema before compiling or importing. A downgrade or
partial/incompatible installation stops safely.
