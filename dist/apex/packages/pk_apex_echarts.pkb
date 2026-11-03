CREATE OR REPLACE EDITIONABLE PACKAGE BODY "PK_APEX_ECHARTS" as
  c_required_runtime constant varchar2(40) := '>=1.0.0 <2.0.0';
  c_default_error    constant varchar2(200) := 'Não foi possível exibir o gráfico.';

  type t_json_array_map is table of json_array_t index by varchar2(255);
  type t_varchar2_map   is table of varchar2(255) index by varchar2(255);

  function func_chart_spec_schema
    return clob
  is
  begin
    return q'~{
      "$schema":"https://json-schema.org/draft/2020-12/schema",
      "$id":"https://github.com/andre-simplifica/oracle-apex-echarts/raw/main/schemas/chart-spec.schema.json",
      "type":"object",
      "additionalProperties":false,
      "required":["schemaVersion","id","requiredRuntime","accessibility","data"],
      "properties":{
        "schemaVersion":{"const":"1.0"},
        "id":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_-]{0,79}$"},
        "generatedBy":{
          "type":"object",
          "additionalProperties":false,
          "properties":{
            "packageVersion":{"type":"string","pattern":"^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?$"},
            "pluginVersion":{"type":"string","pattern":"^[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?$"}
          }
        },
        "requiredRuntime":{"const":">=1.0.0 <2.0.0"},
        "theme":{"type":"string","pattern":"^[a-z][a-z0-9_-]{0,63}$"},
        "renderer":{"enum":["canvas","svg"]},
        "preset":{"enum":["bar_vertical","bar_horizontal","bar_stacked","line","area","bar_line","pie","donut","gauge","scatter","advanced"]},
        "size":{
          "type":"object",
          "additionalProperties":false,
          "properties":{"minHeight":{"type":"integer","minimum":180,"maximum":1600}}
        },
        "accessibility":{
          "type":"object",
          "additionalProperties":false,
          "required":["description","fallbackText"],
          "properties":{
            "description":{"type":"string","minLength":1,"maxLength":1000},
            "fallbackText":{"type":"string","minLength":1,"maxLength":1000},
            "emptyText":{"type":"string","minLength":1,"maxLength":1000},
            "essential":{"type":"boolean"},
            "decal":{"type":"boolean"}
          }
        },
        "behavior":{
          "type":"object",
          "additionalProperties":false,
          "properties":{
            "animation":{"type":"boolean"},
            "animationDuration":{"type":"integer","minimum":0,"maximum":10000},
            "download":{"type":"boolean"},
            "downloadFileName":{"type":"string","pattern":"^[A-Za-z0-9_-]{1,80}$"},
            "zoom":{"type":"boolean"},
            "legend":{
              "type":"object",
              "additionalProperties":false,
              "properties":{
                "show":{"type":"boolean"},
                "position":{"enum":["auto","top","bottom","left","right"]}
              }
            },
            "labels":{"enum":["auto","show","hide"]},
            "tooltip":{"type":"boolean"},
            "aria":{"type":"boolean"},
            "formatter":{"enum":["integer","decimal_2","percent","currency_brl","short_number","date_br","datetime_br"]},
            "clickEvent":{"type":"boolean"},
            "selectionEvent":{"type":"boolean"},
            "restore":{"type":"boolean"},
            "magicType":{"type":"array","minItems":1,"maxItems":4,"uniqueItems":true,"items":{"enum":["line","bar","stack","tiled"]}},
            "refreshStrategy":{"enum":["replace","merge"]}
          }
        },
        "integration":{
          "type":"object",
          "additionalProperties":false,
          "properties":{
            "regionId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_:-]{0,254}$"},
            "ajaxIdentifier":{"type":"string","minLength":1,"maxLength":4000},
            "itemsToSubmit":{
              "type":"array",
              "maxItems":100,
              "uniqueItems":true,
              "items":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,254}$"}
            },
            "responseGroup":{"type":"string","pattern":"^[a-z][a-z0-9_-]{0,63}$"}
          }
        },
        "data":{
          "oneOf":[
            {
              "type":"object",
              "additionalProperties":false,
              "required":["mode","contract","option"],
              "properties":{"mode":{"const":"inline"},"contract":{"const":"option"},"option":{"type":"object"}}
            },
            {
              "type":"object",
              "additionalProperties":false,
              "required":["mode","contract","ajax"],
              "properties":{
                "mode":{"const":"ajax"},
                "contract":{"const":"option"},
                "ajax":{
                  "type":"object",
                  "additionalProperties":false,
                  "required":["transport"],
                  "properties":{
                    "transport":{"enum":["apexPlugin","apexProcess"]},
                    "processStaticId":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9_:-]{0,254}$"},
                    "itemsToSubmit":{
                      "type":"array",
                      "maxItems":100,
                      "uniqueItems":true,
                      "items":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,254}$"}
                    },
                    "responseGroup":{"type":"string","pattern":"^[a-z][a-z0-9_-]{0,63}$"}
                  },
                  "allOf":[{
                    "if":{"properties":{"transport":{"const":"apexProcess"}}},
                    "then":{"required":["processStaticId"]},
                    "else":{"not":{"required":["processStaticId"]}}
                  }]
                }
              }
            }
          ]
        }
      }
    }~';
  end func_chart_spec_schema;

  function func_version
    return varchar2 deterministic
  is
  begin
    return c_package_version;
  end func_version;

  procedure proc_append(
    p_target in out nocopy clob,
    p_value  in varchar2
  )
  is
  begin
    if p_value is not null then
      dbms_lob.writeappend(p_target, length(p_value), p_value);
    end if;
  end proc_append;

  procedure proc_print_clob(
    p_value in clob
  )
  is
    l_offset pls_integer := 1;
    l_chunk  varchar2(16000);
  begin
    while l_offset <= dbms_lob.getlength(p_value) loop
      l_chunk := dbms_lob.substr(p_value, 16000, l_offset);
      sys.htp.prn(l_chunk);
      l_offset := l_offset + length(l_chunk);
    end loop;
  end proc_print_clob;

  function func_escape_script_json(
    p_json in clob
  ) return clob
  is
    l_result clob := p_json;
  begin
    l_result := replace(l_result, '&', '\u0026');
    l_result := replace(l_result, '<', '\u003c');
    l_result := replace(l_result, '>', '\u003e');
    l_result := replace(l_result, unistr('\2028'), '\u2028');
    l_result := replace(l_result, unistr('\2029'), '\u2029');
    return l_result;
  end func_escape_script_json;

  function func_token_allowed(
    p_value   in varchar2,
    p_allowed in varchar2
  ) return boolean
  is
  begin
    return instr(',' || p_allowed || ',', ',' || p_value || ',') > 0;
  end func_token_allowed;

  function func_json_string(
    p_element in json_element_t
  ) return varchar2
  is
    l_wrapper json_object_t := json_object_t();
  begin
    l_wrapper.put('value', p_element);
    return l_wrapper.get_string('value');
  end func_json_string;

  procedure proc_validate_option_element(
    p_element   in json_element_t,
    p_path      in varchar2,
    p_depth     in pls_integer,
    p_root      in boolean,
    p_key_count in out nocopy pls_integer
  )
  is
    c_root_keys constant varchar2(1000) :=
      'animation,animationDuration,aria,backgroundColor,calendar,color,dataZoom,dataset,grid,legend,media,series,textStyle,title,toolbox,tooltip,visualMap,xAxis,yAxis';
    c_nested_keys constant varchar2(8000) :=
      'activeOpacity,align,areaStyle,axisLabel,axisLine,axisPointer,axisTick,avoidLabelOverlap,backgroundColor,barGap,barMaxWidth,barMinWidth,barWidth,borderColor,borderRadius,borderWidth,bottom,calendarIndex,cellSize,center,children,clip,clockwise,color,colorAlpha,colorLightness,colorSaturation,colorStops,confine,connectNulls,containLabel,coordinateSystem,data,dataZoomIndex,dayLabel,decal,detail,dimension,dimensions,disabled,distance,edgeLabel,emphasis,enabled,encode,end,endAngle,feature,fontFamily,fontSize,fontStyle,fontWeight,gapWidth,height,id,inRange,inside,interval,inverse,itemGap,itemHeight,itemStyle,itemWidth,label,labelLayout,layout,left,legend,levels,lineStyle,links,max,maxAngle,maxHeight,maxInterval,maxSize,maxWidth,min,minAngle,minHeight,minInterval,minSize,minWidth,monthLabel,name,nameGap,nameLocation,nameTextStyle,nodeAlign,nodeGap,nodeWidth,nodes,offset,opacity,option,order,orient,padding,pixelRatio,position,progress,query,radius,range,renderMode,restore,right,roam,rotate,sampling,saveAsImage,scale,selectedMode,seriesIndex,shadowBlur,shadowColor,shadowOffsetX,shadowOffsetY,show,showBackground,showSymbol,silent,smooth,sort,source,splitArea,splitLine,splitNumber,stack,start,startAngle,step,stillShowZeroSum,symbol,symbolSize,target,text,textStyle,top,trigger,type,value,valueAnimation,width,x,xAxisIndex,y,yAxisIndex,yearLabel';
    c_forbidden_keys constant varchar2(500) :=
      '__proto__,constructor,dataView,extraCssText,formatter,link,prototype,reg,renderItem,transform,url';
    c_series_types constant varchar2(200) :=
      'bar,line,pie,gauge,scatter';
    l_array  json_array_t;
    l_keys   json_key_list;
    l_object json_object_t;
    l_scalar json_scalar_t;
    l_key    varchar2(4000);
    l_value  varchar2(32767);
  begin
    if p_depth > 16 then
      raise_application_error(-20072, 'ChartSpec inválido.');
    end if;

    if p_element.is_object then
      l_object := treat(p_element as json_object_t);
      l_keys := l_object.get_keys;
      for i in 1 .. l_keys.count loop
        l_key := l_keys(i);
        p_key_count := p_key_count + 1;
        if p_key_count > 5000
           or func_token_allowed(l_key, c_forbidden_keys)
           or (p_root and not func_token_allowed(l_key, c_root_keys))
           or (not p_root and not func_token_allowed(l_key, c_nested_keys))
        then
          raise_application_error(-20072, 'ChartSpec inválido.');
        end if;

        if l_key = 'type'
           and instr(p_path, '.series') > 0
           and l_object.get(l_key).is_string
        then
          l_value := func_json_string(l_object.get(l_key));
          if not func_token_allowed(l_value, c_series_types) then
            raise_application_error(-20072, 'ChartSpec inválido.');
          end if;
        end if;

        proc_validate_option_element(
          p_element   => l_object.get(l_key),
          p_path      => p_path || '.' || l_key,
          p_depth     => p_depth + 1,
          p_root      => false,
          p_key_count => p_key_count
        );
      end loop;
    elsif p_element.is_array then
      l_array := treat(p_element as json_array_t);
      if l_array.get_size > 0 then
        for i in 0 .. l_array.get_size - 1 loop
          proc_validate_option_element(
            p_element   => l_array.get(i),
            p_path      => p_path || '[' || to_char(i) || ']',
            p_depth     => p_depth + 1,
            p_root      => false,
            p_key_count => p_key_count
          );
        end loop;
      end if;
    elsif p_element.is_string then
      l_value := trim(func_json_string(p_element));
      if regexp_like(l_value, '^(javascript|vbscript|data|file|ftp|https?):', 'i')
         or substr(l_value, 1, 2) = '//'
         or regexp_like(l_value, '<[[:space:]]*/?[[:space:]]*script([[:space:]>/]|$)', 'i')
      then
        raise_application_error(-20072, 'ChartSpec inválido.');
      end if;
    elsif p_element.is_number then
      l_scalar := treat(p_element as json_scalar_t);
      if not regexp_like(l_scalar.to_string, '^-?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$') then
        raise_application_error(-20072, 'ChartSpec inválido.');
      end if;
    end if;
  end proc_validate_option_element;

  procedure proc_validate_security(
    p_chart_spec in clob
  )
  is
    l_ajax      json_object_t;
    l_items     json_array_t;
    l_item      varchar2(255);
    l_transport varchar2(30);
    l_data      json_object_t;
    l_data_node json_object_t;
    l_option    json_element_t;
    l_key_count pls_integer := 0;
  begin
    l_data := json_object_t.parse(p_chart_spec);
    l_data_node := l_data.get_object('data');
    if l_data_node.get_string('mode') = 'inline' then
      l_option := l_data_node.get('option');
      proc_validate_option_element(
        p_element   => l_option,
        p_path      => '$.data.option',
        p_depth     => 0,
        p_root      => true,
        p_key_count => l_key_count
      );
    elsif l_data_node.get_string('mode') = 'ajax' then
      l_ajax := l_data_node.get_object('ajax');
      l_transport := l_ajax.get_string('transport');
      if l_transport not in ('apexPlugin', 'apexProcess') then
        raise_application_error(-20072, 'ChartSpec inválido.');
      end if;
      if l_transport = 'apexProcess'
         and (not l_ajax.has('processStaticId')
              or not regexp_like(l_ajax.get_string('processStaticId'), '^[A-Za-z][A-Za-z0-9_:-]{0,254}$'))
      then
        raise_application_error(-20072, 'ChartSpec inválido.');
      end if;
      if l_ajax.has('responseGroup')
         and not regexp_like(l_ajax.get_string('responseGroup'), '^[a-z][a-z0-9_-]{0,63}$')
      then
        raise_application_error(-20072, 'ChartSpec inválido.');
      end if;
      if l_ajax.has('itemsToSubmit') then
        l_items := l_ajax.get_array('itemsToSubmit');
        if l_items.get_size > 100 then
          raise_application_error(-20072, 'ChartSpec inválido.');
        end if;
        if l_items.get_size > 0 then
          for i in 0 .. l_items.get_size - 1 loop
            l_item := l_items.get_string(i);
            if not regexp_like(l_item, '^[A-Z][A-Z0-9_]{0,254}$') then
              raise_application_error(-20072, 'ChartSpec inválido.');
            end if;
          end loop;
        end if;
      end if;
    end if;
  exception
    when others then
      if sqlcode between -20079 and -20070 then
        raise;
      end if;
      raise_application_error(-20072, 'ChartSpec inválido.');
  end proc_validate_security;

  procedure proc_validate_schema(
    p_chart_spec in clob
  )
  is
    l_data    json;
    l_errors  json;
    l_is_valid boolean;
    l_schema  json;
  begin
    l_data := json(p_chart_spec);
    l_schema := json(func_chart_spec_schema);
    sys.dbms_json_schema.is_valid(l_data, l_schema, l_is_valid, l_errors);
    if not l_is_valid then
      raise_application_error(-20071, 'ChartSpec inválido.');
    end if;
  exception
    when others then
      if sqlcode between -20079 and -20070 then
        raise;
      end if;
      raise_application_error(-20071, 'ChartSpec inválido.');
  end proc_validate_schema;

  procedure proc_assert_chart_spec(
    p_chart_spec in clob
  )
  is
  begin
    if p_chart_spec is null then
      raise_application_error(-20070, 'ChartSpec inválido.');
    end if;
    proc_validate_schema(p_chart_spec);
    proc_validate_security(p_chart_spec);
  end proc_assert_chart_spec;

  function func_validate_chart_spec(
    p_chart_spec in clob
  ) return clob
  is
    l_result json_object_t := json_object_t();
  begin
    proc_assert_chart_spec(p_chart_spec);
    l_result.put('valid', true);
    l_result.put('schemaVersion', c_schema_version);
    return l_result.to_clob;
  exception
    when others then
      l_result.put('valid', false);
      l_result.put('schemaVersion', c_schema_version);
      l_result.put('message', 'ChartSpec inválido.');
      return l_result.to_clob;
  end func_validate_chart_spec;

  function func_merge_overrides(
    p_spec           in json_object_t,
    p_overrides_json in clob
  ) return json_object_t
  is
    c_allowed constant varchar2(200) :=
      'theme,renderer,preset,size,accessibility,behavior';
    l_keys      json_key_list;
    l_nested    json_key_list;
    l_overrides json_object_t;
    l_patch     json_object_t;
    l_target    json_object_t;
    l_result    json_object_t;
  begin
    l_result := treat(p_spec.clone() as json_object_t);
    if p_overrides_json is null then
      return l_result;
    end if;

    l_overrides := json_object_t.parse(p_overrides_json);
    l_keys := l_overrides.get_keys;
    for i in 1 .. l_keys.count loop
      if not func_token_allowed(l_keys(i), c_allowed) then
        raise_application_error(-20073, 'Configuração do gráfico inválida.');
      end if;
      if l_overrides.get(l_keys(i)).is_object and l_result.has(l_keys(i)) then
        l_patch := l_overrides.get_object(l_keys(i));
        l_target := l_result.get_object(l_keys(i));
        l_nested := l_patch.get_keys;
        for j in 1 .. l_nested.count loop
          l_target.put(l_nested(j), l_patch.get(l_nested(j)));
        end loop;
        l_result.put(l_keys(i), l_target);
      else
        l_result.put(l_keys(i), l_overrides.get(l_keys(i)));
      end if;
    end loop;
    return l_result;
  exception
    when others then
      if sqlcode = -20073 then
        raise;
      end if;
      raise_application_error(-20073, 'Configuração do gráfico inválida.');
  end func_merge_overrides;

  function func_base_spec(
    p_id                     in varchar2,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2
  ) return json_object_t
  is
    l_accessibility json_object_t := json_object_t();
    l_behavior      json_object_t := json_object_t();
    l_generated_by  json_object_t := json_object_t();
    l_size          json_object_t := json_object_t();
    l_spec          json_object_t := json_object_t();
  begin
    l_generated_by.put('packageVersion', c_package_version);
    l_generated_by.put('pluginVersion', c_plugin_version);
    l_accessibility.put('description', p_accessible_description);
    l_accessibility.put('fallbackText', p_fallback_text);
    l_accessibility.put('emptyText', 'Não há dados para exibir.');
    l_accessibility.put('essential', true);
    l_accessibility.put('decal', false);
    l_behavior.put('animation', true);
    l_behavior.put('animationDuration', 500);
    l_behavior.put('download', false);
    l_behavior.put('zoom', false);
    l_behavior.put('labels', 'auto');
    l_behavior.put('tooltip', true);
    l_behavior.put('aria', true);
    l_behavior.put('clickEvent', true);
    l_behavior.put('selectionEvent', true);
    l_behavior.put('restore', false);
    l_behavior.put('refreshStrategy', 'replace');
    l_size.put('minHeight', 320);

    l_spec.put('schemaVersion', c_schema_version);
    l_spec.put('id', p_id);
    l_spec.put('generatedBy', l_generated_by);
    l_spec.put('requiredRuntime', c_required_runtime);
    l_spec.put('renderer', 'canvas');
    l_spec.put('size', l_size);
    l_spec.put('accessibility', l_accessibility);
    l_spec.put('behavior', l_behavior);
    return l_spec;
  end func_base_spec;

  function func_build_inline_spec(
    p_id                     in varchar2,
    p_option                 in json_object_t,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2,
    p_overrides_json         in clob default null,
    p_region_id              in varchar2 default null,
    p_ajax_identifier        in varchar2 default null,
    p_items_to_submit        in apex_t_varchar2 default apex_t_varchar2()
  ) return clob
  is
    l_clob         clob;
    l_data         json_object_t := json_object_t();
    l_integration  json_object_t := json_object_t();
    l_items        json_array_t := json_array_t();
    l_spec         json_object_t;
    l_submit_items apex_t_varchar2 := nvl(p_items_to_submit, apex_t_varchar2());
  begin
    l_spec := func_base_spec(
      p_id                     => p_id,
      p_accessible_description => p_accessible_description,
      p_fallback_text          => p_fallback_text
    );
    l_data.put('mode', 'inline');
    l_data.put('contract', 'option');
    l_data.put('option', p_option);
    l_spec.put('data', l_data);
    if p_region_id is not null then
      l_integration.put('regionId', p_region_id);
    end if;
    if p_ajax_identifier is not null then
      l_integration.put('ajaxIdentifier', p_ajax_identifier);
      if l_submit_items.count > 0 then
        for i in 1 .. l_submit_items.count loop
          if l_submit_items(i) is not null then
            l_items.append(upper(trim(l_submit_items(i))));
          end if;
        end loop;
      end if;
      l_integration.put('itemsToSubmit', l_items);
    end if;
    if p_region_id is not null or p_ajax_identifier is not null then
      l_spec.put('integration', l_integration);
    end if;
    l_spec := func_merge_overrides(l_spec, p_overrides_json);
    l_clob := l_spec.to_clob;
    proc_assert_chart_spec(l_clob);
    return l_clob;
  end func_build_inline_spec;

  function func_build_ajax_spec(
    p_id                     in varchar2,
    p_transport              in varchar2,
    p_process_static_id      in varchar2,
    p_ajax_identifier        in varchar2,
    p_region_id              in varchar2,
    p_items_to_submit        in apex_t_varchar2,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2,
    p_response_group         in varchar2,
    p_overrides_json         in clob
  ) return clob
  is
    l_ajax        json_object_t := json_object_t();
    l_data        json_object_t := json_object_t();
    l_integration json_object_t := json_object_t();
    l_items       json_array_t := json_array_t();
    l_spec        json_object_t;
    l_submit_items apex_t_varchar2 := nvl(p_items_to_submit, apex_t_varchar2());
    l_clob        clob;
  begin
    l_spec := func_base_spec(
      p_id                     => p_id,
      p_accessible_description => p_accessible_description,
      p_fallback_text          => p_fallback_text
    );
    l_ajax.put('transport', p_transport);
    if p_process_static_id is not null then
      l_ajax.put('processStaticId', p_process_static_id);
    end if;
    if p_response_group is not null then
      l_ajax.put('responseGroup', p_response_group);
    end if;
    if l_submit_items.count > 0 then
      for i in 1 .. l_submit_items.count loop
        if l_submit_items(i) is not null then
          l_items.append(upper(trim(l_submit_items(i))));
        end if;
      end loop;
    end if;
    l_ajax.put('itemsToSubmit', l_items);
    l_data.put('mode', 'ajax');
    l_data.put('contract', 'option');
    l_data.put('ajax', l_ajax);
    l_spec.put('data', l_data);
    if p_ajax_identifier is not null then
      l_integration.put('ajaxIdentifier', p_ajax_identifier);
    end if;
    if p_region_id is not null then
      l_integration.put('regionId', p_region_id);
    end if;
    if p_ajax_identifier is not null or p_region_id is not null then
      l_spec.put('integration', l_integration);
    end if;
    l_spec := func_merge_overrides(l_spec, p_overrides_json);
    l_clob := l_spec.to_clob;
    proc_assert_chart_spec(l_clob);
    return l_clob;
  end func_build_ajax_spec;

  function func_safe_fallback(
    p_title in varchar2,
    p_text  in varchar2
  ) return clob
  is
    l_result clob;
  begin
    dbms_lob.createtemporary(l_result, true);
    proc_append(l_result, '<section class="oracle-apex-echarts" data-oae-state="error">');
    proc_append(l_result, '<div class="oracle-apex-echarts__fallback" role="alert">');
    proc_append(l_result, '<strong>' || apex_escape.html(nvl(p_title, 'Gráfico indisponível')) || '</strong> ');
    proc_append(l_result, apex_escape.html(nvl(p_text, c_default_error)));
    proc_append(l_result, '</div></section>');
    return l_result;
  end func_safe_fallback;

  function func_chart(
    p_chart_spec     in clob,
    p_fallback_title in varchar2 default 'Gráfico indisponível',
    p_fallback_text  in varchar2 default null
  ) return clob
  is
    l_accessibility json_object_t;
    l_description   varchar2(1000);
    l_fallback      varchar2(1000);
    l_id            varchar2(80);
    l_json          clob;
    l_result        clob;
    l_spec          json_object_t;
    l_spec_id       varchar2(100);
  begin
    proc_assert_chart_spec(p_chart_spec);
    l_spec := json_object_t.parse(p_chart_spec);
    l_accessibility := l_spec.get_object('accessibility');
    l_id := l_spec.get_string('id');
    l_spec_id := l_id || '__spec';
    l_description := l_accessibility.get_string('description');
    l_fallback := nvl(p_fallback_text, l_accessibility.get_string('fallbackText'));
    l_json := func_escape_script_json(p_chart_spec);

    dbms_lob.createtemporary(l_result, true);
    proc_append(l_result, '<section id="' || apex_escape.html_attribute(l_id) || '" class="oracle-apex-echarts"');
    proc_append(l_result, ' data-oracle-apex-echarts="1" data-oae-state="loading"');
    proc_append(l_result, ' data-oae-spec-id="' || apex_escape.html_attribute(l_spec_id) || '">');
    proc_append(l_result, '<div class="oracle-apex-echarts__canvas" tabindex="0"');
    proc_append(l_result, ' aria-label="' || apex_escape.html_attribute(l_description) || '"></div>');
    proc_append(l_result, '<div class="oracle-apex-echarts__status" role="status" aria-live="polite">Carregando gráfico</div>');
    proc_append(l_result, '<p class="oracle-apex-echarts__fallback" role="alert" hidden>');
    proc_append(l_result, apex_escape.html(l_fallback));
    proc_append(l_result, '</p></section>');
    proc_append(l_result, '<script type="application/json" id="' || apex_escape.html_attribute(l_spec_id) || '">');
    dbms_lob.append(l_result, l_json);
    proc_append(l_result, '</script>');
    return l_result;
  exception
    when others then
      apex_debug.error('PK_APEX_ECHARTS: falha sanitizada ao montar gráfico.');
      return func_safe_fallback(p_fallback_title, p_fallback_text);
  end func_chart;

  function func_chart_inline(
    p_id                     in varchar2,
    p_option_json            in clob,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2,
    p_overrides_json         in clob default null
  ) return clob
  is
    l_spec clob;
  begin
    l_spec := func_build_inline_spec(
      p_id                     => p_id,
      p_option                 => json_object_t.parse(p_option_json),
      p_accessible_description => p_accessible_description,
      p_fallback_text          => p_fallback_text,
      p_overrides_json         => p_overrides_json
    );
    return func_chart(l_spec, 'Gráfico indisponível', p_fallback_text);
  exception
    when others then
      apex_debug.error('PK_APEX_ECHARTS: configuração inline inválida.');
      return func_safe_fallback('Gráfico indisponível', p_fallback_text);
  end func_chart_inline;

  function func_chart_ajax(
    p_id                     in varchar2,
    p_process_static_id      in varchar2,
    p_items_to_submit        in apex_t_varchar2,
    p_accessible_description in varchar2,
    p_fallback_text          in varchar2,
    p_response_group         in varchar2 default null,
    p_overrides_json         in clob default null
  ) return clob
  is
    l_spec clob;
  begin
    l_spec := func_build_ajax_spec(
      p_id                     => p_id,
      p_transport              => 'apexProcess',
      p_process_static_id      => p_process_static_id,
      p_ajax_identifier        => null,
      p_region_id              => null,
      p_items_to_submit        => p_items_to_submit,
      p_accessible_description => p_accessible_description,
      p_fallback_text          => p_fallback_text,
      p_response_group         => p_response_group,
      p_overrides_json         => p_overrides_json
    );
    return func_chart(l_spec, 'Gráfico indisponível', p_fallback_text);
  exception
    when others then
      apex_debug.error('PK_APEX_ECHARTS: configuração AJAX inválida.');
      return func_safe_fallback('Gráfico indisponível', p_fallback_text);
  end func_chart_ajax;

  function func_ajax_result(
    p_chart_spec in clob,
    p_request_id in varchar2 default null
  ) return clob
  is
    l_result json_object_t := json_object_t();
  begin
    proc_assert_chart_spec(p_chart_spec);
    if p_request_id is not null then
      l_result.put('requestId', p_request_id);
    end if;
    l_result.put('chartSpec', json_object_t.parse(p_chart_spec));
    return l_result.to_clob;
  exception
    when others then
      l_result := json_object_t();
      l_result.put('chartError', true);
      l_result.put('message', c_default_error);
      return l_result.to_clob;
  end func_ajax_result;

  function func_series_type(
    p_preset      in varchar2,
    p_series_type in varchar2
  ) return varchar2
  is
    l_type varchar2(40) := lower(trim(p_series_type));
  begin
    if p_preset = 'bar_line' and l_type in ('bar', 'line') then
      return l_type;
    end if;
    case p_preset
      when 'line'           then return 'line';
      when 'area'           then return 'line';
      when 'pie'            then return 'pie';
      when 'donut'          then return 'pie';
      when 'gauge'          then return 'gauge';
      when 'scatter'        then return 'scatter';
      when 'bar_horizontal' then return 'bar';
      when 'bar_stacked'    then return 'bar';
      else return 'bar';
    end case;
  end func_series_type;

  function func_option_from_normalized_sql(
    p_region in apex_plugin.t_region,
    p_preset in varchar2
  ) return json_object_t
  is
    type t_point_record is record (
      series_name varchar2(255),
      item        json_object_t,
      sort_order  number
    );
    type t_point_table is table of t_point_record index by pls_integer;

    l_context         apex_exec.t_context;
    l_context_open    boolean := false;
    l_data_by_series  t_json_array_map;
    l_type_by_series  t_varchar2_map;
    l_item            json_object_t;
    l_item_color      varchar2(40);
    l_item_label      varchar2(4000);
    l_option          json_object_t := json_object_t();
    l_pair            json_array_t;
    l_pos_item_color  pls_integer;
    l_pos_item_label  pls_integer;
    l_pos_series_name pls_integer;
    l_pos_series_type pls_integer;
    l_pos_sort_order  pls_integer;
    l_pos_x           pls_integer;
    l_pos_y           pls_integer;
    l_point_count     pls_integer := 0;
    l_points          t_point_table;
    l_sorted_points   t_point_table;
    l_series          json_object_t;
    l_series_array    json_array_t := json_array_t();
    l_series_names    apex_t_varchar2 := apex_t_varchar2();
    l_series_name     varchar2(255);
    l_series_type     varchar2(40);
    l_x               varchar2(4000);
    l_y               number;
    l_sort_order       number;
    l_x_axis          json_object_t := json_object_t();
    l_y_axis          json_object_t := json_object_t();

    function func_sort_before(
      p_left  in t_point_record,
      p_right in t_point_record
    ) return boolean
    is
    begin
      if p_left.sort_order is null then
        return p_right.sort_order is null;
      elsif p_right.sort_order is null then
        return true;
      end if;
      return p_left.sort_order <= p_right.sort_order;
    end func_sort_before;

    procedure proc_merge_sort(
      p_left  in pls_integer,
      p_right in pls_integer
    )
    is
      i        pls_integer;
      j        pls_integer;
      k        pls_integer;
      l_middle pls_integer;
    begin
      if p_left >= p_right then
        return;
      end if;
      l_middle := trunc((p_left + p_right) / 2);
      proc_merge_sort(p_left, l_middle);
      proc_merge_sort(l_middle + 1, p_right);
      i := p_left;
      j := l_middle + 1;
      k := p_left;
      while i <= l_middle and j <= p_right loop
        if func_sort_before(l_points(i), l_points(j)) then
          l_sorted_points(k) := l_points(i);
          i := i + 1;
        else
          l_sorted_points(k) := l_points(j);
          j := j + 1;
        end if;
        k := k + 1;
      end loop;
      while i <= l_middle loop
        l_sorted_points(k) := l_points(i);
        i := i + 1;
        k := k + 1;
      end loop;
      while j <= p_right loop
        l_sorted_points(k) := l_points(j);
        j := j + 1;
        k := k + 1;
      end loop;
      for idx in p_left .. p_right loop
        l_points(idx) := l_sorted_points(idx);
      end loop;
    end proc_merge_sort;
  begin
    if p_preset = 'advanced' then
      raise_application_error(-20076, 'Preset avançado exige OPTION_JSON.');
    end if;

    l_context := apex_exec.open_query_context(
      p_location        => apex_exec.c_location_local_db,
      p_sql_query       => p_region.source,
      p_total_row_count => false
    );
    l_context_open := true;
    l_pos_x := apex_exec.get_column_position(l_context, 'X_VALUE');
    l_pos_y := apex_exec.get_column_position(l_context, 'Y_VALUE');
    l_pos_series_name := apex_exec.get_column_position(l_context, 'SERIES_NAME');
    l_pos_series_type := apex_exec.get_column_position(l_context, 'SERIES_TYPE', p_is_required => false);
    l_pos_item_label := apex_exec.get_column_position(l_context, 'ITEM_LABEL', p_is_required => false);
    l_pos_item_color := apex_exec.get_column_position(l_context, 'ITEM_COLOR', p_is_required => false);
    l_pos_sort_order := apex_exec.get_column_position(l_context, 'SORT_ORDER', p_is_required => false);

    while apex_exec.next_row(l_context) loop
      l_x := apex_exec.get_varchar2(l_context, l_pos_x);
      l_y := apex_exec.get_number(l_context, l_pos_y);
      l_series_name := nvl(apex_exec.get_varchar2(l_context, l_pos_series_name), 'Série');
      l_series_type := case when l_pos_series_type is not null then apex_exec.get_varchar2(l_context, l_pos_series_type) end;
      l_item_label := case when l_pos_item_label is not null then apex_exec.get_varchar2(l_context, l_pos_item_label) end;
      l_item_color := case when l_pos_item_color is not null then apex_exec.get_varchar2(l_context, l_pos_item_color) end;
      l_sort_order := case when l_pos_sort_order is not null then apex_exec.get_number(l_context, l_pos_sort_order) end;

      if not l_data_by_series.exists(l_series_name) then
        l_data_by_series(l_series_name) := json_array_t();
        l_type_by_series(l_series_name) := func_series_type(p_preset, l_series_type);
        l_series_names.extend;
        l_series_names(l_series_names.count) := l_series_name;
      end if;
      l_item := json_object_t();
      if p_preset in ('pie', 'donut', 'gauge') then
        l_item.put('name', nvl(l_item_label, l_x));
        l_item.put('value', l_y);
      else
        l_pair := json_array_t();
        if p_preset = 'bar_horizontal' then
          l_pair.append(l_y);
          l_pair.append(l_x);
        else
          l_pair.append(l_x);
          l_pair.append(l_y);
        end if;
        l_item.put('value', l_pair);
        if l_item_label is not null then
          l_item.put('name', l_item_label);
        end if;
      end if;
      if l_item_color is not null then
        if not regexp_like(l_item_color, '^#[0-9A-Fa-f]{6}$') then
          raise_application_error(-20074, 'Cor do gráfico inválida.');
        end if;
        declare
          l_style json_object_t := json_object_t();
        begin
          l_style.put('color', l_item_color);
          l_item.put('itemStyle', l_style);
        end;
      end if;
      l_point_count := l_point_count + 1;
      l_points(l_point_count).series_name := l_series_name;
      l_points(l_point_count).item := l_item;
      l_points(l_point_count).sort_order := l_sort_order;
    end loop;
    apex_exec.close(l_context);
    l_context_open := false;

    if l_pos_sort_order is not null and l_point_count > 1 then
      proc_merge_sort(1, l_point_count);
    end if;

    if l_point_count > 0 then
      for i in 1 .. l_point_count loop
        l_series_name := l_points(i).series_name;
        if p_preset = 'gauge' and l_data_by_series(l_series_name).get_size > 0 then
          raise_application_error(-20075, 'Gauge aceita um valor por série.');
        end if;
        l_data_by_series(l_series_name).append(l_points(i).item);
      end loop;
    end if;

    if l_series_names.count > 0 then
      for i in 1 .. l_series_names.count loop
        l_series_name := l_series_names(i);
        l_series := json_object_t();
        l_series.put('name', l_series_name);
        l_series.put('type', l_type_by_series(l_series_name));
        l_series.put('data', l_data_by_series(l_series_name));
        if p_preset = 'area' then
          l_series.put('areaStyle', json_object_t());
        elsif p_preset = 'bar_stacked' then
          l_series.put('stack', 'total');
        elsif p_preset = 'donut' then
          declare
            l_radius json_array_t := json_array_t();
          begin
            l_radius.append('45%');
            l_radius.append('72%');
            l_series.put('radius', l_radius);
          end;
        end if;
        l_series_array.append(l_series);
      end loop;
    end if;

    if p_preset not in ('pie', 'donut', 'gauge') then
      if p_preset = 'bar_horizontal' then
        l_x_axis.put('type', 'value');
        l_y_axis.put('type', 'category');
      else
        l_x_axis.put('type', case when p_preset = 'scatter' then 'value' else 'category' end);
        l_y_axis.put('type', 'value');
      end if;
      l_option.put('xAxis', l_x_axis);
      l_option.put('yAxis', l_y_axis);
    end if;
    l_option.put('series', l_series_array);
    return l_option;
  exception
    when others then
      if l_context_open then
        apex_exec.close(l_context);
      end if;
      raise;
  end func_option_from_normalized_sql;

  function func_option_from_json_sql(
    p_region in apex_plugin.t_region
  ) return json_object_t
  is
    l_context      apex_exec.t_context;
    l_context_open boolean := false;
    l_option       clob;
    l_position     pls_integer;
  begin
    l_context := apex_exec.open_query_context(
      p_location        => apex_exec.c_location_local_db,
      p_sql_query       => p_region.source,
      p_total_row_count => false
    );
    l_context_open := true;
    l_position := apex_exec.get_column_position(l_context, 'OPTION_JSON');
    if apex_exec.next_row(l_context) then
      l_option := apex_exec.get_clob(l_context, l_position);
      if apex_exec.next_row(l_context) then
        raise_application_error(-20077, 'OPTION_JSON deve retornar uma linha.');
      end if;
    end if;
    apex_exec.close(l_context);
    l_context_open := false;
    if l_option is null then
      return json_object_t.parse('{"series":[]}');
    end if;
    return json_object_t.parse(l_option);
  exception
    when others then
      if l_context_open then
        apex_exec.close(l_context);
      end if;
      raise;
  end func_option_from_json_sql;

  function func_project_message(
    p_plugin  in apex_plugin.t_plugin,
    p_name    in varchar2,
    p_default in varchar2
  ) return varchar2
  is
    l_messages json_object_t;
    l_profile  json_object_t;
    l_value    varchar2(32767);
  begin
    if p_plugin.attribute_02 is null then
      return p_default;
    end if;
    l_profile := json_object_t.parse(p_plugin.attribute_02);
    if not l_profile.has('messages') then
      return p_default;
    end if;
    l_messages := l_profile.get_object('messages');
    if l_messages is null or not l_messages.has(p_name) then
      return p_default;
    end if;
    l_value := l_messages.get_string(p_name);
    if l_value is null or length(l_value) > 1000 then
      return p_default;
    end if;
    return l_value;
  exception
    when others then
      return p_default;
  end func_project_message;

  function func_plugin_overrides(
    p_region in apex_plugin.t_region,
    p_plugin in apex_plugin.t_plugin
  ) return clob
  is
    l_behavior json_object_t := json_object_t();
    l_accessibility json_object_t := json_object_t();
    l_legend   json_object_t := json_object_t();
    l_overrides json_object_t := json_object_t();
    l_size     json_object_t := json_object_t();
  begin
    if p_region.attribute_05 is not null then l_overrides.put('theme', lower(p_region.attribute_05)); end if;
    if p_region.attribute_06 is not null then l_overrides.put('renderer', lower(p_region.attribute_06)); end if;
    if p_region.attribute_04 is not null then l_overrides.put('preset', lower(p_region.attribute_04)); end if;
    if p_region.attribute_07 is not null then
      l_size.put('minHeight', to_number(p_region.attribute_07));
      l_overrides.put('size', l_size);
    end if;
    l_behavior.put('animation', nvl(p_region.attribute_08, 'Y') = 'Y');
    l_behavior.put('animationDuration', nvl(to_number(p_region.attribute_09), 500));
    l_legend.put('show', nvl(p_region.attribute_10, 'SHOW') <> 'HIDE');
    l_legend.put('position', lower(nvl(p_region.attribute_11, 'AUTO')));
    l_behavior.put('legend', l_legend);
    l_behavior.put('labels', lower(nvl(p_region.attribute_12, 'AUTO')));
    l_behavior.put('tooltip', nvl(p_region.attribute_13, 'Y') = 'Y');
    l_behavior.put('zoom', nvl(p_region.attribute_14, 'N') = 'Y');
    l_behavior.put('download', nvl(p_region.attribute_15, 'N') = 'Y');
    l_behavior.put('restore', nvl(p_region.attribute_16, 'N') = 'Y');
    if p_region.attribute_17 is not null then l_behavior.put('downloadFileName', p_region.attribute_17); end if;
    l_behavior.put('aria', nvl(p_region.attribute_18, 'Y') = 'Y');
    if p_region.attribute_21 is not null then l_behavior.put('formatter', lower(p_region.attribute_21)); end if;
    l_behavior.put('refreshStrategy', lower(nvl(p_region.attribute_22, 'REPLACE')));
    l_overrides.put('behavior', l_behavior);
    l_accessibility.put('description', nvl(p_region.attribute_19, p_region.title));
    l_accessibility.put(
      'fallbackText',
      nvl(p_region.attribute_24, func_project_message(p_plugin, 'error', c_default_error))
    );
    l_accessibility.put(
      'emptyText',
      nvl(p_region.attribute_23, func_project_message(p_plugin, 'empty', 'Não há dados para exibir.'))
    );
    l_accessibility.put('essential', true);
    l_accessibility.put('decal', nvl(p_region.attribute_20, 'N') = 'Y');
    l_overrides.put('accessibility', l_accessibility);
    if p_region.attribute_25 is not null then
      l_overrides := func_merge_overrides(l_overrides, p_region.attribute_25);
    end if;
    return l_overrides.to_clob;
  end func_plugin_overrides;

  procedure proc_load_assets(
    p_plugin in apex_plugin.t_plugin
  )
  is
  begin
    apex_javascript.add_library(
      p_name      => 'echarts-6.1.0.min',
      p_directory => p_plugin.file_prefix,
      p_key       => 'com.simplifica.apex.echarts:echarts:6.1.0'
    );
    apex_javascript.add_library(
      p_name      => 'oracle-apex-echarts',
      p_directory => p_plugin.file_prefix,
      p_key       => 'com.simplifica.apex.echarts:runtime:1.1.0'
    );
    apex_css.add_file(
      p_name      => 'oracle-apex-echarts',
      p_directory => p_plugin.file_prefix
    );
    apex_javascript.add_onload_code(
      p_code => 'window.OracleApexECharts.bootstrap();'
    );
  end proc_load_assets;

  function func_runtime_config_markup(
    p_region in apex_plugin.t_region,
    p_plugin in apex_plugin.t_plugin
  ) return clob
  is
    l_config json_object_t := json_object_t();
    l_id     varchar2(255) := nvl(p_region.static_id, 'OAE_' || to_char(p_region.id));
    l_result clob;
  begin
    if p_plugin.attribute_01 is not null then
      l_config.put('installationDefaults', json_object_t.parse(p_plugin.attribute_01));
    end if;
    if p_plugin.attribute_02 is not null then
      l_config.put('projectProfile', json_object_t.parse(p_plugin.attribute_02));
    end if;
    l_config.put('telemetry', nvl(p_plugin.attribute_03, 'N') = 'Y');
    dbms_lob.createtemporary(l_result, true);
    proc_append(l_result, '<script type="application/json" data-oracle-apex-echarts-config="1" id="');
    proc_append(l_result, apex_escape.html_attribute(l_id || '__oae_config') || '">');
    dbms_lob.append(l_result, func_escape_script_json(l_config.to_clob));
    proc_append(l_result, '</script>');
    return l_result;
  exception
    when others then
      apex_debug.error('PK_APEX_ECHARTS: profile do plugin inválido.');
      dbms_lob.createtemporary(l_result, true);
      proc_append(l_result, '<script type="application/json" data-oracle-apex-echarts-config="1">{"telemetry":false}</script>');
      return l_result;
  end func_runtime_config_markup;

  function func_plugin_render(
    p_region              in apex_plugin.t_region,
    p_plugin              in apex_plugin.t_plugin,
    p_is_printer_friendly in boolean
  ) return apex_plugin.t_region_render_result
  is
    l_ajax_identifier varchar2(4000);
    l_chart_id        varchar2(80) := 'OAE_CHART_' || to_char(p_region.id);
    l_description     varchar2(1000) := nvl(p_region.attribute_19, p_region.title);
    l_fallback        varchar2(1000);
    l_items           apex_t_varchar2;
    l_markup          clob;
    l_mode            varchar2(30) := upper(nvl(p_region.attribute_01, 'CHART'));
    l_option          json_object_t;
    l_overrides       clob;
    l_preset          varchar2(40) := lower(nvl(p_region.attribute_04, 'BAR_VERTICAL'));
    l_region_id       varchar2(255) := nvl(p_region.static_id, 'R' || to_char(p_region.id));
    l_result          apex_plugin.t_region_render_result;
    l_spec            clob;
  begin
    l_fallback := nvl(
      p_region.attribute_24,
      func_project_message(p_plugin, 'error', c_default_error)
    );
    proc_load_assets(p_plugin);
    proc_print_clob(func_runtime_config_markup(p_region, p_plugin));
    if l_mode = 'RUNTIME_ONLY' then
      return l_result;
    end if;
    if p_is_printer_friendly then
      proc_print_clob(func_safe_fallback('Gráfico', l_fallback));
      return l_result;
    end if;

    l_ajax_identifier := apex_plugin.get_ajax_identifier;
    l_items := nvl(
      apex_string.split(replace(p_region.ajax_items_to_submit, ' ', ''), ','),
      apex_t_varchar2()
    );
    l_overrides := func_plugin_overrides(p_region, p_plugin);
    if upper(nvl(p_region.attribute_03, 'INLINE')) = 'AJAX' then
      l_spec := func_build_ajax_spec(
        p_id                     => l_chart_id,
        p_transport              => 'apexPlugin',
        p_process_static_id      => null,
        p_ajax_identifier        => l_ajax_identifier,
        p_region_id              => l_region_id,
        p_items_to_submit        => l_items,
        p_accessible_description => l_description,
        p_fallback_text          => l_fallback,
        p_response_group         => null,
        p_overrides_json         => l_overrides
      );
    else
      if upper(nvl(p_region.attribute_02, 'NORMALIZED_SQL')) = 'OPTION_JSON' then
        l_option := func_option_from_json_sql(p_region);
      else
        l_option := func_option_from_normalized_sql(p_region, l_preset);
      end if;
      l_spec := func_build_inline_spec(
        p_id                     => l_chart_id,
        p_option                 => l_option,
        p_accessible_description => l_description,
        p_fallback_text          => l_fallback,
        p_overrides_json         => l_overrides,
        p_region_id              => l_region_id,
        p_ajax_identifier        => l_ajax_identifier,
        p_items_to_submit        => l_items
      );
    end if;

    l_markup := func_chart(l_spec, 'Gráfico indisponível', l_fallback);
    proc_print_clob(l_markup);
    l_result.navigable_dom_id := l_chart_id;
    return l_result;
  exception
    when others then
      apex_debug.error(
        'PK_APEX_ECHARTS: falha sanitizada no render do plugin. SQLCODE=%s SOURCE_LEN=%s BACKTRACE=%s',
        sqlcode,
        nvl(length(p_region.source), 0),
        dbms_utility.format_error_backtrace
      );
      proc_print_clob(func_safe_fallback('Gráfico indisponível', l_fallback));
      return l_result;
  end func_plugin_render;

  function func_plugin_ajax(
    p_region in apex_plugin.t_region,
    p_plugin in apex_plugin.t_plugin
  ) return apex_plugin.t_region_ajax_result
  is
    l_chart_id    varchar2(80) := 'OAE_CHART_' || to_char(p_region.id);
    l_description varchar2(1000) := nvl(p_region.attribute_19, p_region.title);
    l_fallback    varchar2(1000);
    l_option      json_object_t;
    l_overrides   clob;
    l_preset      varchar2(40) := lower(nvl(p_region.attribute_04, 'BAR_VERTICAL'));
    l_result      apex_plugin.t_region_ajax_result;
    l_spec        clob;
  begin
    l_fallback := nvl(
      p_region.attribute_24,
      func_project_message(p_plugin, 'error', c_default_error)
    );
    l_overrides := func_plugin_overrides(p_region, p_plugin);
    if upper(nvl(p_region.attribute_02, 'NORMALIZED_SQL')) = 'OPTION_JSON' then
      l_option := func_option_from_json_sql(p_region);
    else
      l_option := func_option_from_normalized_sql(p_region, l_preset);
    end if;
    l_spec := func_build_inline_spec(
      p_id                     => l_chart_id,
      p_option                 => l_option,
      p_accessible_description => l_description,
      p_fallback_text          => l_fallback,
      p_overrides_json         => l_overrides
    );
    proc_print_clob(func_ajax_result(l_spec, apex_application.g_x01));
    return l_result;
  exception
    when others then
      apex_debug.error(
        'PK_APEX_ECHARTS: falha sanitizada no AJAX do plugin. SQLCODE=%s SOURCE_LEN=%s BACKTRACE=%s',
        sqlcode,
        nvl(length(p_region.source), 0),
        dbms_utility.format_error_backtrace
      );
      sys.htp.prn('{"chartError":true,"message":"Não foi possível atualizar o gráfico."}');
      return l_result;
  end func_plugin_ajax;
end pk_apex_echarts;
/
