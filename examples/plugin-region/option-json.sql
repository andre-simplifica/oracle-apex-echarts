-- Synthetic OPTION_JSON source. Return exactly one row and one CLOB column.
select to_clob(
         '{' ||
         '"xAxis":{"type":"category"},' ||
         '"yAxis":{"type":"value"},' ||
         '"series":[{"name":"Orders","type":"bar",' ||
         '"data":[["Jan",120],["Feb",145],["Mar",132]]}]' ||
         '}'
       ) as option_json
  from dual
