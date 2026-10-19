module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    onlineApiUrl: process.env.ONLINE_API_URL,
    offlineMeshApiUrl: process.env.OFFLINE_MESH_API_URL,
    routeOsrmUrl: process.env.ROUTE_OSRM_URL,
  },
});
