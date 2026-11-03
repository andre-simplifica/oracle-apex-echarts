set define on verify off feedback on serveroutput on sqlblanklines on
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback

define TARGET_APP_ID = '&1'

prompt [1/5] Validating workspace, application, parsing schema, and installed versions...
declare
  c_target_version constant varchar2(20) := '1.1.0';
  l_application_id number;
  l_workspace_id   number;
  l_workspace_name varchar2(255);
  l_parsing_schema varchar2(255);
  l_plugin_version varchar2(20);
  l_package_count  pls_integer;
  l_package_version varchar2(20);

  function version_part(p_version in varchar2, p_position in pls_integer)
    return pls_integer
  is
  begin
    return to_number(regexp_substr(p_version, '[0-9]+', 1, p_position));
  exception
    when others then
      raise_application_error(-20980, 'An installed component has an invalid semantic version.');
  end version_part;

  function version_is_newer(p_left in varchar2, p_right in varchar2)
    return boolean
  is
  begin
    for i in 1 .. 3 loop
      if version_part(p_left, i) > version_part(p_right, i) then return true; end if;
      if version_part(p_left, i) < version_part(p_right, i) then return false; end if;
    end loop;
    return false;
  end version_is_newer;
begin
  l_application_id := to_number('&&TARGET_APP_ID');

  select workspace_id, workspace, owner
    into l_workspace_id, l_workspace_name, l_parsing_schema
    from apex_applications
   where application_id = l_application_id;

  if upper(l_parsing_schema) <> upper(user) then
    raise_application_error(-20981, 'The target application does not use the connected parsing schema.');
  end if;

  select max(version_identifier)
    into l_plugin_version
    from apex_appl_plugins
   where application_id = l_application_id
     and name = 'COM.SIMPLIFICA.APEX.ECHARTS';

  select count(*)
    into l_package_count
    from user_objects
   where object_name = 'PK_APEX_ECHARTS'
     and object_type = 'PACKAGE';

  if l_package_count = 1 then
    begin
      execute immediate 'begin :version := pk_apex_echarts.func_version; end;'
        using out l_package_version;
    exception
      when others then
        raise_application_error(-20982, 'PK_APEX_ECHARTS exists but its version could not be confirmed.');
    end;
  end if;

  if (l_plugin_version is null and l_package_version is not null)
     or (l_plugin_version is not null and l_package_version is null)
     or (l_plugin_version is not null and l_plugin_version <> l_package_version)
  then
    raise_application_error(-20983, 'The installed plug-in and package are incomplete or incompatible. Stop and review compatibility.json.');
  end if;

  if l_plugin_version is not null and version_is_newer(l_plugin_version, c_target_version) then
    raise_application_error(-20984, 'Downgrade blocked. Install a compatible newer release or follow the documented rollback procedure.');
  end if;

  dbms_output.put_line('Workspace: ' || l_workspace_name || ' (' || l_workspace_id || ')');
  dbms_output.put_line('Application: ' || l_application_id);
  dbms_output.put_line('Parsing schema: ' || l_parsing_schema);
  dbms_output.put_line('Installed version: ' || nvl(l_plugin_version, 'none'));
  dbms_output.put_line('Target version: ' || c_target_version);

  apex_application_install.set_workspace_id(l_workspace_id);
  apex_application_install.set_application_id(l_application_id);
  apex_application_install.set_schema(user);
exception
  when no_data_found then
    raise_application_error(-20985, 'The target application ID was not found.');
  when value_error then
    raise_application_error(-20986, 'TARGET_APP_ID must be numeric. Run @install.sql <application_id>.');
end;
/

prompt [2/5] Compiling PK_APEX_ECHARTS specification and body...
@@packages/pk_apex_echarts.pks
@@packages/pk_apex_echarts.pkb

prompt [3/5] Validating package status and USER_ERRORS...
declare
  l_error_count  pls_integer;
  l_invalid_count pls_integer;
begin
  select count(*)
    into l_error_count
    from user_errors
   where name = 'PK_APEX_ECHARTS'
     and type in ('PACKAGE', 'PACKAGE BODY');

  select count(*)
    into l_invalid_count
    from user_objects
   where object_name = 'PK_APEX_ECHARTS'
     and object_type in ('PACKAGE', 'PACKAGE BODY')
     and status <> 'VALID';

  if l_error_count > 0 or l_invalid_count > 0 then
    raise_application_error(-20987, 'PK_APEX_ECHARTS is invalid. Review USER_ERRORS before retrying.');
  end if;
end;
/

prompt [4/5] Importing COM.SIMPLIFICA.APEX.ECHARTS...
@@plugin.sql

prompt [5/5] Validating plug-in version, package version, and embedded files...
declare
  l_file_count     pls_integer;
  l_total_file_count pls_integer;
  l_plugin_count   pls_integer;
  l_package_version varchar2(20);
begin
  select count(*)
    into l_plugin_count
    from apex_appl_plugins
   where application_id = to_number('&&TARGET_APP_ID')
     and name = 'COM.SIMPLIFICA.APEX.ECHARTS'
     and display_name = 'Apache ECharts for Oracle APEX'
     and version_identifier = '1.1.0'
     and files_version = 2;

  select count(distinct file_name)
    into l_file_count
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

  select count(distinct file_name)
    into l_total_file_count
    from apex_appl_plugin_files
   where application_id = to_number('&&TARGET_APP_ID')
     and plugin_name = 'COM.SIMPLIFICA.APEX.ECHARTS';

  l_package_version := pk_apex_echarts.func_version;
  if l_plugin_count <> 1
     or l_file_count <> 8
     or l_total_file_count <> 8
     or l_package_version <> '1.1.0'
  then
    raise_application_error(-20988, 'Post-installation validation failed. Roll back and review the installation log.');
  end if;
end;
/

commit;
prompt Oracle APEX ECharts 1.1.0 installed successfully. No pages or regions were created.
exit success
