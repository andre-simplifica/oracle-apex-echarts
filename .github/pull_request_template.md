## Outcome

Describe the user-visible result and the components changed.

## Validation

- [ ] `npm ci --ignore-scripts --no-audit --no-fund`
- [ ] `npm run validate:all`
- [ ] Generated skill and distribution assets are current (`git diff --exit-code -- skills/oracle-apex-echarts/assets dist`)
- [ ] Examples and evidence contain synthetic data only
- [ ] No Oracle APEX production import or database change was used as proof

## Compatibility and safety

- [ ] `compatibility.json` and `CHANGELOG.md` are updated when required
- [ ] Runtime remains offline and has no CDN fallback
- [ ] Security allowlists were not weakened
- [ ] Upgrade and rollback impact is documented
