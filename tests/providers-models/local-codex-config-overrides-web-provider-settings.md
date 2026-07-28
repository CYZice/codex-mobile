### Feature: Local Codex configuration overrides web Provider settings

The web Settings panel does not expose Provider, OpenRouter, OpenCode Zen, or Custom Endpoint controls. The app-server must start only from the local Codex configuration, including changes made by CC Switch.

#### Prerequisites / setup

1. Ensure CodexApp is running with the normal user `CODEX_HOME`.
2. Use CC Switch (or edit the local Codex configuration) to select a known provider and model.
3. Leave any pre-existing `webui-custom-providers.json` state untouched to cover the migration case.

#### Actions

1. Open Settings and confirm no web Provider selector or provider API-key fields are rendered.
2. Start a new thread and inspect the model list and active provider configuration.
3. Change the local provider/model through CC Switch, then reload the Codex app-server runtime.
4. Start another new thread and inspect the resulting provider/model again.

#### Expected results

1. Web-only Provider controls are absent from Settings.
2. The app-server does not use the historical web Provider state as startup arguments.
3. Both initial and post-reload model/provider data reflect the local Codex configuration.
4. Existing thread history remains available; no web-server restart is required.

#### Rollback / cleanup

1. Restore the preferred provider with CC Switch or the local Codex configuration.
2. Do not delete the historical web Provider state file; it is intentionally retained for a future restoration of the feature.
