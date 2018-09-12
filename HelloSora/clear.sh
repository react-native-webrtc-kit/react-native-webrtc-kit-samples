#!/bin/sh

watchman watch-del-all
rm -rf $TMPDIR/metro*
rm -rf $TMPDIR/haste*
rm -rf node_modules
rm -rf ios/Pods
rm -rf ios/Podfile.lock
git checkout ios/Podfile
yarn install
react-native unlink react-native-webrtc-kit
react-native link
cd ios; pod install