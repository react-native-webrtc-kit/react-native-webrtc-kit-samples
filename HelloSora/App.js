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
  RTCVideoView,
  RTCObjectFit,
  RTCLogger as logger,
  RTCMediaStreamTrack,
} from 'react-native-webrtc-kit';
import { Sora } from './Sora';
import { url, defaultChannelId, signalingKey } from './app.json';

logger.setDebugMode(true);

type Props = {};

type State = {
  channelId: string,
  multistream: bool,
  pubConn: Sora | null,
  subConn: Sora | null,
  senderTrack: RTCMediaStreamTrack | null;
  receiverTrack: RTCMediaStreamTrack | null;
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
      channelId: defaultChannelId,
      multistream: false,
      pubConn: null,
      subConn: null,
      senderTrack: null,
      receiverTrack: null,
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
          <View style={styles.div_header}>
          {(this.state.subConn !== null && this.state.receiverTrack !== null) &&
            <RTCVideoView
              style={styles.videoview}
              track={this.state.receiverTrack}
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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center'}}>
              <Switch
                value={this.state.multistream}
                onValueChange={() => {
                  this.setState({ multistream: !this.state.multistream });
                }}
              />
              <Text
                onPress={(value) => {
                  this.setState({ multistream: !this.state.multistream });
                }}
              >
                マルチストリーム
              </Text>
            </View>
          </View>
          <View>
            <Button
              disabled={this.state.pubConn}
              raised
              mode="outlined"
              onPress={() => {
                this.setState(prev => {
                  const role = this.state.multistream ? 'group' : 'publisher';
                  const pubConn = new Sora(url, role, prev.channelId, signalingKey);
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
              パブリッシャーで接続する
            </Button>
            <Button
              disabled={this.state.subConn}
              raised
              mode="outlined"
              onPress={() => {
                this.setState(prev => {
                  const role = this.state.multistream ? 'groupsub' : 'subscriber';
                  const subConn = new Sora(url, role, prev.channelId, signalingKey);
                  subConn.ontrack = function (event) {
                    this.setState(prev => {
                      // event に receiver が含まれ、かつ track の種類が video の場合のみ処理を行う
                      if (!event.receiver || !event.track || event.track.kind !== 'video') return;

                      // track の追加
                      // state.receiverTrack が存在しない場合、 state に event.track を追加する
                      if (!prev.receiverTrack) {
                        logger.log('# receiver track added =>', event.track)
                        return { receiverTrack: event.track };
                      }

                      // track の削除
                      // state.receiverTrack と event.track の id が同じ場合、 state から track を削除する
                      if (prev.receiverTrack.id === event.track.id) {
                        logger.log('# receiver track removed');
                        return { receiverTrack: null };
                      }
                    });
                  }.bind(this);
                  subConn.connect();
                  return { subConn: subConn }
                });
              }}
            >
              サブスクライバーで接続する
            </Button>
            <Button
              raised
              mode="outlined"
              onPress={() => {
                logger.log("# disconnect");
                if (this.state.pubConn) {
                  this.state.pubConn.disconnect();
                }
                if (this.state.subConn) {
                  this.state.subConn.disconnect();
                }
                this.setState(prev => {
                  return {
                    pubConn: null,
                    subConn: null,
                    senderTrack: null,
                    receiverTrack: null,
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
