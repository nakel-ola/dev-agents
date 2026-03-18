declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// acquireVsCodeApi can only be called once per webview page load
let _api: ReturnType<typeof acquireVsCodeApi> | undefined;
export function getVscodeApi() {
  if (!_api) _api = acquireVsCodeApi();
  return _api;
}
