const fs = require('fs');
const path = require('path');
const blacklist = require('metro').createBlacklist;

module.exports = {
  getProvidesModuleNodeModules() {
    return [
      'react-native',
      'react',
      'prop-types',
      'event-target-shim'
    ];
  },

  getBlacklistRE() {
    return blacklist([
      /Pods\/(.*)/,
      /react\-native\-webrtc\-kit\/node_modules\/(.*)/,
    ]);
  },
};
