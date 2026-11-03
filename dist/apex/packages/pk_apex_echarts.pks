CREATE OR REPLACE EDITIONABLE PACKAGE "PK_APEX_ECHARTS" authid definer as
  /**
   * Neutral integration API for Oracle APEX 24.2 and Apache ECharts.
   * Keep domain SQL, metrics, filters, and authorization in consumer packages.
   */

  c_package_version constant varchar2(20) := '1.1.0';
  c_plugin_version  constant varchar2(20) := '1.1.0';
  c_runtime_version constant varchar2(20) := '1.1.0';
  c_schema_version  constant varchar2(10) := '1.0';
  c_echarts_version constant varchar2(20) := '6.1.0';

  function func_version
    return varchar2 deterministic;

  function func_validate_chart_spec(
    p_chart_spec in clob
  ) return clob;

  procedure proc_assert_chart_spec(
    p_chart_spec in clob
  );

  function func_chart(
    p_chart_spec     in clob,
    p_fallback_title in varchar2 default 'Gráfico indisponível',
    p_fallback_text  in varchar2 default null
  ) return clob;

  function func_chart_inline(
    p_id                     in varchar2,
    p_option_json            in clob,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2,
    p_overrides_json         in clob default null
  ) return clob;

  function func_chart_ajax(
    p_id                     in varchar2,
    p_process_static_id      in varchar2,
    p_items_to_submit        in apex_t_varchar2,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2,
    p_response_group         in varchar2 default null,
    p_overrides_json         in clob default null
  ) return clob;

  function func_ajax_result(
    p_chart_spec in clob,
    p_request_id in varchar2 default null
  ) return clob;

  function func_plugin_render(
    p_region              in apex_plugin.t_region,
    p_plugin              in apex_plugin.t_plugin,
    p_is_printer_friendly in boolean
  ) return apex_plugin.t_region_render_result;

  function func_plugin_ajax(
    p_region in apex_plugin.t_region,
    p_plugin in apex_plugin.t_plugin
  ) return apex_plugin.t_region_ajax_result;
end pk_apex_echarts;
/
