-- An invalid option is converted to sanitized fallback markup by FUNC_CHART_INLINE.
return pk_apex_echarts.func_chart_inline(
  p_id                     => 'synthetic_safe_error',
  p_option_json            => '{"series":[{"type":"custom","renderItem":"blocked"}]}',
  p_accessible_description => 'Synthetic blocked chart.',
  p_fallback_text          => 'The chart could not be displayed.'
);
