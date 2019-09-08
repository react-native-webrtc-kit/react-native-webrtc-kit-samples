// @flow
import React, { Component } from 'react';
import { Platform, StyleSheet, View, PermissionsAndroid } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import {
  RTCMediaStreamTrack,
  RTCRtpReceiver,
  RTCVideoView,
  RTCObjectFit,
  RTCLogger as logger
} from 'react-native-webrtc-kit';
import { Ayame } from './Ayame';
import { signalingUrl, defaultRoomId } from './app.json';

logger.setDebugMode(true);

type Props = {};

type State = {
  roomId: string,
  clientId: string,
  signalingKey: string,
  conn: Sora | null,
  sender: RTCRtpSender | null,
  receiver: RTCRtpReceiver | null,
  objectFit: RTCObjectFit
};

async function requestPermissionsAndroid() {
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    ]);
  } catch (err) {
    console.warn(err);
  }
}

function randomString(strLength: number) {
  var result = [];
  var charSet = '0123456789';
  while (strLength--) {
    result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
  }
  return result.join('');
}

export default class App extends Component<Props, State> {
  constructor(props: Object) {
    super(props);
    this.state = {
      roomId: defaultRoomId,
      clientId: randomString(17),
      conn: null,
      sender: null,
      receiver: null,
      objectFit: 'cover'
    };
  }

  componentDidMount() {
    // Android の場合カメラの権限をリクエストする
    // XXX(kdxu): 厳密には拒否された場合の処理がいるはず。
    if (Platform.OS === 'android') {
      requestPermissionsAndroid();
    }
  }

  render() {
    return (
      <View style={styles.body}>
        <View style={styles.div_content}>
          <View style={styles.div_header}>
            <RTCVideoView
              style={styles.videoview}
              track={this.state.sender ? this.state.sender.track : null}
              objectFit={this.state.objectFit}
            />
          </View>
          <View style={styles.div_header}>
            <RTCVideoView
              style={styles.videoview}
              track={this.state.receiver ? this.state.receiver.track : null}
              objectFit={this.state.objectFit}
            />
          </View>
          <View style={{ flex: 1, flexDirection: 'column' }}>
            <TextInput
              label="ルームID"
              mode="outlined"
              style={{
                width: '100%',
                height: 60,
                borderColor: 'gray'
              }}
              onChangeText={roomId => this.setState({ roomId: roomId })}
              value={this.state.roomId}
              placeholder="Room ID"
            />
            <TextInput
              label="クライアントID"
              mode="outlined"
              style={{
                width: '100%',
                height: 60,
                borderColor: 'gray'
              }}
              onChangeText={clientId => this.setState({ clientId: clientId })}
              value={this.state.clientId}
              placeholder="Client ID"
            />
            <TextInput
              label="シグナリングキー"
              mode="outlined"
              style={{
                width: '100%',
                height: 60,
                borderColor: 'gray'
              }}
              onChangeText={signalingKey =>
                this.setState({ signalingKey: signalingKey })
              }
              value={this.state.signalingKey}
              placeholder="Signaling Key"
            />
          </View>
          <View>
            <Button
              raised
              disabled={this.state.conn !== null}
              mode="outlined"
              onPress={() => {
                this.setState(prev => {
                  const conn = new Ayame(
                    signalingUrl,
                    prev.roomId,
                    prev.clientId,
                    prev.signalingKey
                  );
                  conn.ondisconnect = function(_event) {
                    this.setState({
                      conn: null,
                      sender: null,
                      receiver: null
                    });
                  }.bind(this);
                  conn.onconnectionstatechange = function(event) {
                    this.setState(prev => {
                      if (event.target.connectionState == 'connected') {
                        var sender = prev.conn._pc.senders.find(each => {
                          return each.track.kind == 'video';
                        });
                        logger.log("# sender connection connected =>", sender);
                        var receiver = prev.conn._pc.receivers.find(each => {
                          return each.track.kind === 'video';
                        });
                        logger.log(
                          "# receiver connection connected =>",
                          receiver
                        );
                        return { receiver: receiver, sender: sender };
                      }
                    });
                  }.bind(this);
                  conn.connect();
                  return { conn: conn };
                });
              }}
            >
              接続
            </Button>
            <Button
              raised
              mode="outlined"
              disabled={this.state.conn === null}
              onPress={() => {
                if (this.state.conn) {
                  this.state.conn.disconnect();
                }
              }}
            >
              接続解除
            </Button>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    backgroundColor: '#F5FCFF',
    padding: 30
  },
  div_header: {
    width: '100%',
    aspectRatio: 16.0 / 9.0,
    backgroundColor: 'black',
    elevation: 4,
    marginBottom: 10
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
    backgroundColor: 'lightgray'
  },
});
