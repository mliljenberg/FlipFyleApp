/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, {Component} from 'react';
import {Platform, StyleSheet, Text, View, Button} from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import RNFS from 'react-native-fs';
var binaryToBase64 = require('binaryToBase64');

const instructions = Platform.select({
  ios: 'Press Cmd+R to reload,\n' + 'Cmd+D or shake for dev menu',
  android:
    'Double tap R on your keyboard to reload,\n' +
    'Shake or press menu button for dev menu',
});

type Props = {};

import SocketIOClient from 'socket.io-client';


import {RTCPeerConnection, RTCIceCandidate, RTCSessionDescription} from 'react-native-webrtc';

const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
const roomId = 1;


export default class App extends Component<Props> {
   constructor (props) {
    super(props)
    this.state = {text: 'nothing here'};
    this.socket = SocketIOClient('http://192.168.1.100:3001', {transports: ['websocket']});
    this.peerConn;
    this.dataChannel;
    this.handleOnClick = this.handleOnClick.bind(this);
    this.signalingMessageCallback = this.signalingMessageCallback.bind(this);
    this.createPeerConnection = this.createPeerConnection.bind(this);
    this.onLocalSessionCreated = this.onLocalSessionCreated.bind(this);
    this.onDataChannelCreated = this.onDataChannelCreated.bind(this);
    this.logError = this.logError.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.randomToken = this.randomToken.bind(this);
    this.receiveDataFactory = this.receiveDataFactory.bind(this);
    this.uploadFile = this.uploadFile.bind(this);
    this.sendData = this.sendData.bind(this);
    this.base64ArrayBuffer = this.base64ArrayBuffer.bind(this);
    this.filesInStorage = this.filesInStorage.bind(this);
    console.log(RTCPeerConnection);
  }
  componentDidMount(){
    this.socket.emit('create or join', roomId);
      this.socket.on('ipaddr', ipaddr => {
        console.log(`Server IP address is: ${ipaddr}`);
        // updateRoomURL(ipaddr);
      });

      this.socket.on('created', (room, clientId) => {
        console.log('Created room', room, '- my client ID is', clientId);
         // isInitiator = true;
        // grabWebCamVideo();
      });

      this.socket.on('joined', (room, clientId) => {
        console.log(
          'This peer has joined room',
          room,
          'with client ID',
          clientId,
        );
        isInitiator = false;
        this.createPeerConnection(isInitiator, configuration);
        // grabWebCamVideo();
      });

      this.socket.on('full', room => {
        console.log('wops the room is full!');
      });

      this.socket.on('ready', () => {
        console.log('Socket is ready');
        this.createPeerConnection(isInitiator, configuration);
      });

      this.socket.on('log', array => {
        console.log(...array);
      });

      this.socket.on('message', message => {
        console.log('Client received message:', message);
        this.signalingMessageCallback(message);
      });
      this.socket.on('disconnect', reason => {
        console.log(`Disconnected: ${reason}.`);
        // sendBtn.disabled = true;
        // snapAndSendBtn.disabled = true;
      });

      this.socket.on('bye', room => {
        console.log(`Peer leaving room ${room}.`);
        // sendBtn.disabled = true;
        // snapAndSendBtn.disabled = true;
        // If peer did not create the room, re-enter to be creator.
      });
  }
  sendMessage(message) {
    console.log('Client sending message: ', message);
    this.socket.emit('message', message);
  }
  handleOnClick(message) {
    console.log(message);
    console.log('handelingClick: ', this.dataChannel);
  }

  signalingMessageCallback(message) {
    if (message.type === 'offer') {
      console.log('Got offer. Sending answer to peer.');
      this.peerConn.setRemoteDescription(
        new RTCSessionDescription(message),
        () => {},
        this.logError,
      );
      this.peerConn.createAnswer(this.onLocalSessionCreated, this.logError);
    } else if (message.type === 'answer') {
      console.log('Got answer.');
      this.peerConn.setRemoteDescription(
        new RTCSessionDescription(message),
        () => {},
        this.logError,
      );
    } else if (message.type === 'candidate') {
      console.log("added ice candidate");
      this.peerConn.addIceCandidate(
        new RTCIceCandidate({
          sdpMLineIndex: 0,
          sdpMid: 'data',
          candidate: message.candidate,
        }),
      );
    }
  }

  createPeerConnection(Initiator, config) {
    console.log(
      'Creating Peer connection as initiator?',
      isInitiator,
      'config:',
      config,
    );
    this.peerConn = new RTCPeerConnection(config);

    // send any ice candidates to the other peer
    this.peerConn.onicecandidate = function(event) {
      console.log('icecandidate event:', event);
      if (event.candidate) {
        this.sendMessage({
          type: 'candidate',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      } else {
        console.log('End of candidates.');
      }
    }.bind(this);

    if (Initiator) {
      console.log('Creating Data Channel');
      this.dataChannel = this.peerConn.createDataChannel('photos');
      console.log(this.dataChannel);
      this.onDataChannelCreated(this.dataChannel);

      console.log('Creating an offer');
      this.peerConn.createOffer(this.onLocalSessionCreated, this.logError);
    } else {
      this.peerConn.ondatachannel = function(event) {
        console.log('ondatachannel:', event.channel);
        this.dataChannel = event.channel;
        this.onDataChannelCreated(this.dataChannel);
      }.bind(this);
    }
  }

  onLocalSessionCreated(desc) {
    console.log('local session created:', desc);
    this.peerConn.setLocalDescription(
      desc,
      () => {
        console.log('sending local desc:', this.peerConn.localDescription);
        this.sendMessage(this.peerConn.localDescription);
      },
      this.logError,
    );
  }

  onDataChannelCreated(channel) {
    console.log('onDataChannelCreated:', channel);

    channel.onopen = function() {
      console.log('CHANNEL opened!!!');
    };

    channel.onclose = function() {
      console.log('Channel closed.');
    };

    channel.onmessage = this.receiveDataFactory();
    //     adapter.browserDetails.browser === 'firefox'
    //       ? receiveDataFirefoxFactory()
    //       : receiveDataChromeFactory();
  }

  randomToken() {
    return Math.floor((1 + Math.random()) * 1e16)
      .toString(16)
      .substring(1);
  }

  logError(err) {
    if (!err) return;
    if (typeof err === 'string') {
      console.warn(err);
    } else {
      console.warn(err.toString(), err);
    }
  }
  receiveDataFactory() {
    console.log('receiveDataChromeFactory');
    let len, totCount, type, name;
    const buf = [];
    const chunkSize = 16384;
    let count = 0;
    let firstMessage = true;

    return onmessage = (event) => {
      console.log(firstMessage);
      if (typeof event.data === 'string' && firstMessage) {
        const recivedData = JSON.parse(event.data);
        console.log('dataChannel message: ', event.data);
        len = parseInt(recivedData.size, 10);
        type = recivedData.type;
        name = recivedData.name;
        firstMessage = false;
        // buf = new Uint8ClampedArray(parseInt(event.data));

        totCount = Math.ceil(len / chunkSize);
        console.log(
          `Expecting a total of ${len} bytes, which is ${totCount} sendings.`,
        );
        return;
      }
        buf.push(event.data);
        count += 1;
        if (count === totCount) {


        // create a path you want to write to
        // :warning: on iOS, you cannot write into `RNFS.MainBundlePath`,
        // but `RNFS.DocumentDirectoryPath` exists on both platforms and is writable
        var path = RNFS.ExternalDirectoryPath + '/' + name;
        console.log("trying to put it all together!", path);
        // let bufftest = new Uint8ClampedArray(buf);
        // const received = new Blob(buf, { type });
        // saveAs(received, name);
        // let test = new Blob([new Uint8Array(buf)])
        console.log(buf);
        // console.log(received);
        RNFS.writeFile(path, buf, 'utf8', type)
        .then((success) => {
          console.log('FILE WRITTEN!');
        })
        .catch((err) => {
          console.log(err.message);
        });

        // const data = new Uint8ClampedArray(event.data);
        // buf.set(data, count);
        //
        // count += data.byteLength;
        // console.log(`count: ${count}`);
        //
        // if (count === buf.byteLength) {
        //   // we're done: all data chunks have been received
        //   console.log('Done. Rendering photo.');
        //   // renderPhoto(buf);
        // }
      }
    };
  }

  filesInStorage() {
    RNFS.readDir(RNFS.DocumentDirectoryPath) // On Android, use "RNFS.DocumentDirectoryPath" (MainBundlePath is not defined)
    .then((result) => {
    console.log('GOT RESULT', result);

    // stat the first file
    return Promise.all([RNFS.stat(result[0].path), result[0].path]);
  })
  .then((statResult) => {
    if (statResult[0].isFile()) {
      // if we have a file, read it
      return RNFS.readFile(statResult[1], 'utf8');
    }

    return 'no file';
  })
  .then((contents) => {
    // log the file contents
    console.log(contents);
  })
  .catch((err) => {
    console.log(err.message, err.code);
  });
  }

  base64ArrayBuffer(arrayBuffer) {
    var base64    = ''
    var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

    var bytes         = new Uint8Array(arrayBuffer)
    var byteLength    = bytes.byteLength
    var byteRemainder = byteLength % 3
    var mainLength    = byteLength - byteRemainder

    var a, b, c, d
    var chunk

    // Main loop deals with bytes in chunks of 3
    for (var i = 0; i < mainLength; i = i + 3) {
      // Combine the three bytes into a single integer
      chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

      // Use bitmasks to extract 6-bit segments from the triplet
      a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
      b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
      c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
      d = chunk & 63               // 63       = 2^6 - 1

      // Convert the raw binary segments to the appropriate ASCII encoding
      base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
    }

    // Deal with the remaining bytes and padding
    if (byteRemainder == 1) {
      chunk = bytes[mainLength]

      a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

      // Set the 4 least significant bits to zero
      b = (chunk & 3)   << 4 // 3   = 2^2 - 1

      base64 += encodings[a] + encodings[b] + '=='
    } else if (byteRemainder == 2) {
      chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

      a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
      b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

      // Set the 2 least significant bits to zero
      c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

      base64 += encodings[a] + encodings[b] + encodings[c] + '='
    }

    return base64
  }

  uploadFile(event) {
    const file = event.target.files[0];
    console.log(file);

    if (file) {
      const data = new FormData();
      data.append('file', file);
      this.sendData(file);
      // axios.post('/files', data)...
    }
  }
  sendData(file) {
    console.log(
      `File is ${[file.name, file.size, file.type, file.lastModified].join(
        ' ',
      )}`,
    );

    // Handle 0 size files.
    if (file.size === 0) {
      alert('File is empty, please select a non-empty file');
      return;
    }
    const chunkSize = 16384;
    const fileReader = new FileReader();
    let offset = 0;
    this.dataChannel.send(
      JSON.stringify({ size: file.size, type: file.type, name: file.name }),
    );
    fileReader.addEventListener('error', error =>
      console.error('Error reading file:', error),
    );
    fileReader.addEventListener('abort', event =>
      console.log('File reading aborted:', event),
    );
    fileReader.addEventListener('load', e => {
      console.log('FileRead.onload ', e);
      this.dataChannel.send(e.target.result);
      offset += e.target.result.byteLength;
      // sendProgress.value = offset;
      if (offset < file.size) {
        readSlice(offset);
      }
    });
    const readSlice = o => {
      console.log('readSlice ', o);
      const slice = file.slice(offset, o + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
  }
  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Welcome to React Native!</Text>
        <Text style={styles.instructions}>To get started, edit App.js</Text>
        <Text style={styles.instructions}>{instructions}</Text>
        <Button
          onPress={this.filesInStorage}
          title="Read Files"
          color="#841584"
          />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
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
