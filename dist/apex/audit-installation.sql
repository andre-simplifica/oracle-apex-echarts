set define on verify off feedback on serveroutput on sqlblanklines on
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback

define TARGET_APP_ID = '&1'

prompt Read-only Oracle APEX ECharts installation audit
declare
  l_application_count pls_integer;
  l_application_id    number;
  l_workspace_name    varchar2(255);
  l_parsing_schema    varchar2(255);
  l_plugin_count      pls_integer;
  l_plugin_version    varchar2(20);
  l_files_version     number;
  l_file_count        pls_integer;
  l_expected_file_count pls_integer;
  l_spec_status       varchar2(7);
  l_body_status       varchar2(7);
  l_package_version   varchar2(20);
  l_error_count       pls_integer;
  l_state             varchar2(30);
begin
  l_application_id := to_number('&&TARGET_APP_ID');

  select count(*), max(workspace), max(parsing_schema)
    into l_application_count, l_workspace_name, l_parsing_schema
    from apex_applications
   where application_id = l_application_id;

  if l_application_count <> 1 then
    raise_application_error(-20990, 'The target application ID was not found.');
  end if;

  select count(*), max(version_identifier), max(files_version)
    into l_plugin_count, l_plugin_version, l_files_version
    from apex_appl_plugins
   where application_id = l_application_id
     and name = 'COM.SIMPLIFICA.APEX.ECHARTS';

  select count(distinct file_name)
    into l_file_count
    from apex_appl_plugin_files
   where application_id = l_application_id
     and plugin_name = 'COM.SIMPLIFICA.APEX.ECHARTS';

  select count(distinct file_name)
    into l_expected_file_count
    from apex_appl_plugin_files
   where application_id = l_application_id
     and plugin_name = 'COM.SIMPLIFICA.APEX.ECHARTS'
     and file_name in (
       'echarts-6.1.0.min.js',
       'oracle-apex-echarts.js',
       'oracle-apex-echarts.css',
       'LICENSE',
       'NOTICE',
       'LICENSE-d3',
       'SOURCE.json',
       'SHA256SUMS'
     );

  select max(case when object_type = 'PACKAGE' then status end),
         max(case when object_type = 'PACKAGE BODY' then status end)
    into l_spec_status, l_body_status
    from user_objects
   where object_name = 'PK_APEX_ECHARTS'
     and object_type in ('PACKAGE', 'PACKAGE BODY');

  select max(regexp_substr(text, '''([^'']+)''', 1, 1, null, 1))
    into l_package_version
    from user_source
   where name = 'PK_APEX_ECHARTS'
     and type = 'PACKAGE'
     and lower(text) like '%c_package_version%constant%';

  select count(*)
    into l_error_count
    from user_errors
   where name = 'PK_APEX_ECHARTS'
     and type in ('PACKAGE', 'PACKAGE BODY');

  if l_plugin_count = 0 and l_spec_status is null and l_body_status is null then
    l_state := 'ABSENT';
  elsif l_plugin_count = 1
        and l_plugin_version = '1.0.0'
        and l_files_version = 1
        and l_file_count = 8
        and l_expected_file_count = 8
        and l_spec_status = 'VALID'
        and l_body_status = 'VALID'
        and l_package_version = '1.0.0'
        and l_error_count = 0
  then
    l_state := 'COMPATIBLE';
  else
    l_state := 'INCOMPATIBLE_OR_PARTIAL';
  end if;

  dbms_output.put_line('State: ' || l_state);
  dbms_output.put_line('Application: ' || l_application_id);
  dbms_output.put_line('Workspace: ' || l_workspace_name);
  dbms_output.put_line('Parsing schema: ' || l_parsing_schema);
  dbms_output.put_line('Plug-in: ' || nvl(l_plugin_version, 'absent'));
  dbms_output.put_line('FILES_VERSION: ' || nvl(to_char(l_files_version), 'absent'));
  dbms_output.put_line('Embedded files: ' || l_file_count || ' total; ' || l_expected_file_count || '/8 expected names');
  dbms_output.put_line('Package: ' || nvl(l_package_version, 'absent'));
  dbms_output.put_line('Package status: ' || nvl(l_spec_status, 'absent') || '/' || nvl(l_body_status, 'absent'));
  dbms_output.put_line('USER_ERRORS: ' || l_error_count);
exception
  when value_error then
    raise_application_error(-20991, 'TARGET_APP_ID must be numeric. Run @audit-installation.sql <application_id>.');
end;
/
exit success
