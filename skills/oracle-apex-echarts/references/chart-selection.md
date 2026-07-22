# Chart selection

Start with the question, not appearance.

| Question | Preferred forms | Avoid by default |
| --- | --- | --- |
| Compare or rank categories | bar | line without ordered time |
| Show a time trend | line or area | pie/donut |
| Compare measures and trend | combo | dual axes without clear units |
| Show a small part-to-whole | donut or pie | many slices |
| Show progress to a bounded target | gauge or bar | gauge without a meaningful bound |
| Show correlation/distribution | scatter | connected line |

Honor an explicit requested type when it is allowed and not misleading. Under
`prefer`, use the project preferred type only if it fits the question. Under
`require`, stop and explain incompatibility instead of silently switching.

Default to vertical bars for category comparison. Default to line only for an
ordered time series. Keep labels, legends, axes, units, ordering, and fallback
text sufficient to understand the measure without guessing.
