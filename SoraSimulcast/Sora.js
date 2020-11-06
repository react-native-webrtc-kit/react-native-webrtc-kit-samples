// @flow

import { NativeModules, Platform } from 'react-native';
import EventTarget from 'event-target-shim';
import {
  RTCConfiguration,
  RTCLogger as logger,
  RTCEvent,
  RTCIceServer,
  RTCMediaStream,
  RTCMediaStreamConstraints,
  RTCPeerConnection,
  RTCSessionDescription,
  getUserMedia
} from 'react-native-webrtc-kit';
import {RTCUserMedia} from 'react-native-webrtc-kit/src/MediaDevice/getUserMedia';

/**
 * @typedef {string} SoraRole
 */
export type SoraRole =
  | 'sendrecv'
  | 'sendonly'
  | 'recvonly'

/**
 * @typedef {string} SoraVideoCodec
 */
export type SoraVideoCodec =
  | 'VP8'
  | 'VP9'
  | 'H264'

/**
 * @typedef {string} SoraAudioCodec
 */
export type SoraAudioCodec =
  | 'OPUS'
  | 'PCMU'

/**
 * @typedef {string} SoraConnectionState
 */
export type SoraConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'

/**
 * @typedef {string} SoraSignalingType
 */
export type SoraSignalingType =
  | 'connect'
  | 'disconnect'
  | 'offer'
  | 'update'
  | 'answer'
  | 'pong'

export class SoraEvent extends RTCEvent { }

export class SoraSignalingMessage {

  type: SoraSignalingType;
  role: SoraRole | null;
  channelId: string | null;
  metadata: string | null = null;
  sdp: RTCSessionDescription | null = null;
  multistream: boolean | null = null;
  simulcast: boolean | null = null;
  video: boolean | Object | null = null;
  audio: boolean | Object | null = null;
  spotlight: number | null = null;
  candidate: Object | null = null;

  constructor(type: SoraSignalingType) {
    this.type = type;
  }

  toJSON(): Object {
    var json = {};
    json.type = this.type;
    if (this.role != null)
      json.role = this.role;
    if (this.channelId != null)
      json.channel_id = this.channelId;
    if (this.metadata != null)
      json.metadata = this.metadata;
    if (this.sdp != null)
      json.sdp = this.sdp.sdp;
    if (this.multistream != null)
      json.multistream = this.multistream;
    if (this.video != null)
      json.video = this.video;
    if (this.audio != null)
      json.audio = this.audio;
    if (this.spotlight != null)
      json.spotlight = this.spotlight;
    if (this.simulcast != null)
      json.simulcast = this.simulcast;
    if (this.candidate != null)
      json.candidate = this.candidate;
    return json;
  }
}

/**
 * @private
 */
export const SORA_EVENTS = [
  'connectionstatechange',
  'track',
];

/**
 * @package
 */
export class SoraEventTarget extends EventTarget(SORA_EVENTS) { }

/**
 * WebRTC SFU Sora サーバーとの接続を表すオブジェクトです。
 * 
 * ※ WebRTC SFU Sora は株式会社時雨堂の製品です。
 * 
 * @experimental Sora に関する API はすべてベータ機能です。
 * @see https://sora.shiguredo.jp
 */
export class Sora extends SoraEventTarget {

  /**
   * Sora サーバーの URL
   */
  url: string;

  /**
   * ロール
   */
  role: SoraRole;

  /**
   * マルチストリーム
   */
  multistream: boolean;

  /**
   * チャネル ID
   */
  channelId: string;

  /**
   * メタデータ
   */
  metadata: string | null = null;

  /**
   * 映像の有無
   */
  video: boolean | null = null;

  /**
   * 映像のコーデック
   */
  videoCodec: SoraVideoCodec | null = null;

  /**
   * 映像のビットレート
   */
  videoBitRate: number | null = null;

  /**
   * 音声の可否
   */
  audio: boolean | null = null;

  /**
   * 音声のコーデック
   */
  audioCodec: SoraAudioCodec | null = null;

  /**
   * 音声のビットレート
   */
  audioBitRate: number | null = null;

  /**
   * スポットライト機能の可否
   */
  spotlight: number | null = null;

  /**
   * 接続の状態
   */
  connectionState: SoraConnectionState = 'new';

  configuration: RTCConfiguration;

  _ws: WebSocket;
  _pc: RTCPeerConnection;
  _info: RTCUserMedia;

  constructor(url: string, role: SoraRole, multistream: boolean, channelId: string, signalingKey: string) {
    super();
    this.url = url;
    this.role = role;
    this.multistream = multistream;
    this.channelId = channelId;
    this.metadata = {
      signaling_key: signalingKey,
      turn_tls_only: false,
      turn_tcp_only: false,
    };

    this.configuration = new RTCConfiguration();
    this.configuration.iceServers = [
      new RTCIceServer(['stun:stun.services.mozilla.com']),
      new RTCIceServer(['stun:stun.l.google.com:19302'])
    ];
    this.configuration.sdpSemantics = 'unified';
  }

  // ---- Public ---- 

  _send(message: SoraSignalingMessage): void {
    if (this._ws != null) {
      logger.group("# Sora: send signaling message =>", message.type);
      const json = JSON.stringify(message);
      logger.log("# Sora: send WebSocket message =>", json);
      this._ws.send(json);
      logger.groupEnd();
    }
  }

  connect(): void {
    logger.log("# Sora: connect");
    this._ws = new WebSocket(this.url);
    this._ws.onopen = this._onWebSocketOpen.bind(this);
    this._ws.onclose = this._onWebSocketClose.bind(this);
    this._ws.onmessage = this._onWebSocketMessage.bind(this);
    this._ws.onerror = this._onAnyError.bind(this);
  }

  disconnect(): void {
    logger.log("# Sora: disconnect");
    if (this._pc)
      this._pc.close();
    if (this._ws)
      this._ws.close();
    if (this.ondisconnect != null) {
      this.ondisconnect();
    }
  }

  // ---- Private ---- 

  _setConnectionState(state: SoraConnectionState): void {
    logger.log("# Sora: set connection state => ", state);
    this.connectionState = state;
    this.dispatchEvent(new RTCEvent('connectionstatechange'));
  }

  _createPeerConnection(): void {
    logger.log("# create new peer connection");
    this._pc = new RTCPeerConnection(this.configuration);
    this._pc.onconnectionstatechange = this._onConnectionStateChange.bind(this);
    this._pc.onsignalingstatechange = this._onSignalingStateChange.bind(this);
    this._pc.onicecandidate = this._onIceCandidate.bind(this);
    this._pc.oniceconnectionstatechange = this._onIceConnectionStateChange.bind(this);
    this._pc.onicegatheringstatechange = this._onIceGatheringStateChange.bind(this);
    this._pc.onaddstream = this._onAddStream.bind(this);
    this._pc.onremovestream = this._onRemoveStream.bind(this);
    this._pc.ontrack = this._onTrack.bind(this);
  }

  _onWebSocketOpen(): void {
    logger.group("# Sora: WebSocket is opened");

    if (!this._pc) {
      this._createPeerConnection();
    }
    this._setConnectionState('connecting');

    // クライアント情報としての Offer SDP を生成する
    logger.log("# Sora: create offer SDP");
    getUserMedia(null).then((info) => {
      var offerPc = new RTCPeerConnection(this.configuration);
      logger.log("# Sora: getUserMedia: get info =>", info);
      info.tracks.forEach(track =>
        offerPc.addTrack(track, [info.streamId])
      );
      offerPc.createOffer(new RTCMediaStreamConstraints()).then((sdp) => {
        logger.log("# Sora: offer => ", sdp.sdp);

        // 一時的な peer connection なので捨ててよい
        // peer connection が保持するストリームも閉じられる
        offerPc.close();

        // 新しいローカルストリームを生成する
        var streamConsts = new RTCMediaStreamConstraints();
        getUserMedia(streamConsts).then((info) => {
          if (this.role === "sendrecv" || this.role === "sendonly") {
            logger.log("# Sora: add camera video stream");
            info.tracks.forEach(track =>
              this._pc.addTrack(track, [info.streamId])
                .catch(e => { throw new Error(e) })
            );
          }

          // Offer SDP を含めた connect を送信する
          var connect = new SoraSignalingMessage('connect');
          connect.channelId = this.channelId;
          connect.role = this.role;
          connect.sdp = sdp;

          // メタデータ
          if (this.metadata != null)
            connect.metadata = this.metadata;

          // サイマルキャストの設定
          connect.simulcast = true;
          connect.sora_client = "RNKit SoraSimulcast";
          connect.environment = "Android";
          // 映像の設定
          if (this.video == false) {
            connect.video = false;
          } else {
            if (this.videoCodec != null || this.videoBitRate != null) {
              connect.video = {}
              if (this.videoCodec != null)
                connect.video.codec_type = this.videoCodec;
              if (this.videoBitRate != null)
                connect.video.bit_rate = this.videoBitRate;
            } else if (this.video == true) {
              connect.video = true;
            }
          }

          // 音声の設定
          if (this.audio == false) {
            connect.audio = false;
          } else {
            if (this.audioCodec != null || this.audioBitRate != null) {
              connect.audio = {}
              if (this.audioCodec != null)
                connect.audio.codec_type = this.audioCodec;
              if (this.audioBitRate != null)
                connect.audio.bit_rate = this.audioBitRate;
            } else if (this.audio == true) {
              connect.audio = true;
            }
          }

          this._info = info;
          this._send(connect);
        })
      })
    })

    logger.groupEnd();
  }

  _onWebSocketClose(): void {
    logger.log("# Sora: WebSocket is closed");
    if (this._pc) {
      this._pc.close();
    }
  }

  _onWebSocketMessage(message: Object): void {
    logger.group("# Sora: received WebSocket message");
    const signal = JSON.parse(message.data);
    logger.log("# Sora: signaling type => ", signal.type);
    logger.log("# Sora: peer connection state => ",
      this._pc.connectionState);

    switch (signal.type) {
      case 'offer':
        logger.log("# Sora: signaling 'offer'");
        logger.log("# Sora: configuration =>", signal.config);

        // 'offer' で渡された設定を peer connection にセットする
        let iceServers = [];
        for (const iceServer of signal.config.iceServers) {
          logger.log("# Sora: ICE server => ", iceServer);
          for (const url of iceServer.urls) {
            iceServers.push(new RTCIceServer(
              iceServer.urls,
              iceServer.username,
              iceServer.credential));
          }
        }
        console.log('signal->', signal);
        if (signal.encodings && Array.isArray(signal.encodings)) {
          const track = this._info.tracks.find(t => {
            if(t.mid && 0 <= t.mid.indexOf('video') && t.currentDirection == null) {
              return t;
            }
          });
          if (!track) {
            throw new Error('simulcast error');
          }
          const sendEncodings = signal.encodings;
          this._pc.addTransceiver(track, {
            direction: 'sendonly',
            sendEncodings: sendEncodings
          });
        }

        this.configuration.iceServers = iceServers;
        this.configuration.iceTransportPolicy = signal.config.iceTransportPolicy;

        logger.log('# Sora: set configuration => ', this.configuration);
        this._pc.setConfiguration(this.configuration);

        logger.log('# Sora: offer set remote description => ', signal);
        this._pc.setRemoteDescription(new RTCSessionDescription(signal.type, signal.sdp))
          .then(() => {
            logger.log("# Sora: create answer");
            return this._pc.createAnswer(this.configuration);
          })
          .then((description) => {
            logger.log("# Sora: set local description => ", description);
            return this._pc.setLocalDescription(description)
              .then(() => {
                const message = new SoraSignalingMessage('answer');
                message.sdp = description;
                this._send(message);
              })
          })
          .catch((description) => {
            logger.log("# Sora: offer: set remote description failed => ", description);
          });
        break;

      case 'update':
        logger.log("# Sora: signaling 'update'");
        if (!this.multistream) {
          logger.log("# Sora: not multistream, skipping");
          break;
        }
        logger.log('# Sora: set configuration => ', this.configuration);
        this._pc.setConfiguration(this.configuration);
        if (signal.sdp !== null) {
          logger.log('# Sora: set remote description => ', signal);
          const sessionDescription = new RTCSessionDescription('offer', signal.sdp);
          this._pc.setRemoteDescription(sessionDescription)
            .then(() => {
              logger.log("# Sora: create 'update' answer");
              return this._pc.createAnswer(this.configuration);
            })
            .then((description) => {
              logger.log("# Sora: set local description => ", description);
              return this._pc.setLocalDescription(description)
                .then(() => {
                  var message = new SoraSignalingMessage('update');
                  message.sdp = description;
                  this._send(message);
                })
            })
            .catch(this._onAnyError.bind(this));
        }
        break;
      case 'notify':
        logger.log("# Sora: signaling 'notify' => ", signal);
        break;

      case 'ping':
        logger.log("# Sora: signaling 'ping'");
        // ping-pong
        this._ws.send(JSON.stringify({ 'type': 'pong' }))
        break;

      default:
        logger.log("# Sora: signaling unknown");
        // type 不明のメッセージは捨てる
        break;
    }

    logger.groupEnd();
  }

  _onConnectionStateChange(event: Object): void {
    logger.group("# Sora: connection state changed => ", event.type);

    const oldState = this.connectionState;
    var newState = this._pc.connectionState;
    switch (this._pc.connectionState) {
      case 'new':
        newState = 'new';
        break;
      case 'connecting':
        newState = 'connecting';
        break;
      case 'connected':
        newState = 'connected';
        break;
      case 'failed':
      case 'closed':
        newState = 'disconnected';
        break;
      default:
        return;
    }

    logger.log("# Sora: set new connection state => ", newState);
    this.connectionState = newState;
    if (oldState != newState) {
      this.dispatchEvent(new SoraEvent('connectionstatechange'));
    }

    logger.groupEnd();
  }

  _onSignalingStateChange(event: Object): void {
    logger.log("# Sora: peer connection signaling state changed => ", event.type);
  }

  _onIceCandidate(event: Object): void {
    logger.group("# Sora: ICE candidate changed");
    if (event.candidate != null) {
      var msg = JSON.stringify({
        'type': 'candidate',
        'candidate': event.candidate.candidate
      });
      logger.log('# Sora: send candidate => ', msg);
      this._ws.send(msg);
    }
    logger.groupEnd();
  }

  _onIceConnectionStateChange(event: Object): void {
    logger.log("# Sora: ICE connection state changed");
  }

  _onIceGatheringStateChange(): void {
    logger.log("# Sora: ICE gathering state changed");
  }

  _onAddStream(event: Object): void {
    logger.log("# Sora: stream added");
  }

  _onRemoveStream(event: Object): void {
    logger.log("# Sora: stream removed");
  }

  _onTrack(event: Object): void {
    logger.log("# Sora: ontrack =>", event.track);
    this.dispatchEvent(new SoraEvent('track', event));
  }

  _onAnyError(error: Object): void {
    logger.log("# Sora: any error => ", error);
  }
}
