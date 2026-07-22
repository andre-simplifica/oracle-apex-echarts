# Distribution layout

Run `@install.sql <application_id>` only after confirming the workspace, target
application, parsing schema, installed versions, backup, and rollback release.
The script compiles only `PK_APEX_ECHARTS`, imports only the region plug-in, and
does not create pages, regions, tables, jobs, or application data.

Run `@audit-installation.sql <application_id>` first when installation state is
unknown. It performs only data-dictionary/APEX metadata reads and reports
`ABSENT`, `COMPATIBLE`, or `INCOMPATIBLE_OR_PARTIAL`; it does not compile or
import anything.

For App Builder installation, compile `packages/pk_apex_echarts.pks` and
`packages/pk_apex_echarts.pkb` in the parsing schema, then import `plugin.sql`
from **Shared Components > Plug-ins > Import**. Run
`@validate-installation.sql <application_id>` afterward.
