create or replace package pk_oae_synthetic_demo authid definer as
  function func_chart_spec return clob;
  function func_dashboard return clob;
end pk_oae_synthetic_demo;
/
