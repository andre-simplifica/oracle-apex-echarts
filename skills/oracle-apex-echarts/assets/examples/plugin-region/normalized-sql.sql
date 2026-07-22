-- Synthetic NORMALIZED_SQL source for a plug-in region.
select '2026-01' as x_value,
       120       as y_value,
       'Orders'  as series_name,
       'bar'     as series_type,
       'January' as item_label,
       null      as item_color,
       1         as sort_order
  from dual
union all
select '2026-02', 145, 'Orders', 'bar', 'February', null, 2 from dual
union all
select '2026-03', 132, 'Orders', 'bar', 'March', null, 3 from dual
order by sort_order
