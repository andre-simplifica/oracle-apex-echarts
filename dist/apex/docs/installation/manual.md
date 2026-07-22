# Manual App Builder installation

1. Verify the release `SHA256SUMS` and `compatibility.json`.
2. Run the read-only `audit-installation.sql <application_id>` and confirm
   workspace, application, parsing schema, existing package/plug-in versions,
   backup, authorization, and rollback release.
3. In the parsing schema, compile `pk_apex_echarts.pks` followed by
   `pk_apex_echarts.pkb`.
4. Query `USER_ERRORS` and `USER_OBJECTS`; stop unless package and body are valid.
5. Open **Shared Components > Plug-ins > Import** and import `plugin.sql`.
6. Confirm internal name `COM.SIMPLIFICA.APEX.ECHARTS`, version, `FILES_VERSION`,
   and eight embedded files.
7. Run `validate-installation.sql <application_id>` through SQLcl.
8. Configure the compiled profile in plug-in Component Settings.
9. Add regions manually through Page Designer. No global region is automatic.

Do not import a full application and do not use production as a trial target.
