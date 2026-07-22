create or replace package body pk_oae_synthetic_demo as
  function func_chart_spec return clob is
  begin
    return to_clob('{"schemaVersion":"1.0","id":"synthetic_dashboard_bar","requiredRuntime":">=1.0.0 <2.0.0","preset":"bar_vertical","accessibility":{"description":"Synthetic orders by month.","fallbackText":"Orders: January 120, February 145, March 132.","emptyText":"No orders."},"data":{"mode":"inline","contract":"option","option":{"xAxis":{"type":"category"},"yAxis":{"type":"value"},"series":[{"name":"Orders","type":"bar","data":[["Jan",120],["Feb",145],["Mar",132]]}]}}}');
  end func_chart_spec;

  function func_dashboard return clob is
    l_result clob;
  begin
    l_result := to_clob('<section aria-labelledby="synthetic_dashboard_title"><h2 id="synthetic_dashboard_title">Synthetic operations snapshot</h2><p>Orders total: 397. The table remains the essential fallback.</p>');
    l_result := l_result || pk_apex_echarts.func_chart(func_chart_spec);
    l_result := l_result || '<table><caption>Orders by month</caption><thead><tr><th>Month</th><th>Orders</th></tr></thead><tbody><tr><td>Jan</td><td>120</td></tr><tr><td>Feb</td><td>145</td></tr><tr><td>Mar</td><td>132</td></tr></tbody></table></section>';
    return l_result;
  exception
    when others then
      return to_clob('<section role="alert"><h2>Snapshot unavailable</h2><p>The report could not be displayed.</p></section>');
  end func_dashboard;
end pk_oae_synthetic_demo;
/
