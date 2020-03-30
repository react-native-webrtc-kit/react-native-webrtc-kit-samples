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

import {Ayame} from './Ayame';
import {signalingUrl, defaultRoomId} from './app.json';

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

function randomString(strLength: number): string {
  var result = [];
  var charSet = '0123456789';
  while (strLength--) {
    result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
  }
  return result.join('');
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
  const [roomId, setRoomId] = useState<string>(defaultRoomId);
  const [clientId, setClientId] = useState<string>(randomString(17));
  const [signalingKey, setSignalingKey] = useState<string>('');
  const [conn, setConn] = useState<Ayame | null>(null);
  const [sender, setSender] = useState<RTCRtpSender | null>(null);
  const [receiver, setReceiver] = useState<RTCRtpReceiver | null>(null);
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
          <RTCVideoView
            style={styles.videoview}
            track={receiver ? receiver.track : null}
            objectFit={objectFit}
          />
        </View>
        <View style={{flex: 1, flexDirection: 'column'}}>
          <TextInput
            label="ルームID"
            mode="outlined"
            style={{
              width: '100%',
              height: 50,
              borderColor: 'gray',
            }}
            onChangeText={setRoomId}
            value={roomId}
            placeholder="Room ID"
          />
          <TextInput
            label="クライアントID"
            mode="outlined"
            style={{
              width: '100%',
              height: 50,
              borderColor: 'gray',
            }}
            onChangeText={setClientId}
            value={clientId}
            placeholder="Client ID"
          />
          <TextInput
            label="シグナリングキー"
            mode="outlined"
            style={{
              width: '100%',
              height: 50,
              minWidth: '50%',
              borderColor: 'gray',
            }}
            onChangeText={setSignalingKey}
            value={signalingKey}
            placeholder="Signaling Key"
          />
        </View>
        <View style={styles.button_container}>
          <Button
            disabled={conn !== null}
            mode="outlined"
            onPress={() => {
              const conn = new Ayame(
                signalingUrl,
                roomId,
                clientId,
                signalingKey,
              );
              conn.ondisconnect = function() {
                setConn(null);
                setSender(null);
                setReceiver(null);
              };

              conn.onconnectionstatechange = function(event: {
                target: {connectionState: string};
              }) {
                logger.log('#conection state channged', event);
                if (event.target.connectionState === 'connected') {
                  const receiver = conn._pc.receivers.find(
                    (each: RTCRtpReceiver) => {
                      return each.track.kind === 'video';
                    },
                  );
                  if (receiver) {
                    logger.log('# receiver connection connected =>', receiver);
                  } else {
                    setReceiver(null);
                  }
                  var sender = conn._pc.senders.find((each: RTCRtpSender) => {
                    return each.track.kind === 'video';
                  });
                  if (sender) {
                    logger.log('# sender connection connected =>', sender);
                  } else {
                    setSender(null);
                  }
                  setReceiver(receiver);
                  setSender(sender);
                }
              };
              conn.connect();
              setConn(conn);
            }}>
            接続
          </Button>
          <Button
            mode="outlined"
            disabled={!conn}
            onPress={() => {
              if (conn) {
                conn.disconnect();
              }
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
