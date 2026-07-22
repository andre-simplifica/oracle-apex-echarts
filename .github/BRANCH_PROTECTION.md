# Main branch protection

After the bootstrap release, protect `main` with these repository rules:

- require a pull request before merging;
- require at least one approving review;
- dismiss stale approvals;
- require the `validate` status check from the `CI` workflow;
- require conversations to be resolved;
- block force pushes and deletions;
- include administrators when the hosting plan permits it.

The bootstrap commit and `v1.0.0` tag precede this rule. Future changes use pull requests.
