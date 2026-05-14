const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  getState: () => ipcRenderer.invoke('get-state'),
  saveState: (partial) => ipcRenderer.invoke('save-state', partial),
  autostartGet: () => ipcRenderer.invoke('autostart-get'),

  serviceStart: (service) => ipcRenderer.invoke('service-start', service),
  serviceStop: (service) => ipcRenderer.invoke('service-stop', service),
  serviceStatus: () => ipcRenderer.invoke('service-status'),

  mongoCheck: () => ipcRenderer.invoke('mongo-check'),
  mongoDetect: () => ipcRenderer.invoke('mongo-detect'),
  mongoOpen: () => ipcRenderer.invoke('mongo-open'),
  httpAppsStatus: () => ipcRenderer.invoke('http-apps-status'),

  gitStatus: (repoKey) => ipcRenderer.invoke('git-status', repoKey),
  gitFetch: (repoKey) => ipcRenderer.invoke('git-fetch', repoKey),
  gitPull: (repoKey) => ipcRenderer.invoke('git-pull', repoKey),
  gitCheckUpdates: (repoKey) => ipcRenderer.invoke('git-check-updates', repoKey),

  pathsAutoDetect: () => ipcRenderer.invoke('paths-auto-detect'),
  pathsApplyDetect: () => ipcRenderer.invoke('paths-apply-detect'),
  reposLocalStatus: () => ipcRenderer.invoke('repos-local-status'),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  gitCloneRepo: (payload) => ipcRenderer.invoke('git-clone-repo', payload),
  reposCloneAll: (parentDir) => ipcRenderer.invoke('repos-clone-all', parentDir),

  dataList: () => ipcRenderer.invoke('data-list'),
  dataDeleteManifest: () => ipcRenderer.invoke('data-delete-manifest'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  getLogs: () => ipcRenderer.invoke('get-logs'),
  easBuild: (profile) => ipcRenderer.invoke('eas-build', profile),
  getPathsHint: () => ipcRenderer.invoke('get-paths-hint'),

  npmInstall: (serviceKey) => ipcRenderer.invoke('npm-install', serviceKey),
  checkNodeModules: () => ipcRenderer.invoke('check-node-modules'),

  getLauncherInfo: () => ipcRenderer.invoke('get-launcher-info'),
  checkLauncherUpdate: () => ipcRenderer.invoke('check-launcher-update'),

  onServiceLog: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on('service-log', fn);
    return () => ipcRenderer.removeListener('service-log', fn);
  },
});
