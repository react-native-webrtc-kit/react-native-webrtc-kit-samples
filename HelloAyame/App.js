/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, {useEffect, useState} from 'react';
import {
  // Button,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  // TextInput,
  StatusBar,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import {
  Header,
  LearnMoreLinks,
  Colors,
  DebugInstructions,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

import {
  Button,
  TextInput,
} from 'react-native-paper';

import {
  RTCMediaStreamTrack,
  RTCRtpReceiver,
  RTCVideoView,
  RTCObjectFit,
  RTCLogger as logger,
} from 'react-native-webrtc-kit';

import { Ayame } from './Ayame';
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

function randomString(strLength) {
  var result = [];
  var charSet = '0123456789';
  while (strLength--) {
    result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
  }
  return result.join('');
}

const App: () => React$Node = () => {
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [clientId, setClientId] = useState(randomString(17));
  const [signalingKey, setSignalingKey] = useState('');
  const [conn, setConn] = useState(null);
  const [sender, setSender] = useState(null);
  const [receiver, setReceiver] = useState(null);
  const [objectFit, setObjectFit] = useState(RTCObjectFit);

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
            onChangeText={roomId => setRoomId(roomId)}
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
            onChangeText={clientId => setClientId(clientId)}
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
            onChangeText={signalingKey => setSignalingKey(signalingKey)}
            value={signalingKey}
            placeholder="Signaling Key"
          />
        </View>
        <View style={styles.button_container}>
          <Button
            raiseddisabled={conn !== null}
            mode="outlined"
            onPress={() => {
              const conn = new Ayame(
                signalingUrl,
                roomId,
                clientId,
                signalingKey,
              );
              conn.ondisconnect = function(_event) {
                setConn(null);
                setSender(null);
                setReceiver(null);
              }.bind(this);

              conn.onconnectionstatechange = function(event) {
                logger.log('#conection state channged', event);
                if (event.target.connectionState == 'connected') {
                  const receiver = conn._pc.receivers.find(each => {
                    return each.track.kind === 'video';
                  });
                  if (receiver) {
                    logger.log('# receiver connection connected =>', receiver);
                  } else {
                    receiver = null;
                  }
                  var sender = conn._pc.senders.find(each => {
                    return each.track.kind === 'video';
                  });
                  if (sender) {
                    logger.log('# sender connection connected =>', sender);
                  } else {
                    sender = null;
                  }
                  setReceiver(receiver);
                  setSender(sender);
                }
              }.bind(this);
              conn.connect();
              setConn(conn);
            }}
          >
            接続
          </Button>
          <Button
            raised
            mode="outlined"
            disabled={conn === null}
            onPress={() => {
              if (conn) {
                conn.disconnect();
              }
            }}
          >
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
