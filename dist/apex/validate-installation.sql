set define on verify off feedback on serveroutput on sqlblanklines on
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback

define TARGET_APP_ID = '&1'

declare
  l_package_status varchar2(7);
  l_body_status    varchar2(7);
  l_package_version varchar2(20);
  l_plugin_version varchar2(20);
  l_files_version number;
  l_file_count     pls_integer;
  l_expected_file_count pls_integer;
begin
  select max(case when object_type = 'PACKAGE' then status end),
         max(case when object_type = 'PACKAGE BODY' then status end)
    into l_package_status, l_body_status
    from user_objects
   where object_name = 'PK_APEX_ECHARTS';

  l_package_version := pk_apex_echarts.func_version;

  select version_identifier, files_version
    into l_plugin_version, l_files_version
    from apex_appl_plugins
   where application_id = to_number('&&TARGET_APP_ID')
     and name = 'COM.SIMPLIFICA.APEX.ECHARTS';

  select count(distinct file_name)
    into l_file_count
    from apex_appl_plugin_files
   where application_id = to_number('&&TARGET_APP_ID')
     and plugin_name = 'COM.SIMPLIFICA.APEX.ECHARTS';

  select count(distinct file_name)
    into l_expected_file_count
    from apex_appl_plugin_files
   where application_id = to_number('&&TARGET_APP_ID')
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

  dbms_output.put_line('Package: ' || l_package_version || ' (' || l_package_status || '/' || l_body_status || ')');
  dbms_output.put_line('Plug-in: ' || l_plugin_version || ' (FILES_VERSION=' || l_files_version || ')');
  dbms_output.put_line('Embedded files: ' || l_file_count || ' total; ' || l_expected_file_count || '/8 expected names');

  if l_package_status <> 'VALID'
     or l_body_status <> 'VALID'
     or l_package_version <> '1.0.0'
     or l_plugin_version <> '1.0.0'
     or l_files_version <> 1
     or l_file_count <> 8
     or l_expected_file_count <> 8
  then
    raise_application_error(-20989, 'Oracle APEX ECharts installation is incomplete or incompatible.');
  end if;
end;
/
exit success
