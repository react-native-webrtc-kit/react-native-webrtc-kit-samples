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
  // react-native-webrtc-kit には TypeScript の型定義が用意されていないため、@ts-ignore で握りつぶしています。
  // TODO(enm10k): react-native-webrtc-kit が TypeScript 化されたら、@ts-ignore を外す
  // @ts-ignore
} from 'react-native-webrtc-kit';

export class AyameEvent extends RTCEvent {}

enum AyameConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed',
}

enum AyameSignalingType {
  REGISTER = 'register',
  ACCEPT = 'accept',
  REJECT = 'reject',
  CANDIDATE = 'candidate',
  OFFER = 'offer',
  ANSWER = 'answer',
  PING = 'ping',
  PONG = 'pong',
}

export class AyameSignalingMessage {
  type: string = '';
  roomId?: string = '';
  clientId?: string = '';
  key?: string = ''; //  シグナリングキー
  sdp?: Object | null = null;
  video?: boolean | Object | null = null;
  audio?: boolean | Object | null = null;
  candidate?: Object | null = null;
  ice?: Object | null = null;
  data?: string | null = null;

  constructor(type: AyameSignalingType) {
    this.type = type;
  }
}

type AyameEventType = 'connectionstatechange' | 'track' | 'disconnect';

export const AyameEvents: Array<AyameEventType> = [
  'connectionstatechange',
  'track',
  'disconnect',
];

export class AyameEventTarget extends EventTarget(AyameEvents) {}

/**
 * WebRTC Signaling Server Ayame サーバーとの接続を行うクラス
 */
export class Ayame extends AyameEventTarget {
  signalingUrl: string;
  roomId: string;
  clientId: string;
  signalingKey: string;
  connectionState: AyameConnectionState = AyameConnectionState.NEW;
  // react-native-webrtc-kit で TypeScript の型を定義するまで any を使用します
  // TODO(enm10k): react-native-webrtc-kit で RTCConfiguration の型を定義する
  configuration: any;

  _ws?: WebSocket | null;
  // react-native-webrtc-kit で TypeScript の型を定義するまで any を使用します
  // TODO(enm10k): react-native-webrtc-kit で RTCPeerConnection の型を定義する
  _pc: any;
  _isOffer: boolean;

  ondisconnect?: () => void;
  onconnectionstatechange?: (event: {
    target: {connectionState: string};
  }) => void;

  constructor(
    signalingUrl: string,
    roomId: string,
    clientId: string,
    signalingKey: string,
  ) {
    super();
    this.signalingUrl = signalingUrl;
    this.roomId = roomId;
    this.clientId = clientId;
    this.signalingKey = signalingKey;
    this._isOffer = false;
    this.configuration = new RTCConfiguration();
    this.configuration.sdpSemantics = 'unified';
  }

  _send(message: AyameSignalingMessage) {
    if (!this._ws) {
      logger.log('Ayame: failed to send signaling message');
      return;
    }
    logger.group('# Ayame: send signaling message =>', message.type);
    this._ws.send(JSON.stringify(message));
    logger.groupEnd();
  }

  connect() {
    logger.log('# Ayame: connect');
    this._ws = new WebSocket(this.signalingUrl);
    this._ws.onopen = this._onWebSocketOpen.bind(this);
    this._ws.onclose = this._onWebSocketClose.bind(this);
    this._ws.onmessage = this._onWebSocketMessage.bind(this);
    this._ws.onerror = this._onAnyError.bind(this);
  }

  disconnect() {
    logger.log('# Ayame: disconnect');
    this._isOffer = false;
    this.configuration = new RTCConfiguration();
    this.configuration.sdpSemantics = 'unified';
    if (this._pc) {
      this._pc.close();
      this._pc = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    stopUserMedia();
    if (this.ondisconnect != null) {
      this.ondisconnect();
    }
  }

  _setConnectionState(state: AyameConnectionState) {
    logger.log('# Ayame: set connection state => ', state);
    this.connectionState = state;
    this.dispatchEvent(new RTCEvent('connectionstatechange'));
  }

  async _createPeerConnection() {
    logger.group('# Ayame: create new peer connection');
    const pc = new RTCPeerConnection(this.configuration);
    const info = await getUserMedia(null);
    logger.log('# Ayame: getUserMedia: get info =>', info);
    // peer connection に自分の track を追加する
    info.tracks.forEach((track: object) =>
      pc.addTrack(track, [info.streamId]).catch((e: string) => {
        throw new Error(e);
      }),
    );

    pc.onconnectionstatechange = this._onConnectionStateChange.bind(this);
    pc.onsignalingstatechange = this._onSignalingStateChange.bind(this);
    pc.onicecandidate = this._onIceCandidate.bind(this);
    pc.oniceconnectionstatechange = this._onIceConnectionStateChange.bind(this);
    pc.onicegatheringstatechange = this._onIceGatheringStateChange.bind(this);
    pc.ontrack = this._onTrack.bind(this);
    if (Platform.OS === 'ios') {
      // Android は現状 onRemoveTrack を検知できないので、iOS のみ onRemoveTrack を bind している。
      pc.onremovetrack = this._onRemoveTrack.bind(this);
    }
    logger.groupEnd();
    return pc;
  }

  async _onWebSocketOpen() {
    logger.group('# Ayame: WebSocket is opened');
    this._setConnectionState(AyameConnectionState.CONNECTING);
    // register メッセージを送信する
    var register = new AyameSignalingMessage(AyameSignalingType.REGISTER);
    register.roomId = this.roomId;
    register.clientId = this.clientId;
    if (this.signalingKey && this.signalingKey.length > 0) {
      register.key = this.signalingKey;
    }
    this._send(register);
    logger.groupEnd();
  }

  _onWebSocketClose() {
    logger.log('# Ayame: WebSocket is closed');
    if (this._pc) {
      this._pc.close();
    }
  }

  async _onWebSocketMessage(message: WebSocketMessageEvent) {
    try {
      logger.group('# Ayame: received WebSocket message', message.data);
      const signal = JSON.parse(message.data);
      logger.log('# Ayame: signaling type => ', signal.type);
      logger.log('# Ayame: connection state => ', this.connectionState);
      switch (signal.type) {
        case 'accept':
          logger.log('# Ayame: accepted client');
          if (signal.iceServers && Array.isArray(signal.iceServers)) {
            // iceServers をセットする
            let iceServers = [];
            for (const iceServer of signal.iceServers) {
              logger.log('# Ayame: ICE server => ', iceServer);
              for (const url of iceServer.urls) {
                iceServers.push(
                  new RTCIceServer(
                    iceServer.urls,
                    iceServer.username,
                    iceServer.credential,
                  ),
                );
              }
            }
            this.configuration.iceServers = iceServers;
          }
          if (!this._pc) this._pc = await this._createPeerConnection();
          if (signal.isExistClient) await this._sendOffer();
          break;
        case AyameSignalingType.REJECT:
          logger.log('# Ayame: rejected', signal);
          this.disconnect();
          break;
        case AyameSignalingType.ANSWER:
          logger.log('# Ayame: answer set remote description => ', signal);
          await this._setAnswer(signal);
          break;
        case AyameSignalingType.OFFER:
          await this._setOffer(signal);
          break;
        case AyameSignalingType.CANDIDATE:
          await this._setCandidate(signal);
          break;
        case AyameSignalingType.PING:
          // ping-pong
          this._send({type: AyameSignalingType.PONG});
          break;
        default:
          logger.log('# Ayame: signaling unknown');
          break;
      }
      logger.groupEnd();
    } catch (error) {
      logger.log('# Ayame: Error', error);
      this._onAnyError(error);
    }
  }

  _onConnectionStateChange(event: {type: string}) {
    logger.group('# Ayame: connection state changed => ', event.type);
    const oldState: AyameConnectionState = this.connectionState;

    var newState: AyameConnectionState = AyameConnectionState.DISCONNECTED;
    if (this._pc) {
      newState = this._pc.connectionState;
    }
    switch (newState) {
      case AyameConnectionState.NEW:
        newState = AyameConnectionState.NEW;
        break;
      case AyameConnectionState.CONNECTING:
        newState = AyameConnectionState.CONNECTING;
        break;
      case AyameConnectionState.CONNECTED:
        newState = AyameConnectionState.CONNECTED;
        this._isOffer = false;
        break;
      case AyameConnectionState.FAILED:
      case AyameConnectionState.CLOSED:
        newState = AyameConnectionState.DISCONNECTED;
        break;
      default:
        return;
    }
    logger.log('# Ayame: set new connection state => ', newState);
    this.connectionState = newState;
    if (oldState !== newState) {
      // dispatchEvent の型定義を満たすことができなかったため @ts-ignore しています
      // TODO(enm10k): react-native-webrtc-kit で RTCEvent の型が定義されたタイミングで @ts-ignore を外せるようにする
      // @ts-ignore
      this.dispatchEvent(new AyameEvent('connectionstatechange'));
    }
    logger.groupEnd();
  }

  _onSignalingStateChange(event: {type: string}) {
    logger.log(
      '# Ayame: peer connection signaling state changed => ',
      event.type,
    );
  }

  _onIceCandidate(event: {
    candidate: {candidate: object; sdpMLineIndex: object; sdpMid: object};
  }) {
    logger.group('# Ayame: ICE candidate changed', event.candidate);
    if (event.candidate != null) {
      var msg = {
        type: 'candidate',
        ice: {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
        },
      };
      logger.log('# Ayame: send candidate => ', msg);
      this._send(msg);
    }
    logger.groupEnd();
  }

  _onIceConnectionStateChange(event: object) {
    logger.log('# Ayame: ICE connection state changed');
  }

  async _sendOffer() {
    if (!this._pc) {
      return;
    }
    const offer = await this._pc.createOffer(new RTCMediaStreamConstraints());
    await this._pc.setLocalDescription(offer);
    this._sendSdp(this._pc.localDescription);
    this._isOffer = true;
  }

  async _setAnswer(sessionDescription: {type: string; sdp: Object}) {
    if (!this._pc) {
      return;
    }
    await this._pc.setRemoteDescription(
      new RTCSessionDescription(
        sessionDescription.type,
        sessionDescription.sdp,
      ),
    );
  }

  async _setOffer(sessionDescription: AyameSignalingMessage) {
    this._pc = await this._createPeerConnection();
    logger.log('# Ayame: offer set remote description => ', sessionDescription);
    await this._pc.setRemoteDescription(
      new RTCSessionDescription(
        sessionDescription.type,
        sessionDescription.sdp,
      ),
    );
    const answer = await this._pc.createAnswer(this.configuration);
    logger.log('# Ayame: create answer');
    await this._pc.setLocalDescription(answer);
    this._sendSdp(this._pc.localDescription);
  }

  async _setCandidate(ice: {candidate: Object}) {
    if (!this._pc) {
      return;
    }
    if (ice && ice.candidate) {
      try {
        const candidate = new RTCIceCandidate(ice.candidate);
        await this._pc.addIceCandidate(candidate);
      } catch (_e) {
        // TODO(kdxu): ice candidate の追加に失敗するときがあるので調べる
      }
    }
  }

  _sendSdp(sessionDescription: AyameSignalingMessage) {
    this._send(sessionDescription);
  }

  _onIceGatheringStateChange() {
    logger.log('# Ayame: ICE gathering state changed');
  }

  _onTrack(event: {track: object}) {
    logger.log('# Ayame: track added =>', event.track);
    // dispatchEvent の型定義を満たすことができなかったため @ts-ignore しています
    // TODO(enm10k): react-native-webrtc-kit で RTCEvent の型が定義されたタイミングで @ts-ignore を外せるようにする
    // @ts-ignore
    this.dispatchEvent(new AyameEvent('track', event));
  }

  _onRemoveTrack(event: object) {
    logger.log('# Ayame: track removed =>', event);
  }

  _onAnyError(error: object) {
    logger.log('# Ayame: any error => ', error);
  }
}
