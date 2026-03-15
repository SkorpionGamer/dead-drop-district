(function () {
  const protocol = window.location?.protocol || "";
  const hostname = (window.location?.hostname || "").toLowerCase();
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const isFileProtocol = protocol === "file:";
  const sameOriginBaseUrl = !isFileProtocol && /^https?:$/i.test(protocol) ? window.location.origin : null;
  const isLocalDevEnvironment = isLocalHost || isFileProtocol;

  window.__DDD_CONFIG__ = Object.assign(
    {
      websocketUrl: null,
      serverBaseUrl: sameOriginBaseUrl,
      protocolVersion: 1,
      allowSameOriginLocalWs: true,
      showDevUi: isLocalDevEnvironment,
      enableAdminControls: isLocalDevEnvironment,
    },
    window.__DDD_CONFIG__ || {}
  );
})();
