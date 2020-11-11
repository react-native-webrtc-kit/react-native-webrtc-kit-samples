// P2P + Simulcast 通信のサンプル
// https://github.com/fippo/simulcast-playground を参考に実装している
import {NativeModules, Platform} from 'react-native';
import EventTarget from 'event-target-shim';

import {
  RTCConfiguration,
  RTCLogger as logger,
  RTCEvent,
  RTCIceServer,
  RTCIceCandidate,
  RTCMediaStreamConstraints,
  RTCPeerConnection,
  RTCSessionDescription,
  getUserMedia,
  stopUserMedia,
  // react-native-webrtc-kit には TypeScript の型定義が用意されていないため、@ts-ignore で握りつぶしている
  // TODO(kdxu): react-native-webrtc-kit が TypeScript 化されたら、@ts-ignore を外す
  // @ts-ignore
} from 'react-native-webrtc-kit';
import * as SDPUtils from './SDPUtils';

export class P2PSimulcastEvent extends RTCEvent {}

enum P2PSimulcastConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed',
}
type P2PSimulcastEventType = 'connectionstatechange' | 'track' | 'disconnect';

export const P2PSimulcastEvents: Array<P2PSimulcastEventType> = [
  'connectionstatechange',
  'track',
  'disconnect',
];

export class P2PSimulcastEventTarget extends EventTarget(P2PSimulcastEvents) {}

/**
 * P2P simulcast 送受信クラス
 */
export class P2PSimulcast extends P2PSimulcastEventTarget {
  connectionState: P2PSimulcastConnectionState = P2PSimulcastConnectionState.NEW;
  // react-native-webrtc-kit で TypeScript の型を定義するまで any を使用します
  // TODO(kdxu): react-native-webrtc-kit で RTCConfiguration の型を定義する
  configuration: any;
  // react-native-webrtc-kit で TypeScript の型を定義するまで any を使用します
  // TODO(kdxu): react-native-webrtc-kit で RTCPeerConnection の型を定義する
  _senderPc: any;
  _receiverPc: any;
  // sender / receiver の track をここで保持しておく
  senderTracks: any[] = [];
  receiverTracks: any[] = [];
  ondisconnect?: () => void;
  onconnectionstatechange?: (event: {
    target: {connectionState: string};
  }) => void;

  constructor(
  ) {
    super();
    this.configuration = new RTCConfiguration();
    this.configuration.sdpSemantics = 'unified';
  }

  disconnect() {
    logger.log('# P2P: disconnect');
    this.configuration = new RTCConfiguration();
    this.configuration.sdpSemantics = 'unified';
    if (this._senderPc) {
      this._senderPc.close();
      this._senderPc = null;
    }
    if (this._receiverPc) {
      this._receiverPc.close();
      this._receiverPc = null;
    }
    stopUserMedia();
  }

  _setConnectionState(state: P2PSimulcastConnectionState) {
    logger.log('# P2P: set connection state =>', state);
    this.connectionState = state;
  }

  async connect() {
    logger.group('# P2P: create new peer connection');
    const pc = new RTCPeerConnection(this.configuration);
    const info = await getUserMedia(null);
    logger.log('# P2P: getUserMedia: get info =>', info);
    // peer connection に自分の track を追加する
    info.tracks.forEach((track: object) =>
      pc.addTrack(track, [info.streamId]).catch((e: string) => {
        throw new Error(e);
      }),
    );

    pc.onconnectionstatechange = this._onConnectionStateChange.bind(this);
    pc.onsignalingstatechange = this._onSignalingStateChange.bind(this);
    pc.onicegatheringstatechange = this._onIceGatheringStateChange.bind(this);
    pc.ontrack = this._onTrack.bind(this);
    if (Platform.OS === 'ios') {
      // Android は現状 onRemoveTrack を検知できないので、iOS のみ onRemoveTrack を bind している。
      pc.onremovetrack = this._onRemoveTrack.bind(this);
    }
    logger.groupEnd();
    // TODO(kdxu): SDP を書き換えて create offer する処理を書く
  }

  _onIceGatheringStateChange() {
    logger.log('# P2P: ICE gathering state changed');
  }

  _onTrack(event: {track: object}) {
    logger.log('# P2P: track added =>', event.track);
    // dispatchEvent の型定義を満たすことができなかったため @ts-ignore しています
    // TODO(enm10k): react-native-webrtc-kit で RTCEvent の型が定義されたタイミングで @ts-ignore を外せるようにする
    // @ts-ignore
    this.dispatchEvent(new P2PSimulcastEvent('track', event));
  }

  _onRemoveTrack(event: object) {
    logger.log('# P2P: track removed =>', event);
  }

  _onAnyError(error: object) {
    logger.log('# P2P: any error =>', error);
  }
}
