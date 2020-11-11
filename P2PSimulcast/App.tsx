import React, {useEffect, useState} from 'react';
import {StyleSheet, View, PermissionsAndroid, Platform} from 'react-native';

import {Button, TextInput} from 'react-native-paper';

import {
  RTCMediaStreamTrack,
  RTCRtpReceiver,
  RTCRtpSender,
  RTCVideoView,
  RTCObjectFit,
  RTCLogger as logger,
  // react-native-webrtc-kit には TypeScript の型定義が用意されていないため、@ts-ignore で握りつぶしています。
  // TODO(enm10k): react-native-webrtc-kit が TypeScript 化されたら、@ts-ignore を外す
  // @ts-ignore
} from 'react-native-webrtc-kit';

import {P2PSimulcast} from './P2PSimulcast';
logger.setDebugMode(true);

async function requestPermissionsAndroid() {
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ]);
  } catch (err) {
    console.warn(err);
  }
}

interface RTCRtpReceiver {
  track: {
    kind: string;
  };
}

interface RTCRtpSender {
  track: {
    kind: string;
  };
}

const App: () => React.ReactNode = () => {
  const [conn, setConn] = useState<P2PSimulcast | null>(null);
  const [objectFit, setObjectFit] = useState<object>(RTCObjectFit);

  useEffect(() => {
    if (Platform.OS === 'android') {
      requestPermissionsAndroid();
    }
  }, []);

  return (
    <View style={styles.body}>
      <View style={styles.div_content}>
        <View style={styles.div_header}>
          <RTCVideoView
            style={styles.videoview}
            track={sender ? sender.track : null}
            objectFit={objectFit}
          />
        </View>
        <View style={styles.div_header}>
        {receiver && receiver.tracks.map((t, index) => {
          return (
            <RTCVideoView
            key={index}
            style={styles.videoview}
            track={t}
            objectFit={objectFit}
            />)
        })}
        </View>
        <View style={styles.button_container}>
          <Button
            disabled={conn !== null}
            mode="outlined"
            onPress={() => {
              const conn = new P2PSimulcast();
              conn.connect();
            }}>
            接続
          </Button>
          <Button
            mode="outlined"
            disabled={!conn}
            onPress={() => {
               conn && conn.disconnect();
            }}>
            接続解除
          </Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    backgroundColor: '#F5FCFF',
    padding: 30,
  },
  div_header: {
    width: '100%',
    aspectRatio: 16.0 / 9.0,
    backgroundColor: 'black',
    elevation: 4,
    marginBottom: 10,
  },
  div_content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  videoview: {
    flex: 1,
    backgroundColor: 'lightgray',
  },
  button_container: {
    height: 50,
    flexDirection: 'row',
  },
});

export default App;
