// @flow

import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  PermissionsAndroid
} from 'react-native';
import {
  Text,
  TextInput,
  Switch,
  Button,
} from 'react-native-paper';
import {
  WebRTC,
  RTCVideoView,
  RTCObjectFit,
  RTCLogger as logger,
  RTCMediaStreamTrack,
} from 'react-native-webrtc-kit';
import { Sora } from './Sora';
import { url } from './app.json';

const signalingKey = 'E5auavfBEch3SxKJLiffiqEm732WHooZ1Tq4vZmnl-0Hbw-p';
if (Platform.OS === 'ios') {
  WebRTC.setMicrophoneEnabled(true);
}

logger.setDebugMode(true);

type Props = {};

type State = {
  channelId: string,
  pubConn: Sora | null,
  senderTrack: RTCMediaStreamTrack | null;
  objectFit: RTCObjectFit
};

async function requestPermissionsAndroid() {
  try {
    await PermissionsAndroid.requestMultiple(
      [
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      ]
    );
  } catch (err) {
    console.warn(err);
  }
}


export default class App extends Component<Props, State> {

  constructor(props: Object) {
    super(props);
    this.state = {
      channelId: 'kdxu@sora-labo',// defaultChannelId,
      pubConn: null,
      senderTrack: null,
      objectFit: 'cover'
    };
  }

  componentDidMount() {
    // Android の場合カメラの権限をリクエストする
    // XXX(kdxu): 厳密には拒否された場合の処理がいるはず。
    if (Platform.OS === 'android') {
      requestPermissionsAndroid()
    }
  }

  render() {
    return (
      <View style={styles.body}>
        <View style={styles.div_content}>
          <Text style={styles.title}>
            サイマルキャスト送信
          </Text>
          <Text style={styles.instructions}>
            {instructions}
          </Text>
          <View style={styles.div_header}>
          {(this.state.pubConn !== null && this.state.senderTrack !== null) &&
            <RTCVideoView
              style={styles.videoview}
              track={this.state.senderTrack}
              objectFit={this.state.objectFit}
            />
          }
          </View>
          <View style={{ flex: 1, flexDirection: 'column' }}>
            <TextInput
              label="チャネルID"
              mode="outlined"
              style={{
                width: '100%',
                height: 60,
                borderColor: 'gray'
              }}
              onChangeText={(channelId) =>
                  this.setState({ channelId: channelId })
              }
              value={this.state.channelId}
              placeholder='Channel ID'
            />
          </View>
          <View>
            <Button
              disabled={this.state.pubConn !== null}
              raised
              mode="outlined"
              onPress={() => {
                this.setState(prev => {
                  const pubConn = new Sora(url, 'sendonly', false, prev.channelId, signalingKey);
                  pubConn.onconnectionstatechange = function (event) {
                    this.setState(prev => {
                      logger.log("# publisher connection state change => ",
                        event.target.connectionState);
                      if (event.target.connectionState == 'connected') {
                        var sender = prev.pubConn._pc.senders.find(each => {
                          return each.track.kind == 'video'
                        });
                        logger.log("# publisher connection connected =>", sender);
                        return { senderTrack: sender.track }
                      }
                    });
                  }.bind(this);
                  pubConn.connect();
                  return { pubConn: pubConn };
                });
              }}
            >
              接続する
            </Button>
            <Button
              raised
              mode="outlined"
              onPress={() => {
                logger.log("# disconnect");
                if (this.state.pubConn) {
                  this.state.pubConn.disconnect();
                }
                this.setState(prev => {
                  return {
                    pubConn: null,
                    senderTrack: null
                  }
                });
              }}
            >
              接続解除する
            </Button>
          </View>
        </View>
      </View >
    );
  }
}

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' +
    'Cmd+D or shake for dev menu',
  android: 'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    backgroundColor: '#F5FCFF',
    padding: 30
  },
  title: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 10,
    fontWeight: 'bold'
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
    backgroundColor: 'lightgray',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});
