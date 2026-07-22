-- Fixed APEX AJAX process source. Add a real authorization scheme in Page Designer.
begin
  sys.htp.prn(
    pk_apex_echarts.func_ajax_result(
      p_chart_spec => pk_oae_synthetic_demo.func_chart_spec,
      p_request_id => apex_application.g_x01
    )
  );
end;
