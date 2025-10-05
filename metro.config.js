        const { getDefaultConfig } = require('@expo/metro-config');
        const defaultConfig = getDefaultConfig(__dirname);

        defaultConfig.resolver.sourceExts.push('cjs');
        defaultConfig.resolver.unstable_enablePackageExports = false; // May be needed for older Firebase versions

        module.exports = defaultConfig;