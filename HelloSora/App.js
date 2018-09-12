// @flow

import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View
} from 'react-native';
import {
  Paper,
  Text,
  TextInput,
  Button,
  Checkbox
} from 'react-native-paper';
import { RTCVideoView, RTCLogger as logger } from 'react-native-webrtc-kit';
import { Sora } from './Sora';
import { url, defaultChannelId } from './app.json';

logger.setDebugMode(true);

type Props = {};

type State = {
  channelId: string,
  multistream: bool,
  pubConn: Sora | null,
  subConn: Sora | null,
  pubStreamValueTag: string | null,
  subStreamValueTag: string | null
};

export default class App extends Component<Props, State> {

  constructor(props: Object) {
    super(props);
    this.state = {
      channelId: defaultChannelId,
      multistream: false,
      pubConn: null,
      subConn: null,
      pubStreamValueTag: null,
      subStreamValueTag: null
    };
  }

  render() {
    return (
      <View style={styles.body}>
        <View style={styles.div_content}>
          <Text style={styles.instructions}>
            {instructions}
          </Text>
          <Paper style={styles.div_header}>
            <RTCVideoView
              style={styles.videoview}
              streamValueTag={this.state.pubStreamValueTag}
              objectFit='contain'
            />
          </Paper>
          <Paper style={styles.div_header}>
            <RTCVideoView
              style={styles.videoview}
              streamValueTag={this.state.subStreamValueTag}
              objectFit='contain'
            />
          </Paper>
          <View style={{ flex: 1, flexDirection: 'column' }}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Text style={{ width: '50%' }}>
                チャネルID
          </Text>
              <TextInput
                style={{
                  width: '50%',
                  height: 40,
                  borderColor: 'gray'
                }}
                onChangeText={(channelId) =>
                  this.setState({ channelId: channelId })
                }
                value={this.state.channelId}
                placeholder='Channel ID'
              />
            </View>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Text>マルチストリーム</Text>
              <Checkbox
                color='blue'
                checked={this.state.multistream}
                onPress={(value) => {
                  this.setState({ multistream: !this.state.multistream });
                }}
              />
            </View>
          </View>
          <View>
            <Button
              raised
              onPress={() => {
                this.setState(prev => {
                  const role = this.state.multistream ? 'group' : 'publisher';
                  const pubConn = new Sora(url, role, prev.channelId);
                  pubConn.onconnectionstatechange = function (event) {
                    this.setState(prev => {
                      logger.log("# publisher connection state change => ",
                        event.target.connectionState);
                      if (event.target.connectionState == 'connected') {
                        logger.log("# publisher connection connected");
                        const stream = prev.pubConn.getLocalStream();
                        const valueTag = stream ? stream.valueTag : null;
                        logger.log("# publisher react stream id => ", valueTag);
                        return { pubStreamValueTag: valueTag }
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
              raised
              onPress={() => {
                this.setState(prev => {
                  const role = this.state.multistream ? 'groupsub' : 'subscriber';
                  const subConn = new Sora(url, role, prev.channelId);
                  subConn.onconnectionstatechange = function (event) {
                    this.setState(prev => {
                      logger.log("# subscriber connection state change => ",
                        event.target.connectionState);
                      if (event.target.connectionState == 'connected') {
                        logger.log("# subscriber connection connected");
                        const stream = prev.subConn.getRemoteStream();
                        const valueTag = stream ? stream.valueTag : null;
                        logger.log("# subscriber react stream id => ", valueTag);
                        return { subStreamValueTag: valueTag };
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
                    pubStreamValueTag: null,
                    subStreamValueTag: null
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
