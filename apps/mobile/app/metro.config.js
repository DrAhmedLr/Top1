const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const repoLibRoot = path.resolve(workspaceRoot, '../../lib');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot, repoLibRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Prefer CommonJS / React Native entries on web to avoid ESM import.meta syntax errors in classic script bundles
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = withNativeWind(config, { input: './global.css' });
