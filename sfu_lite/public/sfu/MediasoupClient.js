(() => {
    var e = {
            11: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Chrome74 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(5938),
                    d = r(4256),
                    p = r(4893),
                    l = r(521),
                    h = r(1305),
                    m = r(3303),
                    u = new i.Logger('Chrome74'),
                    f = { OS: 1024, MIS: 1024 };
                class g extends l.HandlerInterface {
                    _closed = !1;
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new g();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Chrome74';
                    }
                    close() {
                        if ((u.debug('close()'), !this._closed)) {
                            if (((this._closed = !0), this._pc))
                                try {
                                    this._pc.close();
                                } catch (e) {}
                            this.emit('@close');
                        }
                    }
                    async getNativeRtpCapabilities() {
                        u.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'unified-plan',
                        });
                        try {
                            e.addTransceiver('audio'), e.addTransceiver('video');
                            const t = await e.createOffer();
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp),
                                i = o.extractRtpCapabilities({ sdpObject: r });
                            return d.addNackSupportForOpus(i), i;
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return u.debug('getNativeSctpCapabilities()'), { numStreams: f };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        u.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new h.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', p),
                                video: n.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', p),
                                video: n.getSendingRemoteRtpParameters('video', p),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'unified-plan',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : (u.warn('run() | pc.connectionState not supported, using pc.iceConnectionState'),
                                  this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (this._pc.iceConnectionState) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  }));
                    }
                    async updateIceServers(e) {
                        this.assertNotClosed(), u.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if (
                            (this.assertNotClosed(),
                            u.debug('restartIce()'),
                            this._remoteSdp.updateIceParameters(e),
                            this._transportReady)
                        )
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                u.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                u.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            t &&
                                t.length > 1 &&
                                t.forEach((e, t) => {
                                    e.rid = `r${t}`;
                                });
                        const d = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        d.codecs = n.reduceCodecs(d.codecs, i);
                        const p = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        p.codecs = n.reduceCodecs(p.codecs, i);
                        const l = this._remoteSdp.getNextMediaSectionIdx(),
                            h = this._pc.addTransceiver(e, {
                                direction: 'sendonly',
                                streams: [this._sendStream],
                                sendEncodings: t,
                            });
                        let f,
                            g = await this._pc.createOffer(),
                            _ = s.parse(g.sdp);
                        _.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: _,
                                }));
                        let w = !1;
                        const b = (0, m.parse)((t ?? [{}])[0].scalabilityMode);
                        t &&
                            1 === t.length &&
                            b.spatialLayers > 1 &&
                            'video/vp9' === d.codecs[0].mimeType.toLowerCase() &&
                            (u.debug('send() | enabling legacy simulcast for VP9 SVC'),
                            (w = !0),
                            (_ = s.parse(g.sdp)),
                            (f = _.media[l.idx]),
                            c.addLegacySimulcast({ offerMediaObject: f, numStreams: b.spatialLayers }),
                            (g = { type: 'offer', sdp: s.write(_) })),
                            u.debug('send() | calling pc.setLocalDescription() [offer:%o]', g),
                            await this._pc.setLocalDescription(g);
                        const v = h.mid;
                        if (
                            ((d.mid = v),
                            (_ = s.parse(this._pc.localDescription.sdp)),
                            (f = _.media[l.idx]),
                            (d.rtcp.cname = o.getCname({ offerMediaObject: f })),
                            t)
                        )
                            if (1 === t.length) {
                                let e = c.getRtpEncodings({ offerMediaObject: f });
                                Object.assign(e[0], t[0]), w && (e = [e[0]]), (d.encodings = e);
                            } else d.encodings = t;
                        else d.encodings = c.getRtpEncodings({ offerMediaObject: f });
                        if (
                            d.encodings.length > 1 &&
                            ('video/vp8' === d.codecs[0].mimeType.toLowerCase() ||
                                'video/h264' === d.codecs[0].mimeType.toLowerCase())
                        )
                            for (const e of d.encodings)
                                e.scalabilityMode
                                    ? (e.scalabilityMode = `L1T${b.temporalLayers}`)
                                    : (e.scalabilityMode = 'L1T3');
                        this._remoteSdp.send({
                            offerMediaObject: f,
                            reuseMid: l.reuseMid,
                            offerRtpParameters: d,
                            answerRtpParameters: p,
                            codecOptions: r,
                        });
                        const y = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            u.debug('send() | calling pc.setRemoteDescription() [answer:%o]', y),
                            await this._pc.setRemoteDescription(y),
                            this._mapMidTransceiver.set(v, h),
                            { localId: v, rtpParameters: d, rtpSender: h.sender }
                        );
                    }
                    async stopSending(e) {
                        if ((this.assertSendDirection(), u.debug('stopSending() [localId:%s]', e), this._closed))
                            return;
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        if (
                            (t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.closeMediaSection(t.mid))
                        )
                            try {
                                t.stop();
                            } catch (e) {}
                        const r = await this._pc.createOffer();
                        u.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('pauseSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'inactive'), this._remoteSdp.pauseMediaSection(e);
                        const r = await this._pc.createOffer();
                        u.debug('pauseSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async resumeSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('resumeSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if ((this._remoteSdp.resumeSendingMediaSection(e), !t))
                            throw new Error('associated RTCRtpTransceiver not found');
                        t.direction = 'sendonly';
                        const r = await this._pc.createOffer();
                        u.debug('resumeSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            t
                                ? u.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : u.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        u.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % f.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                u.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            u.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            u.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: s } = t,
                                i = r.get(e),
                                a = n.media.find((e) => String(e.mid) === i);
                            o.applyCodecParameters({ offerRtpParameters: s, answerMediaObject: a });
                        }
                        (a = { type: 'answer', sdp: s.write(n) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: n,
                                })),
                            u.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if ((this.assertRecvDirection(), this._closed)) return;
                        for (const t of e) {
                            u.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('pauseReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'inactive'), this._remoteSdp.pauseMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('pauseReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('resumeReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'recvonly'), this._remoteSdp.resumeReceivingMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('resumeReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        u.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new p.InvalidStateError('method called in a closed handler');
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Chrome74 = g;
            },
            76: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.debug =
                        t.testFakeParameters =
                        t.FakeHandler =
                        t.ortc =
                        t.parseScalabilityMode =
                        t.detectDevice =
                        t.Device =
                        t.version =
                        t.types =
                            void 0);
                const s = r(4646);
                (t.debug = s.default), (t.types = r(8057)), (t.version = '3.9.5');
                var i = r(6004);
                Object.defineProperty(t, 'Device', {
                    enumerable: !0,
                    get: function () {
                        return i.Device;
                    },
                }),
                    Object.defineProperty(t, 'detectDevice', {
                        enumerable: !0,
                        get: function () {
                            return i.detectDevice;
                        },
                    });
                var a = r(3303);
                Object.defineProperty(t, 'parseScalabilityMode', {
                    enumerable: !0,
                    get: function () {
                        return a.parse;
                    },
                }),
                    (t.ortc = r(8046));
                var n = r(2731);
                Object.defineProperty(t, 'FakeHandler', {
                    enumerable: !0,
                    get: function () {
                        return n.FakeHandler;
                    },
                }),
                    (t.testFakeParameters = r(5248));
            },
            115: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var r = {
                    randomUUID: 'undefined' != typeof crypto && crypto.randomUUID && crypto.randomUUID.bind(crypto),
                };
                t.default = r;
            },
            521: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.HandlerInterface = void 0);
                const s = r(3953);
                class i extends s.EnhancedEventEmitter {
                    constructor() {
                        super();
                    }
                }
                t.HandlerInterface = i;
            },
            1131: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0), (t.unsafeStringify = n);
                var s,
                    i = (s = r(9874)) && s.__esModule ? s : { default: s };
                const a = [];
                for (let e = 0; e < 256; ++e) a.push((e + 256).toString(16).slice(1));
                function n(e, t = 0) {
                    return (
                        a[e[t + 0]] +
                        a[e[t + 1]] +
                        a[e[t + 2]] +
                        a[e[t + 3]] +
                        '-' +
                        a[e[t + 4]] +
                        a[e[t + 5]] +
                        '-' +
                        a[e[t + 6]] +
                        a[e[t + 7]] +
                        '-' +
                        a[e[t + 8]] +
                        a[e[t + 9]] +
                        '-' +
                        a[e[t + 10]] +
                        a[e[t + 11]] +
                        a[e[t + 12]] +
                        a[e[t + 13]] +
                        a[e[t + 14]] +
                        a[e[t + 15]]
                    );
                }
                t.default = function (e, t = 0) {
                    const r = n(e, t);
                    if (!(0, i.default)(r)) throw TypeError('Stringified UUID is invalid');
                    return r;
                };
            },
            1305: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.RemoteSdp = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(3471),
                    n = new i.Logger('RemoteSdp');
                t.RemoteSdp = class {
                    _iceParameters;
                    _iceCandidates;
                    _dtlsParameters;
                    _sctpParameters;
                    _plainRtpParameters;
                    _planB;
                    _mediaSections = [];
                    _midToIndex = new Map();
                    _firstMid;
                    _sdpObject;
                    constructor({
                        iceParameters: e,
                        iceCandidates: t,
                        dtlsParameters: r,
                        sctpParameters: s,
                        plainRtpParameters: i,
                        planB: a = !1,
                    }) {
                        if (
                            ((this._iceParameters = e),
                            (this._iceCandidates = t),
                            (this._dtlsParameters = r),
                            (this._sctpParameters = s),
                            (this._plainRtpParameters = i),
                            (this._planB = a),
                            (this._sdpObject = {
                                version: 0,
                                origin: {
                                    address: '0.0.0.0',
                                    ipVer: 4,
                                    netType: 'IN',
                                    sessionId: 1e4,
                                    sessionVersion: 0,
                                    username: 'mediasoup-client',
                                },
                                name: '-',
                                timing: { start: 0, stop: 0 },
                                media: [],
                            }),
                            e?.iceLite && (this._sdpObject.icelite = 'ice-lite'),
                            r)
                        ) {
                            this._sdpObject.msidSemantic = { semantic: 'WMS', token: '*' };
                            const e = this._dtlsParameters.fingerprints.length;
                            (this._sdpObject.fingerprint = {
                                type: r.fingerprints[e - 1].algorithm,
                                hash: r.fingerprints[e - 1].value,
                            }),
                                (this._sdpObject.groups = [{ type: 'BUNDLE', mids: '' }]);
                        }
                        i && ((this._sdpObject.origin.address = i.ip), (this._sdpObject.origin.ipVer = i.ipVersion));
                    }
                    updateIceParameters(e) {
                        n.debug('updateIceParameters() [iceParameters:%o]', e),
                            (this._iceParameters = e),
                            (this._sdpObject.icelite = e.iceLite ? 'ice-lite' : void 0);
                        for (const t of this._mediaSections) t.setIceParameters(e);
                    }
                    updateDtlsRole(e) {
                        n.debug('updateDtlsRole() [role:%s]', e), (this._dtlsParameters.role = e);
                        for (const t of this._mediaSections) t.setDtlsRole(e);
                    }
                    setSessionExtmapAllowMixed() {
                        n.debug('setSessionExtmapAllowMixed()'),
                            (this._sdpObject.extmapAllowMixed = 'extmap-allow-mixed');
                    }
                    getNextMediaSectionIdx() {
                        for (let e = 0; e < this._mediaSections.length; ++e) {
                            const t = this._mediaSections[e];
                            if (t.closed) return { idx: e, reuseMid: t.mid };
                        }
                        return { idx: this._mediaSections.length };
                    }
                    send({
                        offerMediaObject: e,
                        reuseMid: t,
                        offerRtpParameters: r,
                        answerRtpParameters: s,
                        codecOptions: i,
                    }) {
                        const n = new a.AnswerMediaSection({
                            iceParameters: this._iceParameters,
                            iceCandidates: this._iceCandidates,
                            dtlsParameters: this._dtlsParameters,
                            plainRtpParameters: this._plainRtpParameters,
                            planB: this._planB,
                            offerMediaObject: e,
                            offerRtpParameters: r,
                            answerRtpParameters: s,
                            codecOptions: i,
                        });
                        t
                            ? this._replaceMediaSection(n, t)
                            : this._midToIndex.has(n.mid)
                              ? this._replaceMediaSection(n)
                              : this._addMediaSection(n);
                    }
                    receive({ mid: e, kind: t, offerRtpParameters: r, streamId: s, trackId: i }) {
                        const n = this._midToIndex.get(e);
                        let o;
                        if ((void 0 !== n && (o = this._mediaSections[n]), o))
                            o.planBReceive({ offerRtpParameters: r, streamId: s, trackId: i }),
                                this._replaceMediaSection(o);
                        else {
                            o = new a.OfferMediaSection({
                                iceParameters: this._iceParameters,
                                iceCandidates: this._iceCandidates,
                                dtlsParameters: this._dtlsParameters,
                                plainRtpParameters: this._plainRtpParameters,
                                planB: this._planB,
                                mid: e,
                                kind: t,
                                offerRtpParameters: r,
                                streamId: s,
                                trackId: i,
                            });
                            const n = this._mediaSections.find((e) => e.closed);
                            n ? this._replaceMediaSection(o, n.mid) : this._addMediaSection(o);
                        }
                    }
                    pauseMediaSection(e) {
                        this._findMediaSection(e).pause();
                    }
                    resumeSendingMediaSection(e) {
                        this._findMediaSection(e).resume();
                    }
                    resumeReceivingMediaSection(e) {
                        this._findMediaSection(e).resume();
                    }
                    disableMediaSection(e) {
                        this._findMediaSection(e).disable();
                    }
                    closeMediaSection(e) {
                        const t = this._findMediaSection(e);
                        return e === this._firstMid
                            ? (n.debug(
                                  'closeMediaSection() | cannot close first media section, disabling it instead [mid:%s]',
                                  e,
                              ),
                              this.disableMediaSection(e),
                              !1)
                            : (t.close(), this._regenerateBundleMids(), !0);
                    }
                    muxMediaSectionSimulcast(e, t) {
                        const r = this._findMediaSection(e);
                        r.muxSimulcastStreams(t), this._replaceMediaSection(r);
                    }
                    planBStopReceiving({ mid: e, offerRtpParameters: t }) {
                        const r = this._findMediaSection(e);
                        r.planBStopReceiving({ offerRtpParameters: t }), this._replaceMediaSection(r);
                    }
                    sendSctpAssociation({ offerMediaObject: e }) {
                        const t = new a.AnswerMediaSection({
                            iceParameters: this._iceParameters,
                            iceCandidates: this._iceCandidates,
                            dtlsParameters: this._dtlsParameters,
                            sctpParameters: this._sctpParameters,
                            plainRtpParameters: this._plainRtpParameters,
                            offerMediaObject: e,
                        });
                        this._addMediaSection(t);
                    }
                    receiveSctpAssociation({ oldDataChannelSpec: e = !1 } = {}) {
                        const t = new a.OfferMediaSection({
                            iceParameters: this._iceParameters,
                            iceCandidates: this._iceCandidates,
                            dtlsParameters: this._dtlsParameters,
                            sctpParameters: this._sctpParameters,
                            plainRtpParameters: this._plainRtpParameters,
                            mid: 'datachannel',
                            kind: 'application',
                            oldDataChannelSpec: e,
                        });
                        this._addMediaSection(t);
                    }
                    getSdp() {
                        return this._sdpObject.origin.sessionVersion++, s.write(this._sdpObject);
                    }
                    _addMediaSection(e) {
                        this._firstMid || (this._firstMid = e.mid),
                            this._mediaSections.push(e),
                            this._midToIndex.set(e.mid, this._mediaSections.length - 1),
                            this._sdpObject.media.push(e.getObject()),
                            this._regenerateBundleMids();
                    }
                    _replaceMediaSection(e, t) {
                        if ('string' == typeof t) {
                            const r = this._midToIndex.get(t);
                            if (void 0 === r) throw new Error(`no media section found for reuseMid '${t}'`);
                            const s = this._mediaSections[r];
                            (this._mediaSections[r] = e),
                                this._midToIndex.delete(s.mid),
                                this._midToIndex.set(e.mid, r),
                                (this._sdpObject.media[r] = e.getObject()),
                                this._regenerateBundleMids();
                        } else {
                            const t = this._midToIndex.get(e.mid);
                            if (void 0 === t) throw new Error(`no media section found with mid '${e.mid}'`);
                            (this._mediaSections[t] = e), (this._sdpObject.media[t] = e.getObject());
                        }
                    }
                    _findMediaSection(e) {
                        const t = this._midToIndex.get(e);
                        if (void 0 === t) throw new Error(`no media section found with mid '${e}'`);
                        return this._mediaSections[t];
                    }
                    _regenerateBundleMids() {
                        this._dtlsParameters &&
                            (this._sdpObject.groups[0].mids = this._mediaSections
                                .filter((e) => !e.closed)
                                .map((e) => e.mid)
                                .join(' '));
                    }
                };
            },
            1599: (e, t, r) => {
                'use strict';
                function s(e, t, ...r) {
                    if (!e) throw new TypeError(i(t, r));
                }
                function i(e, t) {
                    let r = 0;
                    return e.replace(/%[os]/gu, () => a(t[r++]));
                }
                function a(e) {
                    return 'object' != typeof e || null === e ? String(e) : Object.prototype.toString.call(e);
                }
                let n;
                Object.defineProperty(t, '__esModule', { value: !0 });
                const o =
                    'undefined' != typeof window
                        ? window
                        : 'undefined' != typeof self
                          ? self
                          : void 0 !== r.g
                            ? r.g
                            : 'undefined' != typeof globalThis
                              ? globalThis
                              : void 0;
                let c;
                class d {
                    constructor(e, t) {
                        (this.code = e), (this.message = t);
                    }
                    warn(...e) {
                        var t;
                        try {
                            if (c) return void c({ ...this, args: e });
                            const r = (null !== (t = new Error().stack) && void 0 !== t ? t : '').replace(
                                /^(?:.+?\n){2}/gu,
                                '\n',
                            );
                            console.warn(this.message, ...e, r);
                        } catch (e) {}
                    }
                }
                const p = new d('W01', 'Unable to initialize event under dispatching.'),
                    l = new d('W02', "Assigning any falsy value to 'cancelBubble' property has no effect."),
                    h = new d('W03', "Assigning any truthy value to 'returnValue' property has no effect."),
                    m = new d('W04', 'Unable to preventDefault on non-cancelable events.'),
                    u = new d('W05', 'Unable to preventDefault inside passive event listener invocation.'),
                    f = new d('W06', "An event listener wasn't added because it has been added already: %o, %o"),
                    g = new d(
                        'W07',
                        "The %o option value was abandoned because the event listener wasn't added as duplicated.",
                    ),
                    _ = new d(
                        'W08',
                        "The 'callback' argument must be a function or an object that has 'handleEvent' method: %o",
                    ),
                    w = new d('W09', 'Event attribute handler must be a function: %o');
                class b {
                    static get NONE() {
                        return v;
                    }
                    static get CAPTURING_PHASE() {
                        return y;
                    }
                    static get AT_TARGET() {
                        return S;
                    }
                    static get BUBBLING_PHASE() {
                        return R;
                    }
                    constructor(e, t) {
                        Object.defineProperty(this, 'isTrusted', { value: !1, enumerable: !0 });
                        const r = null != t ? t : {};
                        C.set(this, {
                            type: String(e),
                            bubbles: Boolean(r.bubbles),
                            cancelable: Boolean(r.cancelable),
                            composed: Boolean(r.composed),
                            target: null,
                            currentTarget: null,
                            stopPropagationFlag: !1,
                            stopImmediatePropagationFlag: !1,
                            canceledFlag: !1,
                            inPassiveListenerFlag: !1,
                            dispatchFlag: !1,
                            timeStamp: Date.now(),
                        });
                    }
                    get type() {
                        return P(this).type;
                    }
                    get target() {
                        return P(this).target;
                    }
                    get srcElement() {
                        return P(this).target;
                    }
                    get currentTarget() {
                        return P(this).currentTarget;
                    }
                    composedPath() {
                        const e = P(this).currentTarget;
                        return e ? [e] : [];
                    }
                    get NONE() {
                        return v;
                    }
                    get CAPTURING_PHASE() {
                        return y;
                    }
                    get AT_TARGET() {
                        return S;
                    }
                    get BUBBLING_PHASE() {
                        return R;
                    }
                    get eventPhase() {
                        return P(this).dispatchFlag ? 2 : 0;
                    }
                    stopPropagation() {
                        P(this).stopPropagationFlag = !0;
                    }
                    get cancelBubble() {
                        return P(this).stopPropagationFlag;
                    }
                    set cancelBubble(e) {
                        e ? (P(this).stopPropagationFlag = !0) : l.warn();
                    }
                    stopImmediatePropagation() {
                        const e = P(this);
                        e.stopPropagationFlag = e.stopImmediatePropagationFlag = !0;
                    }
                    get bubbles() {
                        return P(this).bubbles;
                    }
                    get cancelable() {
                        return P(this).cancelable;
                    }
                    get returnValue() {
                        return !P(this).canceledFlag;
                    }
                    set returnValue(e) {
                        e ? h.warn() : D(P(this));
                    }
                    preventDefault() {
                        D(P(this));
                    }
                    get defaultPrevented() {
                        return P(this).canceledFlag;
                    }
                    get composed() {
                        return P(this).composed;
                    }
                    get isTrusted() {
                        return !1;
                    }
                    get timeStamp() {
                        return P(this).timeStamp;
                    }
                    initEvent(e, t = !1, r = !1) {
                        const s = P(this);
                        s.dispatchFlag
                            ? p.warn()
                            : C.set(this, {
                                  ...s,
                                  type: String(e),
                                  bubbles: Boolean(t),
                                  cancelable: Boolean(r),
                                  target: null,
                                  currentTarget: null,
                                  stopPropagationFlag: !1,
                                  stopImmediatePropagationFlag: !1,
                                  canceledFlag: !1,
                              });
                    }
                }
                const v = 0,
                    y = 1,
                    S = 2,
                    R = 3,
                    C = new WeakMap();
                function P(e, t = 'this') {
                    const r = C.get(e);
                    return (
                        s(
                            null != r,
                            "'%s' must be an object that Event constructor created, but got another one: %o",
                            t,
                            e,
                        ),
                        r
                    );
                }
                function D(e) {
                    e.inPassiveListenerFlag ? u.warn() : e.cancelable ? (e.canceledFlag = !0) : m.warn();
                }
                Object.defineProperty(b, 'NONE', { enumerable: !0 }),
                    Object.defineProperty(b, 'CAPTURING_PHASE', { enumerable: !0 }),
                    Object.defineProperty(b, 'AT_TARGET', { enumerable: !0 }),
                    Object.defineProperty(b, 'BUBBLING_PHASE', { enumerable: !0 });
                const T = Object.getOwnPropertyNames(b.prototype);
                for (let e = 0; e < T.length; ++e)
                    'constructor' !== T[e] && Object.defineProperty(b.prototype, T[e], { enumerable: !0 });
                let k;
                void 0 !== o && void 0 !== o.Event && Object.setPrototypeOf(b.prototype, o.Event.prototype);
                const x = {
                    INDEX_SIZE_ERR: 1,
                    DOMSTRING_SIZE_ERR: 2,
                    HIERARCHY_REQUEST_ERR: 3,
                    WRONG_DOCUMENT_ERR: 4,
                    INVALID_CHARACTER_ERR: 5,
                    NO_DATA_ALLOWED_ERR: 6,
                    NO_MODIFICATION_ALLOWED_ERR: 7,
                    NOT_FOUND_ERR: 8,
                    NOT_SUPPORTED_ERR: 9,
                    INUSE_ATTRIBUTE_ERR: 10,
                    INVALID_STATE_ERR: 11,
                    SYNTAX_ERR: 12,
                    INVALID_MODIFICATION_ERR: 13,
                    NAMESPACE_ERR: 14,
                    INVALID_ACCESS_ERR: 15,
                    VALIDATION_ERR: 16,
                    TYPE_MISMATCH_ERR: 17,
                    SECURITY_ERR: 18,
                    NETWORK_ERR: 19,
                    ABORT_ERR: 20,
                    URL_MISMATCH_ERR: 21,
                    QUOTA_EXCEEDED_ERR: 22,
                    TIMEOUT_ERR: 23,
                    INVALID_NODE_TYPE_ERR: 24,
                    DATA_CLONE_ERR: 25,
                };
                function E(e) {
                    const t = Object.keys(x);
                    for (let r = 0; r < t.length; ++r) {
                        const s = t[r],
                            i = x[s];
                        Object.defineProperty(e, s, { get: () => i, configurable: !0, enumerable: !0 });
                    }
                }
                class L extends b {
                    static wrap(e) {
                        return new (j(e))(e);
                    }
                    constructor(e) {
                        super(e.type, { bubbles: e.bubbles, cancelable: e.cancelable, composed: e.composed }),
                            e.cancelBubble && super.stopPropagation(),
                            e.defaultPrevented && super.preventDefault(),
                            I.set(this, { original: e });
                        const t = Object.keys(e);
                        for (let r = 0; r < t.length; ++r) {
                            const s = t[r];
                            s in this || Object.defineProperty(this, s, F(e, s));
                        }
                    }
                    stopPropagation() {
                        super.stopPropagation();
                        const { original: e } = M(this);
                        'stopPropagation' in e && e.stopPropagation();
                    }
                    get cancelBubble() {
                        return super.cancelBubble;
                    }
                    set cancelBubble(e) {
                        super.cancelBubble = e;
                        const { original: t } = M(this);
                        'cancelBubble' in t && (t.cancelBubble = e);
                    }
                    stopImmediatePropagation() {
                        super.stopImmediatePropagation();
                        const { original: e } = M(this);
                        'stopImmediatePropagation' in e && e.stopImmediatePropagation();
                    }
                    get returnValue() {
                        return super.returnValue;
                    }
                    set returnValue(e) {
                        super.returnValue = e;
                        const { original: t } = M(this);
                        'returnValue' in t && (t.returnValue = e);
                    }
                    preventDefault() {
                        super.preventDefault();
                        const { original: e } = M(this);
                        'preventDefault' in e && e.preventDefault();
                    }
                    get timeStamp() {
                        const { original: e } = M(this);
                        return 'timeStamp' in e ? e.timeStamp : super.timeStamp;
                    }
                }
                const I = new WeakMap();
                function M(e) {
                    const t = I.get(e);
                    return s(null != t, "'this' is expected an Event object, but got", e), t;
                }
                const O = new WeakMap();
                function j(e) {
                    const t = Object.getPrototypeOf(e);
                    if (null == t) return L;
                    let r = O.get(t);
                    return (
                        null == r &&
                            ((r = (function (e, t) {
                                class r extends e {}
                                const s = Object.keys(t);
                                for (let e = 0; e < s.length; ++e) Object.defineProperty(r.prototype, s[e], F(t, s[e]));
                                return r;
                            })(j(t), t)),
                            O.set(t, r)),
                        r
                    );
                }
                function F(e, t) {
                    const r = Object.getOwnPropertyDescriptor(e, t);
                    return {
                        get() {
                            const e = M(this).original,
                                r = e[t];
                            return 'function' == typeof r ? r.bind(e) : r;
                        },
                        set(e) {
                            M(this).original[t] = e;
                        },
                        configurable: r.configurable,
                        enumerable: r.enumerable,
                    };
                }
                function A(e) {
                    return !(1 & ~e.flags);
                }
                function N(e) {
                    return !(2 & ~e.flags);
                }
                function B(e) {
                    return !(4 & ~e.flags);
                }
                function z(e) {
                    return !(8 & ~e.flags);
                }
                function $({ callback: e }, t, r) {
                    try {
                        'function' == typeof e ? e.call(t, r) : 'function' == typeof e.handleEvent && e.handleEvent(r);
                    } catch (e) {
                        !(function (e) {
                            try {
                                const t = e instanceof Error ? e : new Error(a(e));
                                if (n) return void n(t);
                                if ('function' == typeof dispatchEvent && 'function' == typeof ErrorEvent)
                                    dispatchEvent(new ErrorEvent('error', { error: t, message: t.message }));
                                else if ('undefined' != typeof process && 'function' == typeof process.emit)
                                    return void process.emit('uncaughtException', t);
                                console.error(t);
                            } catch (e) {}
                        })(e);
                    }
                }
                function U({ listeners: e }, t, r) {
                    for (let s = 0; s < e.length; ++s) if (e[s].callback === t && A(e[s]) === r) return s;
                    return -1;
                }
                function K(e, t, r, s, i, a) {
                    let n;
                    a && ((n = H.bind(null, e, t, r)), a.addEventListener('abort', n));
                    const o = (function (e, t, r, s, i, a) {
                        return {
                            callback: e,
                            flags: (t ? 1 : 0) | (r ? 2 : 0) | (s ? 4 : 0),
                            signal: i,
                            signalListener: a,
                        };
                    })(t, r, s, i, a, n);
                    return e.cow ? ((e.cow = !1), (e.listeners = [...e.listeners, o])) : e.listeners.push(o), o;
                }
                function H(e, t, r) {
                    const s = U(e, t, r);
                    return -1 !== s && G(e, s);
                }
                function G(e, t, r = !1) {
                    const s = e.listeners[t];
                    return (
                        (function (e) {
                            e.flags |= 8;
                        })(s),
                        s.signal && s.signal.removeEventListener('abort', s.signalListener),
                        e.cow && !r
                            ? ((e.cow = !1), (e.listeners = e.listeners.filter((e, r) => r !== t)), !1)
                            : (e.listeners.splice(t, 1), !0)
                    );
                }
                function q(e, t) {
                    var r;
                    return null !== (r = e[t]) && void 0 !== r
                        ? r
                        : (e[t] = { attrCallback: void 0, attrListener: void 0, cow: !1, listeners: [] });
                }
                O.set(Object.prototype, L), void 0 !== o && void 0 !== o.Event && O.set(o.Event.prototype, L);
                class V {
                    constructor() {
                        Q.set(this, Object.create(null));
                    }
                    addEventListener(e, t, r) {
                        const s = W(this),
                            {
                                callback: i,
                                capture: a,
                                once: n,
                                passive: o,
                                signal: c,
                                type: d,
                            } = (function (e, t, r) {
                                var s;
                                return (
                                    Y(t),
                                    'object' == typeof r && null !== r
                                        ? {
                                              type: String(e),
                                              callback: null != t ? t : void 0,
                                              capture: Boolean(r.capture),
                                              passive: Boolean(r.passive),
                                              once: Boolean(r.once),
                                              signal: null !== (s = r.signal) && void 0 !== s ? s : void 0,
                                          }
                                        : {
                                              type: String(e),
                                              callback: null != t ? t : void 0,
                                              capture: Boolean(r),
                                              passive: !1,
                                              once: !1,
                                              signal: void 0,
                                          }
                                );
                            })(e, t, r);
                        if (null == i || (null == c ? void 0 : c.aborted)) return;
                        const p = q(s, d),
                            l = U(p, i, a);
                        -1 === l
                            ? K(p, i, a, o, n, c)
                            : (function (e, t, r, s) {
                                  f.warn(A(e) ? 'capture' : 'bubble', e.callback),
                                      N(e) !== t && g.warn('passive'),
                                      B(e) !== r && g.warn('once'),
                                      e.signal !== s && g.warn('signal');
                              })(p.listeners[l], o, n, c);
                    }
                    removeEventListener(e, t, r) {
                        const s = W(this),
                            {
                                callback: i,
                                capture: a,
                                type: n,
                            } = (function (e, t, r) {
                                return (
                                    Y(t),
                                    'object' == typeof r && null !== r
                                        ? {
                                              type: String(e),
                                              callback: null != t ? t : void 0,
                                              capture: Boolean(r.capture),
                                          }
                                        : { type: String(e), callback: null != t ? t : void 0, capture: Boolean(r) }
                                );
                            })(e, t, r),
                            o = s[n];
                        null != i && o && H(o, i, a);
                    }
                    dispatchEvent(e) {
                        const t = W(this)[String(e.type)];
                        if (null == t) return !0;
                        const r = e instanceof b ? e : L.wrap(e),
                            s = P(r, 'event');
                        if (s.dispatchFlag)
                            throw (
                                ((i = 'This event has been in dispatching.'),
                                o.DOMException
                                    ? new o.DOMException(i, 'InvalidStateError')
                                    : (null == k &&
                                          ((k = class e extends Error {
                                              constructor(t) {
                                                  super(t), Error.captureStackTrace && Error.captureStackTrace(this, e);
                                              }
                                              get code() {
                                                  return 11;
                                              }
                                              get name() {
                                                  return 'InvalidStateError';
                                              }
                                          }),
                                          Object.defineProperties(k.prototype, {
                                              code: { enumerable: !0 },
                                              name: { enumerable: !0 },
                                          }),
                                          E(k),
                                          E(k.prototype)),
                                      new k(i)))
                            );
                        var i;
                        if (((s.dispatchFlag = !0), (s.target = s.currentTarget = this), !s.stopPropagationFlag)) {
                            const { cow: e, listeners: i } = t;
                            t.cow = !0;
                            for (let a = 0; a < i.length; ++a) {
                                const n = i[a];
                                if (
                                    !z(n) &&
                                    (B(n) && G(t, a, !e) && (a -= 1),
                                    (s.inPassiveListenerFlag = N(n)),
                                    $(n, this, r),
                                    (s.inPassiveListenerFlag = !1),
                                    s.stopImmediatePropagationFlag)
                                )
                                    break;
                            }
                            e || (t.cow = !1);
                        }
                        return (
                            (s.target = null),
                            (s.currentTarget = null),
                            (s.stopImmediatePropagationFlag = !1),
                            (s.stopPropagationFlag = !1),
                            (s.dispatchFlag = !1),
                            !s.canceledFlag
                        );
                    }
                }
                const Q = new WeakMap();
                function W(e, t = 'this') {
                    const r = Q.get(e);
                    return (
                        s(
                            null != r,
                            "'%s' must be an object that EventTarget constructor created, but got another one: %o",
                            t,
                            e,
                        ),
                        r
                    );
                }
                function Y(e) {
                    if (
                        'function' != typeof e &&
                        ('object' != typeof e || null === e || 'function' != typeof e.handleEvent)
                    ) {
                        if (null != e && 'object' != typeof e) throw new TypeError(i(_.message, [e]));
                        _.warn(e);
                    }
                }
                const Z = Object.getOwnPropertyNames(V.prototype);
                for (let e = 0; e < Z.length; ++e)
                    'constructor' !== Z[e] && Object.defineProperty(V.prototype, Z[e], { enumerable: !0 });
                function J(e, t) {
                    var r, s;
                    return null !== (s = null === (r = W(e, 'target')[t]) || void 0 === r ? void 0 : r.attrCallback) &&
                        void 0 !== s
                        ? s
                        : null;
                }
                function X(e, t, r) {
                    null != r && 'function' != typeof r && w.warn(r),
                        'function' == typeof r || ('object' == typeof r && null !== r)
                            ? (function (e, t, r) {
                                  const s = q(W(e, 'target'), String(t));
                                  (s.attrCallback = r),
                                      null == s.attrListener &&
                                          (s.attrListener = K(
                                              s,
                                              (function (e) {
                                                  return function (t) {
                                                      const r = e.attrCallback;
                                                      'function' == typeof r && r.call(this, t);
                                                  };
                                              })(s),
                                              !1,
                                              !1,
                                              !1,
                                              void 0,
                                          ));
                              })(e, t, r)
                            : (function (e, t) {
                                  const r = W(e, 'target')[String(t)];
                                  r &&
                                      r.attrListener &&
                                      (H(r, r.attrListener.callback, !1), (r.attrCallback = r.attrListener = void 0));
                              })(e, t);
                }
                function ee(e, t, r) {
                    Object.defineProperty(e, `on${t}`, {
                        get() {
                            return J(this, t);
                        },
                        set(e) {
                            X(this, t, e);
                        },
                        configurable: !0,
                        enumerable: !0,
                    });
                }
                void 0 !== o && void 0 !== o.EventTarget && Object.setPrototypeOf(V.prototype, o.EventTarget.prototype),
                    (t.Event = b),
                    (t.EventTarget = V),
                    (t.default = V),
                    (t.defineCustomEventTarget = function (...e) {
                        class t extends V {}
                        for (let r = 0; r < e.length; ++r) ee(t.prototype, e[r]);
                        return t;
                    }),
                    (t.defineEventAttribute = ee),
                    (t.getEventAttributeValue = J),
                    (t.setErrorHandler = function (e) {
                        s(
                            'function' == typeof e || void 0 === e,
                            'The error handler must be a function or undefined, but got %o.',
                            e,
                        ),
                            (n = e);
                    }),
                    (t.setEventAttributeValue = X),
                    (t.setWarningHandler = function (e) {
                        s(
                            'function' == typeof e || void 0 === e,
                            'The warning handler must be a function or undefined, but got %o.',
                            e,
                        ),
                            (c = e);
                    });
            },
            1765: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.clone = function (e) {
                        return void 0 === e
                            ? void 0
                            : Number.isNaN(e)
                              ? NaN
                              : 'function' == typeof structuredClone
                                ? structuredClone(e)
                                : JSON.parse(JSON.stringify(e));
                    }),
                    (t.generateRandomNumber = function () {
                        return Math.round(1e7 * Math.random());
                    }),
                    (t.deepFreeze = function e(t) {
                        const r = Reflect.ownKeys(t);
                        for (const s of r) {
                            const r = t[s];
                            ((r && 'object' == typeof r) || 'function' == typeof r) && e(r);
                        }
                        return Object.freeze(t);
                    });
            },
            1767: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Firefox60 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(4893),
                    n = r(1765),
                    o = r(8046),
                    c = r(5544),
                    d = r(5938),
                    p = r(521),
                    l = r(1305),
                    h = r(3303),
                    m = new i.Logger('Firefox60'),
                    u = { OS: 16, MIS: 2048 };
                class f extends p.HandlerInterface {
                    _closed = !1;
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new f();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Firefox60';
                    }
                    close() {
                        if ((m.debug('close()'), !this._closed)) {
                            if (((this._closed = !0), this._pc))
                                try {
                                    this._pc.close();
                                } catch (e) {}
                            this.emit('@close');
                        }
                    }
                    async getNativeRtpCapabilities() {
                        m.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                                iceServers: [],
                                iceTransportPolicy: 'all',
                                bundlePolicy: 'max-bundle',
                                rtcpMuxPolicy: 'require',
                            }),
                            t = document.createElement('canvas');
                        t.getContext('2d');
                        const r = t.captureStream().getVideoTracks()[0];
                        try {
                            e.addTransceiver('audio', { direction: 'sendrecv' });
                            const i = e.addTransceiver(r, { direction: 'sendrecv' }),
                                a = i.sender.getParameters(),
                                n = [
                                    { rid: 'r0', maxBitrate: 1e5 },
                                    { rid: 'r1', maxBitrate: 5e5 },
                                ];
                            (a.encodings = n), await i.sender.setParameters(a);
                            const o = await e.createOffer();
                            try {
                                t.remove();
                            } catch (e) {}
                            try {
                                r.stop();
                            } catch (e) {}
                            try {
                                e.close();
                            } catch (e) {}
                            const d = s.parse(o.sdp);
                            return c.extractRtpCapabilities({ sdpObject: d });
                        } catch (s) {
                            try {
                                t.remove();
                            } catch (e) {}
                            try {
                                r.stop();
                            } catch (e) {}
                            try {
                                e.close();
                            } catch (e) {}
                            throw s;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return m.debug('getNativeSctpCapabilities()'), { numStreams: u };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        this.assertNotClosed(),
                            m.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new l.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: o.getSendingRtpParameters('audio', p),
                                video: o.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: o.getSendingRemoteRtpParameters('audio', p),
                                video: o.getSendingRemoteRtpParameters('video', p),
                            }),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: n ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (m.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        throw (this.assertNotClosed(), new a.UnsupportedError('not supported'));
                    }
                    async restartIce(e) {
                        if (
                            (this.assertNotClosed(),
                            m.debug('restartIce()'),
                            this._remoteSdp.updateIceParameters(e),
                            this._transportReady)
                        )
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                m.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                m.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                m.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                m.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            m.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            t &&
                                ((t = n.clone(t)).forEach((e, t) => {
                                    e.rid = `r${t}`;
                                }),
                                t.reverse());
                        const a = n.clone(this._sendingRtpParametersByKind[e.kind]);
                        a.codecs = o.reduceCodecs(a.codecs, i);
                        const p = n.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        p.codecs = o.reduceCodecs(p.codecs, i);
                        const l = this._pc.addTransceiver(e, { direction: 'sendonly', streams: [this._sendStream] });
                        if (t) {
                            const e = l.sender.getParameters();
                            (e.encodings = t), await l.sender.setParameters(e);
                        }
                        const u = await this._pc.createOffer();
                        let f = s.parse(u.sdp);
                        f.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({ localDtlsRole: 'client', localSdpObject: f }));
                        const g = (0, h.parse)((t ?? [{}])[0].scalabilityMode);
                        m.debug('send() | calling pc.setLocalDescription() [offer:%o]', u),
                            await this._pc.setLocalDescription(u);
                        const _ = l.mid;
                        (a.mid = _), (f = s.parse(this._pc.localDescription.sdp));
                        const w = f.media[f.media.length - 1];
                        if (((a.rtcp.cname = c.getCname({ offerMediaObject: w })), t))
                            if (1 === t.length) {
                                const e = d.getRtpEncodings({ offerMediaObject: w });
                                Object.assign(e[0], t[0]), (a.encodings = e);
                            } else a.encodings = t.reverse();
                        else a.encodings = d.getRtpEncodings({ offerMediaObject: w });
                        if (
                            a.encodings.length > 1 &&
                            ('video/vp8' === a.codecs[0].mimeType.toLowerCase() ||
                                'video/h264' === a.codecs[0].mimeType.toLowerCase())
                        )
                            for (const e of a.encodings)
                                e.scalabilityMode
                                    ? (e.scalabilityMode = `L1T${g.temporalLayers}`)
                                    : (e.scalabilityMode = 'L1T3');
                        this._remoteSdp.send({
                            offerMediaObject: w,
                            offerRtpParameters: a,
                            answerRtpParameters: p,
                            codecOptions: r,
                        });
                        const b = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            m.debug('send() | calling pc.setRemoteDescription() [answer:%o]', b),
                            await this._pc.setRemoteDescription(b),
                            this._mapMidTransceiver.set(_, l),
                            { localId: _, rtpParameters: a, rtpSender: l.sender }
                        );
                    }
                    async stopSending(e) {
                        if ((this.assertSendDirection(), m.debug('stopSending() [localId:%s]', e), this._closed))
                            return;
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated transceiver not found');
                        t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.disableMediaSection(t.mid);
                        const r = await this._pc.createOffer();
                        m.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), m.debug('pauseSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'inactive'), this._remoteSdp.pauseMediaSection(e);
                        const r = await this._pc.createOffer();
                        m.debug('pauseSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('pauseSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async resumeSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), m.debug('resumeSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'sendonly'), this._remoteSdp.resumeSendingMediaSection(e);
                        const r = await this._pc.createOffer();
                        m.debug('resumeSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('resumeSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            t
                                ? m.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : m.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            m.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated transceiver not found');
                        const s = r.sender.getParameters();
                        (t = s.encodings.length - 1 - t),
                            s.encodings.forEach((e, r) => {
                                e.active = r >= t;
                            }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        m.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            m.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        m.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        m.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % u.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({ localDtlsRole: 'client', localSdpObject: t })),
                                m.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            m.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            m.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: i } = t,
                                o = r.get(e),
                                d = n.media.find((e) => String(e.mid) === o);
                            c.applyCodecParameters({ offerRtpParameters: i, answerMediaObject: d }),
                                (a = { type: 'answer', sdp: s.write(n) });
                        }
                        this._transportReady ||
                            (await this.setupTransport({ localDtlsRole: 'client', localSdpObject: n })),
                            m.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if ((this.assertRecvDirection(), this._closed)) return;
                        for (const t of e) {
                            m.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        m.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            m.debug('pauseReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'inactive'), this._remoteSdp.pauseMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('pauseReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        m.debug('pauseReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            m.debug('resumeReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'recvonly'), this._remoteSdp.resumeReceivingMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('resumeReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        m.debug('resumeReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        m.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            m.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({ localDtlsRole: 'client', localSdpObject: e });
                            }
                            m.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = c.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new a.InvalidStateError('method called in a closed handler');
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Firefox60 = f;
            },
            1814: (e, t, r) => {
                (t.formatArgs = function (t) {
                    if (
                        ((t[0] =
                            (this.useColors ? '%c' : '') +
                            this.namespace +
                            (this.useColors ? ' %c' : ' ') +
                            t[0] +
                            (this.useColors ? '%c ' : ' ') +
                            '+' +
                            e.exports.humanize(this.diff)),
                        !this.useColors)
                    )
                        return;
                    const r = 'color: ' + this.color;
                    t.splice(1, 0, r, 'color: inherit');
                    let s = 0,
                        i = 0;
                    t[0].replace(/%[a-zA-Z%]/g, (e) => {
                        '%%' !== e && (s++, '%c' === e && (i = s));
                    }),
                        t.splice(i, 0, r);
                }),
                    (t.save = function (e) {
                        try {
                            e ? t.storage.setItem('debug', e) : t.storage.removeItem('debug');
                        } catch (e) {}
                    }),
                    (t.load = function () {
                        let e;
                        try {
                            e = t.storage.getItem('debug');
                        } catch (e) {}
                        return !e && 'undefined' != typeof process && 'env' in process && (e = process.env.DEBUG), e;
                    }),
                    (t.useColors = function () {
                        if (
                            'undefined' != typeof window &&
                            window.process &&
                            ('renderer' === window.process.type || window.process.__nwjs)
                        )
                            return !0;
                        if (
                            'undefined' != typeof navigator &&
                            navigator.userAgent &&
                            navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
                        )
                            return !1;
                        let e;
                        return (
                            ('undefined' != typeof document &&
                                document.documentElement &&
                                document.documentElement.style &&
                                document.documentElement.style.WebkitAppearance) ||
                            ('undefined' != typeof window &&
                                window.console &&
                                (window.console.firebug || (window.console.exception && window.console.table))) ||
                            ('undefined' != typeof navigator &&
                                navigator.userAgent &&
                                (e = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
                                parseInt(e[1], 10) >= 31) ||
                            ('undefined' != typeof navigator &&
                                navigator.userAgent &&
                                navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
                        );
                    }),
                    (t.storage = (function () {
                        try {
                            return localStorage;
                        } catch (e) {}
                    })()),
                    (t.destroy = (() => {
                        let e = !1;
                        return () => {
                            e ||
                                ((e = !0),
                                console.warn(
                                    'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
                                ));
                        };
                    })()),
                    (t.colors = [
                        '#0000CC',
                        '#0000FF',
                        '#0033CC',
                        '#0033FF',
                        '#0066CC',
                        '#0066FF',
                        '#0099CC',
                        '#0099FF',
                        '#00CC00',
                        '#00CC33',
                        '#00CC66',
                        '#00CC99',
                        '#00CCCC',
                        '#00CCFF',
                        '#3300CC',
                        '#3300FF',
                        '#3333CC',
                        '#3333FF',
                        '#3366CC',
                        '#3366FF',
                        '#3399CC',
                        '#3399FF',
                        '#33CC00',
                        '#33CC33',
                        '#33CC66',
                        '#33CC99',
                        '#33CCCC',
                        '#33CCFF',
                        '#6600CC',
                        '#6600FF',
                        '#6633CC',
                        '#6633FF',
                        '#66CC00',
                        '#66CC33',
                        '#9900CC',
                        '#9900FF',
                        '#9933CC',
                        '#9933FF',
                        '#99CC00',
                        '#99CC33',
                        '#CC0000',
                        '#CC0033',
                        '#CC0066',
                        '#CC0099',
                        '#CC00CC',
                        '#CC00FF',
                        '#CC3300',
                        '#CC3333',
                        '#CC3366',
                        '#CC3399',
                        '#CC33CC',
                        '#CC33FF',
                        '#CC6600',
                        '#CC6633',
                        '#CC9900',
                        '#CC9933',
                        '#CCCC00',
                        '#CCCC33',
                        '#FF0000',
                        '#FF0033',
                        '#FF0066',
                        '#FF0099',
                        '#FF00CC',
                        '#FF00FF',
                        '#FF3300',
                        '#FF3333',
                        '#FF3366',
                        '#FF3399',
                        '#FF33CC',
                        '#FF33FF',
                        '#FF6600',
                        '#FF6633',
                        '#FF9900',
                        '#FF9933',
                        '#FFCC00',
                        '#FFCC33',
                    ]),
                    (t.log = console.debug || console.log || (() => {})),
                    (e.exports = r(4057)(t));
                const { formatters: s } = e.exports;
                s.j = function (e) {
                    try {
                        return JSON.stringify(e);
                    } catch (e) {
                        return '[UnexpectedJSONParseError]: ' + e.message;
                    }
                };
            },
            1885: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s = a(r(4604)),
                    i = a(r(7965));
                function a(e) {
                    return e && e.__esModule ? e : { default: e };
                }
                var n = (0, s.default)('v5', 80, i.default);
                t.default = n;
            },
            1966: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s = n(r(115)),
                    i = n(r(3907)),
                    a = r(1131);
                function n(e) {
                    return e && e.__esModule ? e : { default: e };
                }
                t.default = function (e, t, r) {
                    if (s.default.randomUUID && !t && !e) return s.default.randomUUID();
                    const n = (e = e || {}).random || (e.rng || i.default)();
                    if (((n[6] = (15 & n[6]) | 64), (n[8] = (63 & n[8]) | 128), t)) {
                        r = r || 0;
                        for (let e = 0; e < 16; ++e) t[r + e] = n[e];
                        return t;
                    }
                    return (0, a.unsafeStringify)(n);
                };
            },
            1970: (e, t, r) => {
                (t.formatArgs = function (t) {
                    if (
                        ((t[0] =
                            (this.useColors ? '%c' : '') +
                            this.namespace +
                            (this.useColors ? ' %c' : ' ') +
                            t[0] +
                            (this.useColors ? '%c ' : ' ') +
                            '+' +
                            e.exports.humanize(this.diff)),
                        !this.useColors)
                    )
                        return;
                    const r = 'color: ' + this.color;
                    t.splice(1, 0, r, 'color: inherit');
                    let s = 0,
                        i = 0;
                    t[0].replace(/%[a-zA-Z%]/g, (e) => {
                        '%%' !== e && (s++, '%c' === e && (i = s));
                    }),
                        t.splice(i, 0, r);
                }),
                    (t.save = function (e) {
                        try {
                            e ? t.storage.setItem('debug', e) : t.storage.removeItem('debug');
                        } catch (e) {}
                    }),
                    (t.load = function () {
                        let e;
                        try {
                            e = t.storage.getItem('debug');
                        } catch (e) {}
                        return !e && 'undefined' != typeof process && 'env' in process && (e = process.env.DEBUG), e;
                    }),
                    (t.useColors = function () {
                        if (
                            'undefined' != typeof window &&
                            window.process &&
                            ('renderer' === window.process.type || window.process.__nwjs)
                        )
                            return !0;
                        if (
                            'undefined' != typeof navigator &&
                            navigator.userAgent &&
                            navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
                        )
                            return !1;
                        let e;
                        return (
                            ('undefined' != typeof document &&
                                document.documentElement &&
                                document.documentElement.style &&
                                document.documentElement.style.WebkitAppearance) ||
                            ('undefined' != typeof window &&
                                window.console &&
                                (window.console.firebug || (window.console.exception && window.console.table))) ||
                            ('undefined' != typeof navigator &&
                                navigator.userAgent &&
                                (e = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
                                parseInt(e[1], 10) >= 31) ||
                            ('undefined' != typeof navigator &&
                                navigator.userAgent &&
                                navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
                        );
                    }),
                    (t.storage = (function () {
                        try {
                            return localStorage;
                        } catch (e) {}
                    })()),
                    (t.destroy = (() => {
                        let e = !1;
                        return () => {
                            e ||
                                ((e = !0),
                                console.warn(
                                    'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
                                ));
                        };
                    })()),
                    (t.colors = [
                        '#0000CC',
                        '#0000FF',
                        '#0033CC',
                        '#0033FF',
                        '#0066CC',
                        '#0066FF',
                        '#0099CC',
                        '#0099FF',
                        '#00CC00',
                        '#00CC33',
                        '#00CC66',
                        '#00CC99',
                        '#00CCCC',
                        '#00CCFF',
                        '#3300CC',
                        '#3300FF',
                        '#3333CC',
                        '#3333FF',
                        '#3366CC',
                        '#3366FF',
                        '#3399CC',
                        '#3399FF',
                        '#33CC00',
                        '#33CC33',
                        '#33CC66',
                        '#33CC99',
                        '#33CCCC',
                        '#33CCFF',
                        '#6600CC',
                        '#6600FF',
                        '#6633CC',
                        '#6633FF',
                        '#66CC00',
                        '#66CC33',
                        '#9900CC',
                        '#9900FF',
                        '#9933CC',
                        '#9933FF',
                        '#99CC00',
                        '#99CC33',
                        '#CC0000',
                        '#CC0033',
                        '#CC0066',
                        '#CC0099',
                        '#CC00CC',
                        '#CC00FF',
                        '#CC3300',
                        '#CC3333',
                        '#CC3366',
                        '#CC3399',
                        '#CC33CC',
                        '#CC33FF',
                        '#CC6600',
                        '#CC6633',
                        '#CC9900',
                        '#CC9933',
                        '#CCCC00',
                        '#CCCC33',
                        '#FF0000',
                        '#FF0033',
                        '#FF0066',
                        '#FF0099',
                        '#FF00CC',
                        '#FF00FF',
                        '#FF3300',
                        '#FF3333',
                        '#FF3366',
                        '#FF3399',
                        '#FF33CC',
                        '#FF33FF',
                        '#FF6600',
                        '#FF6633',
                        '#FF9900',
                        '#FF9933',
                        '#FFCC00',
                        '#FFCC33',
                    ]),
                    (t.log = console.debug || console.log || (() => {})),
                    (e.exports = r(6749)(t));
                const { formatters: s } = e.exports;
                s.j = function (e) {
                    try {
                        return JSON.stringify(e);
                    } catch (e) {
                        return '[UnexpectedJSONParseError]: ' + e.message;
                    }
                };
            },
            2109: function (e, t, r) {
                var s;
                !(function (i, a) {
                    'use strict';
                    var n,
                        o = 'user-agent',
                        c = '',
                        d = 'function',
                        p = 'undefined',
                        l = 'object',
                        h = 'string',
                        m = 'browser',
                        u = 'cpu',
                        f = 'device',
                        g = 'engine',
                        _ = 'os',
                        w = 'result',
                        b = 'name',
                        v = 'type',
                        y = 'vendor',
                        S = 'version',
                        R = 'architecture',
                        C = 'major',
                        P = 'model',
                        D = 'console',
                        T = 'mobile',
                        k = 'tablet',
                        x = 'smarttv',
                        E = 'wearable',
                        L = 'xr',
                        I = 'embedded',
                        M = 'inapp',
                        O = 'brands',
                        j = 'formFactors',
                        F = 'fullVersionList',
                        A = 'platform',
                        N = 'platformVersion',
                        B = 'bitness',
                        z = 'sec-ch-ua',
                        $ = z + '-full-version-list',
                        U = z + '-arch',
                        K = z + '-' + B,
                        H = z + '-form-factors',
                        G = z + '-' + T,
                        q = z + '-' + P,
                        V = z + '-' + A,
                        Q = V + '-version',
                        W = [O, F, T, P, A, N, R, j, B],
                        Y = 'Amazon',
                        Z = 'Apple',
                        J = 'ASUS',
                        X = 'BlackBerry',
                        ee = 'Google',
                        te = 'Huawei',
                        re = 'Lenovo',
                        se = 'Honor',
                        ie = 'LG',
                        ae = 'Microsoft',
                        ne = 'Motorola',
                        oe = 'Nvidia',
                        ce = 'OnePlus',
                        de = 'OPPO',
                        pe = 'Samsung',
                        le = 'Sharp',
                        he = 'Sony',
                        me = 'Xiaomi',
                        ue = 'Zebra',
                        fe = 'Chrome',
                        ge = 'Chromium',
                        _e = 'Chromecast',
                        we = 'Firefox',
                        be = 'Opera',
                        ve = 'Facebook',
                        ye = 'Sogou',
                        Se = 'Mobile ',
                        Re = ' Browser',
                        Ce = 'Windows',
                        Pe = typeof i !== p,
                        De = Pe && i.navigator ? i.navigator : a,
                        Te = De && De.userAgentData ? De.userAgentData : a,
                        ke = function (e) {
                            for (var t = {}, r = 0; r < e.length; r++) t[e[r].toUpperCase()] = e[r];
                            return t;
                        },
                        xe = function (e, t) {
                            if (typeof e === l && e.length > 0) {
                                for (var r in e) if (Me(e[r]) == Me(t)) return !0;
                                return !1;
                            }
                            return !!Le(e) && -1 !== Me(t).indexOf(Me(e));
                        },
                        Ee = function (e, t) {
                            for (var r in e) return /^(browser|cpu|device|engine|os)$/.test(r) || (!!t && Ee(e[r]));
                        },
                        Le = function (e) {
                            return typeof e === h;
                        },
                        Ie = function (e) {
                            if (!e) return a;
                            for (var t = [], r = Fe(/\\?\"/g, e).split(','), s = 0; s < r.length; s++)
                                if (r[s].indexOf(';') > -1) {
                                    var i = Ne(r[s]).split(';v=');
                                    t[s] = { brand: i[0], version: i[1] };
                                } else t[s] = Ne(r[s]);
                            return t;
                        },
                        Me = function (e) {
                            return Le(e) ? e.toLowerCase() : e;
                        },
                        Oe = function (e) {
                            return Le(e) ? Fe(/[^\d\.]/g, e).split('.')[0] : a;
                        },
                        je = function (e) {
                            for (var t in e) {
                                var r = e[t];
                                typeof r == l && 2 == r.length ? (this[r[0]] = r[1]) : (this[r] = a);
                            }
                            return this;
                        },
                        Fe = function (e, t) {
                            return Le(t) ? t.replace(e, c) : t;
                        },
                        Ae = function (e) {
                            return Fe(/\\?\"/g, e);
                        },
                        Ne = function (e, t) {
                            if (Le(e)) return (e = Fe(/^\s\s*/, e)), typeof t === p ? e : e.substring(0, 500);
                        },
                        Be = function (e, t) {
                            if (e && t)
                                for (var r, s, i, n, o, c, p = 0; p < t.length && !o; ) {
                                    var h = t[p],
                                        m = t[p + 1];
                                    for (r = s = 0; r < h.length && !o && h[r]; )
                                        if ((o = h[r++].exec(e)))
                                            for (i = 0; i < m.length; i++)
                                                (c = o[++s]),
                                                    typeof (n = m[i]) === l && n.length > 0
                                                        ? 2 === n.length
                                                            ? typeof n[1] == d
                                                                ? (this[n[0]] = n[1].call(this, c))
                                                                : (this[n[0]] = n[1])
                                                            : 3 === n.length
                                                              ? typeof n[1] !== d || (n[1].exec && n[1].test)
                                                                  ? (this[n[0]] = c ? c.replace(n[1], n[2]) : a)
                                                                  : (this[n[0]] = c ? n[1].call(this, c, n[2]) : a)
                                                              : 4 === n.length &&
                                                                (this[n[0]] = c
                                                                    ? n[3].call(this, c.replace(n[1], n[2]))
                                                                    : a)
                                                        : (this[n] = c || a);
                                    p += 2;
                                }
                        },
                        ze = function (e, t) {
                            for (var r in t)
                                if (typeof t[r] === l && t[r].length > 0) {
                                    for (var s = 0; s < t[r].length; s++) if (xe(t[r][s], e)) return '?' === r ? a : r;
                                } else if (xe(t[r], e)) return '?' === r ? a : r;
                            return t.hasOwnProperty('*') ? t['*'] : e;
                        },
                        $e = {
                            ME: '4.90',
                            'NT 3.11': 'NT3.51',
                            'NT 4.0': 'NT4.0',
                            2e3: 'NT 5.0',
                            XP: ['NT 5.1', 'NT 5.2'],
                            Vista: 'NT 6.0',
                            7: 'NT 6.1',
                            8: 'NT 6.2',
                            8.1: 'NT 6.3',
                            10: ['NT 6.4', 'NT 10.0'],
                            RT: 'ARM',
                        },
                        Ue = {
                            embedded: 'Automotive',
                            mobile: 'Mobile',
                            tablet: ['Tablet', 'EInk'],
                            smarttv: 'TV',
                            wearable: 'Watch',
                            xr: ['VR', 'XR'],
                            '?': ['Desktop', 'Unknown'],
                            '*': a,
                        },
                        Ke = {
                            browser: [
                                [/\b(?:crmo|crios)\/([\w\.]+)/i],
                                [S, [b, Se + 'Chrome']],
                                [/edg(?:e|ios|a)?\/([\w\.]+)/i],
                                [S, [b, 'Edge']],
                                [
                                    /(opera mini)\/([-\w\.]+)/i,
                                    /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i,
                                    /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i,
                                ],
                                [b, S],
                                [/opios[\/ ]+([\w\.]+)/i],
                                [S, [b, be + ' Mini']],
                                [/\bop(?:rg)?x\/([\w\.]+)/i],
                                [S, [b, be + ' GX']],
                                [/\bopr\/([\w\.]+)/i],
                                [S, [b, be]],
                                [/\bb[ai]*d(?:uhd|[ub]*[aekoprswx]{5,6})[\/ ]?([\w\.]+)/i],
                                [S, [b, 'Baidu']],
                                [/\b(?:mxbrowser|mxios|myie2)\/?([-\w\.]*)\b/i],
                                [S, [b, 'Maxthon']],
                                [
                                    /(kindle)\/([\w\.]+)/i,
                                    /(lunascape|maxthon|netfront|jasmine|blazer|sleipnir)[\/ ]?([\w\.]*)/i,
                                    /(avant|iemobile|slim(?:browser|boat|jet))[\/ ]?([\d\.]*)/i,
                                    /(?:ms|\()(ie) ([\w\.]+)/i,
                                    /(flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs|bowser|qupzilla|falkon|rekonq|puffin|brave|whale(?!.+naver)|qqbrowserlite|duckduckgo|klar|helio|(?=comodo_)?dragon|otter|dooble|(?:lg |qute)browser)\/([-\w\.]+)/i,
                                    /(heytap|ovi|115|surf)browser\/([\d\.]+)/i,
                                    /(ecosia|weibo)(?:__| \w+@)([\d\.]+)/i,
                                ],
                                [b, S],
                                [/quark(?:pc)?\/([-\w\.]+)/i],
                                [S, [b, 'Quark']],
                                [/\bddg\/([\w\.]+)/i],
                                [S, [b, 'DuckDuckGo']],
                                [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i],
                                [S, [b, 'UCBrowser']],
                                [
                                    /microm.+\bqbcore\/([\w\.]+)/i,
                                    /\bqbcore\/([\w\.]+).+microm/i,
                                    /micromessenger\/([\w\.]+)/i,
                                ],
                                [S, [b, 'WeChat']],
                                [/konqueror\/([\w\.]+)/i],
                                [S, [b, 'Konqueror']],
                                [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i],
                                [S, [b, 'IE']],
                                [/ya(?:search)?browser\/([\w\.]+)/i],
                                [S, [b, 'Yandex']],
                                [/slbrowser\/([\w\.]+)/i],
                                [S, [b, 'Smart ' + re + Re]],
                                [/(avast|avg)\/([\w\.]+)/i],
                                [[b, /(.+)/, '$1 Secure' + Re], S],
                                [/\bfocus\/([\w\.]+)/i],
                                [S, [b, we + ' Focus']],
                                [/\bopt\/([\w\.]+)/i],
                                [S, [b, be + ' Touch']],
                                [/coc_coc\w+\/([\w\.]+)/i],
                                [S, [b, 'Coc Coc']],
                                [/dolfin\/([\w\.]+)/i],
                                [S, [b, 'Dolphin']],
                                [/coast\/([\w\.]+)/i],
                                [S, [b, be + ' Coast']],
                                [/miuibrowser\/([\w\.]+)/i],
                                [S, [b, 'MIUI' + Re]],
                                [/fxios\/([\w\.-]+)/i],
                                [S, [b, Se + we]],
                                [/\bqihoobrowser\/?([\w\.]*)/i],
                                [S, [b, '360']],
                                [/\b(qq)\/([\w\.]+)/i],
                                [[b, /(.+)/, '$1Browser'], S],
                                [/(oculus|sailfish|huawei|vivo|pico)browser\/([\w\.]+)/i],
                                [[b, /(.+)/, '$1' + Re], S],
                                [/samsungbrowser\/([\w\.]+)/i],
                                [S, [b, pe + ' Internet']],
                                [/metasr[\/ ]?([\d\.]+)/i],
                                [S, [b, ye + ' Explorer']],
                                [/(sogou)mo\w+\/([\d\.]+)/i],
                                [[b, ye + ' Mobile'], S],
                                [
                                    /(electron)\/([\w\.]+) safari/i,
                                    /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i,
                                    /m?(qqbrowser|2345(?=browser|chrome|explorer))\w*[\/ ]?v?([\w\.]+)/i,
                                ],
                                [b, S],
                                [/(lbbrowser|rekonq)/i],
                                [b],
                                [/ome\/([\w\.]+) \w* ?(iron) saf/i, /ome\/([\w\.]+).+qihu (360)[es]e/i],
                                [S, b],
                                [/((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i],
                                [[b, ve], S, [v, M]],
                                [
                                    /(Klarna)\/([\w\.]+)/i,
                                    /(kakao(?:talk|story))[\/ ]([\w\.]+)/i,
                                    /(naver)\(.*?(\d+\.[\w\.]+).*\)/i,
                                    /(daum)apps[\/ ]([\w\.]+)/i,
                                    /safari (line)\/([\w\.]+)/i,
                                    /\b(line)\/([\w\.]+)\/iab/i,
                                    /(alipay)client\/([\w\.]+)/i,
                                    /(twitter)(?:and| f.+e\/([\w\.]+))/i,
                                    /(instagram|snapchat)[\/ ]([-\w\.]+)/i,
                                ],
                                [b, S, [v, M]],
                                [/\bgsa\/([\w\.]+) .*safari\//i],
                                [S, [b, 'GSA'], [v, M]],
                                [/musical_ly(?:.+app_?version\/|_)([\w\.]+)/i],
                                [S, [b, 'TikTok'], [v, M]],
                                [/\[(linkedin)app\]/i],
                                [b, [v, M]],
                                [/(chromium)[\/ ]([-\w\.]+)/i],
                                [b, S],
                                [/headlesschrome(?:\/([\w\.]+)| )/i],
                                [S, [b, fe + ' Headless']],
                                [/ wv\).+(chrome)\/([\w\.]+)/i],
                                [[b, fe + ' WebView'], S],
                                [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i],
                                [S, [b, 'Android' + Re]],
                                [/chrome\/([\w\.]+) mobile/i],
                                [S, [b, Se + 'Chrome']],
                                [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i],
                                [b, S],
                                [/version\/([\w\.\,]+) .*mobile(?:\/\w+ | ?)safari/i],
                                [S, [b, Se + 'Safari']],
                                [/iphone .*mobile(?:\/\w+ | ?)safari/i],
                                [[b, Se + 'Safari']],
                                [/version\/([\w\.\,]+) .*(safari)/i],
                                [S, b],
                                [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i],
                                [b, [S, '1']],
                                [/(webkit|khtml)\/([\w\.]+)/i],
                                [b, S],
                                [/(?:mobile|tablet);.*(firefox)\/([\w\.-]+)/i],
                                [[b, Se + we], S],
                                [/(navigator|netscape\d?)\/([-\w\.]+)/i],
                                [[b, 'Netscape'], S],
                                [/(wolvic|librewolf)\/([\w\.]+)/i],
                                [b, S],
                                [/mobile vr; rv:([\w\.]+)\).+firefox/i],
                                [S, [b, we + ' Reality']],
                                [
                                    /ekiohf.+(flow)\/([\w\.]+)/i,
                                    /(swiftfox)/i,
                                    /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror)[\/ ]?([\w\.\+]+)/i,
                                    /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i,
                                    /(firefox)\/([\w\.]+)/i,
                                    /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i,
                                    /(amaya|dillo|doris|icab|ladybird|lynx|mosaic|netsurf|obigo|polaris|w3m|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i,
                                    /\b(links) \(([\w\.]+)/i,
                                ],
                                [b, [S, /_/g, '.']],
                                [/(cobalt)\/([\w\.]+)/i],
                                [b, [S, /[^\d\.]+./, c]],
                            ],
                            cpu: [
                                [/\b((amd|x|x86[-_]?|wow|win)64)\b/i],
                                [[R, 'amd64']],
                                [/(ia32(?=;))/i, /\b((i[346]|x)86)(pc)?\b/i],
                                [[R, 'ia32']],
                                [/\b(aarch64|arm(v?[89]e?l?|_?64))\b/i],
                                [[R, 'arm64']],
                                [/\b(arm(v[67])?ht?n?[fl]p?)\b/i],
                                [[R, 'armhf']],
                                [/( (ce|mobile); ppc;|\/[\w\.]+arm\b)/i],
                                [[R, 'arm']],
                                [/((ppc|powerpc)(64)?)( mac|;|\))/i],
                                [[R, /ower/, c, Me]],
                                [/ sun4\w[;\)]/i],
                                [[R, 'sparc']],
                                [
                                    /\b(avr32|ia64(?=;)|68k(?=\))|\barm(?=v([1-7]|[5-7]1)l?|;|eabi)|(irix|mips|sparc)(64)?\b|pa-risc)/i,
                                ],
                                [[R, Me]],
                            ],
                            device: [
                                [/\b(sch-i[89]0\d|shw-m380s|sm-[ptx]\w{2,4}|gt-[pn]\d{2,4}|sgh-t8[56]9|nexus 10)/i],
                                [P, [y, pe], [v, k]],
                                [
                                    /\b((?:s[cgp]h|gt|sm)-(?![lr])\w+|sc[g-]?[\d]+a?|galaxy nexus)/i,
                                    /samsung[- ]((?!sm-[lr])[-\w]+)/i,
                                    /sec-(sgh\w+)/i,
                                ],
                                [P, [y, pe], [v, T]],
                                [/(?:\/|\()(ip(?:hone|od)[\w, ]*)(?:\/|;)/i],
                                [P, [y, Z], [v, T]],
                                [
                                    /\((ipad);[-\w\),; ]+apple/i,
                                    /applecoremedia\/[\w\.]+ \((ipad)/i,
                                    /\b(ipad)\d\d?,\d\d?[;\]].+ios/i,
                                ],
                                [P, [y, Z], [v, k]],
                                [/(macintosh);/i],
                                [P, [y, Z]],
                                [/\b(sh-?[altvz]?\d\d[a-ekm]?)/i],
                                [P, [y, le], [v, T]],
                                [
                                    /\b((?:brt|eln|hey2?|gdi|jdn)-a?[lnw]09|(?:ag[rm]3?|jdn2|kob2)-a?[lw]0[09]hn)(?: bui|\)|;)/i,
                                ],
                                [P, [y, se], [v, k]],
                                [/honor([-\w ]+)[;\)]/i],
                                [P, [y, se], [v, T]],
                                [
                                    /\b((?:ag[rs][2356]?k?|bah[234]?|bg[2o]|bt[kv]|cmr|cpn|db[ry]2?|jdn2|got|kob2?k?|mon|pce|scm|sht?|[tw]gr|vrd)-[ad]?[lw][0125][09]b?|605hw|bg2-u03|(?:gem|fdr|m2|ple|t1)-[7a]0[1-4][lu]|t1-a2[13][lw]|mediapad[\w\. ]*(?= bui|\)))\b(?!.+d\/s)/i,
                                ],
                                [P, [y, te], [v, k]],
                                [
                                    /(?:huawei)([-\w ]+)[;\)]/i,
                                    /\b(nexus 6p|\w{2,4}e?-[atu]?[ln][\dx][012359c][adn]?)\b(?!.+d\/s)/i,
                                ],
                                [P, [y, te], [v, T]],
                                [
                                    /oid[^\)]+; (2[\dbc]{4}(182|283|rp\w{2})[cgl]|m2105k81a?c)(?: bui|\))/i,
                                    /\b((?:red)?mi[-_ ]?pad[\w- ]*)(?: bui|\))/i,
                                ],
                                [
                                    [P, /_/g, ' '],
                                    [y, me],
                                    [v, k],
                                ],
                                [
                                    /\b(poco[\w ]+|m2\d{3}j\d\d[a-z]{2})(?: bui|\))/i,
                                    /\b; (\w+) build\/hm\1/i,
                                    /\b(hm[-_ ]?note?[_ ]?(?:\d\w)?) bui/i,
                                    /\b(redmi[\-_ ]?(?:note|k)?[\w_ ]+)(?: bui|\))/i,
                                    /oid[^\)]+; (m?[12][0-389][01]\w{3,6}[c-y])( bui|; wv|\))/i,
                                    /\b(mi[-_ ]?(?:a\d|one|one[_ ]plus|note lte|max|cc)?[_ ]?(?:\d?\w?)[_ ]?(?:plus|se|lite|pro)?)(?: bui|\))/i,
                                    / ([\w ]+) miui\/v?\d/i,
                                ],
                                [
                                    [P, /_/g, ' '],
                                    [y, me],
                                    [v, T],
                                ],
                                [
                                    /; (\w+) bui.+ oppo/i,
                                    /\b(cph[12]\d{3}|p(?:af|c[al]|d\w|e[ar])[mt]\d0|x9007|a101op)\b/i,
                                ],
                                [P, [y, de], [v, T]],
                                [/\b(opd2(\d{3}a?))(?: bui|\))/i],
                                [P, [y, ze, { OnePlus: ['304', '403', '203'], '*': de }], [v, k]],
                                [/(vivo (5r?|6|8l?|go|one|s|x[il]?[2-4]?)[\w\+ ]*)(?: bui|\))/i],
                                [P, [y, 'BLU'], [v, T]],
                                [/; vivo (\w+)(?: bui|\))/i, /\b(v[12]\d{3}\w?[at])(?: bui|;)/i],
                                [P, [y, 'Vivo'], [v, T]],
                                [/\b(rmx[1-3]\d{3})(?: bui|;|\))/i],
                                [P, [y, 'Realme'], [v, T]],
                                [
                                    /\b(milestone|droid(?:[2-4x]| (?:bionic|x2|pro|razr))?:?( 4g)?)\b[\w ]+build\//i,
                                    /\bmot(?:orola)?[- ](\w*)/i,
                                    /((?:moto(?! 360)[\w\(\) ]+|xt\d{3,4}|nexus 6)(?= bui|\)))/i,
                                ],
                                [P, [y, ne], [v, T]],
                                [/\b(mz60\d|xoom[2 ]{0,2}) build\//i],
                                [P, [y, ne], [v, k]],
                                [/((?=lg)?[vl]k\-?\d{3}) bui| 3\.[-\w; ]{10}lg?-([06cv9]{3,4})/i],
                                [P, [y, ie], [v, k]],
                                [
                                    /(lm(?:-?f100[nv]?|-[\w\.]+)(?= bui|\))|nexus [45])/i,
                                    /\blg[-e;\/ ]+(?!.*(?:browser|netcast|android tv|watch))(\w+)/i,
                                    /\blg-?([\d\w]+) bui/i,
                                ],
                                [P, [y, ie], [v, T]],
                                [
                                    /(ideatab[-\w ]+|602lv|d-42a|a101lv|a2109a|a3500-hv|s[56]000|pb-6505[my]|tb-?x?\d{3,4}(?:f[cu]|xu|[av])|yt\d?-[jx]?\d+[lfmx])( bui|;|\)|\/)/i,
                                    /lenovo ?(b[68]0[08]0-?[hf]?|tab(?:[\w- ]+?)|tb[\w-]{6,7})( bui|;|\)|\/)/i,
                                ],
                                [P, [y, re], [v, k]],
                                [/(nokia) (t[12][01])/i],
                                [y, P, [v, k]],
                                [/(?:maemo|nokia).*(n900|lumia \d+|rm-\d+)/i, /nokia[-_ ]?(([-\w\. ]*))/i],
                                [
                                    [P, /_/g, ' '],
                                    [v, T],
                                    [y, 'Nokia'],
                                ],
                                [/(pixel (c|tablet))\b/i],
                                [P, [y, ee], [v, k]],
                                [/droid.+; (pixel[\daxl ]{0,6})(?: bui|\))/i],
                                [P, [y, ee], [v, T]],
                                [
                                    /droid.+; (a?\d[0-2]{2}so|[c-g]\d{4}|so[-gl]\w+|xq-a\w[4-7][12])(?= bui|\).+chrome\/(?![1-6]{0,1}\d\.))/i,
                                ],
                                [P, [y, he], [v, T]],
                                [/sony tablet [ps]/i, /\b(?:sony)?sgp\w+(?: bui|\))/i],
                                [
                                    [P, 'Xperia Tablet'],
                                    [y, he],
                                    [v, k],
                                ],
                                [/ (kb2005|in20[12]5|be20[12][59])\b/i, /(?:one)?(?:plus)? (a\d0\d\d)(?: b|\))/i],
                                [P, [y, ce], [v, T]],
                                [
                                    /(alexa)webm/i,
                                    /(kf[a-z]{2}wi|aeo(?!bc)\w\w)( bui|\))/i,
                                    /(kf[a-z]+)( bui|\)).+silk\//i,
                                ],
                                [P, [y, Y], [v, k]],
                                [/((?:sd|kf)[0349hijorstuw]+)( bui|\)).+silk\//i],
                                [
                                    [P, /(.+)/g, 'Fire Phone $1'],
                                    [y, Y],
                                    [v, T],
                                ],
                                [/(playbook);[-\w\),; ]+(rim)/i],
                                [P, y, [v, k]],
                                [/\b((?:bb[a-f]|st[hv])100-\d)/i, /\(bb10; (\w+)/i],
                                [P, [y, X], [v, T]],
                                [/(?:\b|asus_)(transfo[prime ]{4,10} \w+|eeepc|slider \w+|nexus 7|padfone|p00[cj])/i],
                                [P, [y, J], [v, k]],
                                [/ (z[bes]6[027][012][km][ls]|zenfone \d\w?)\b/i],
                                [P, [y, J], [v, T]],
                                [/(nexus 9)/i],
                                [P, [y, 'HTC'], [v, k]],
                                [
                                    /(htc)[-;_ ]{1,2}([\w ]+(?=\)| bui)|\w+)/i,
                                    /(zte)[- ]([\w ]+?)(?: bui|\/|\))/i,
                                    /(alcatel|geeksphone|nexian|panasonic(?!(?:;|\.))|sony(?!-bra))[-_ ]?([-\w]*)/i,
                                ],
                                [y, [P, /_/g, ' '], [v, T]],
                                [
                                    /tcl (xess p17aa)/i,
                                    /droid [\w\.]+; ((?:8[14]9[16]|9(?:0(?:48|60|8[01])|1(?:3[27]|66)|2(?:6[69]|9[56])|466))[gqswx])(_\w(\w|\w\w))?(\)| bui)/i,
                                ],
                                [P, [y, 'TCL'], [v, k]],
                                [
                                    /droid [\w\.]+; (418(?:7d|8v)|5087z|5102l|61(?:02[dh]|25[adfh]|27[ai]|56[dh]|59k|65[ah])|a509dl|t(?:43(?:0w|1[adepqu])|50(?:6d|7[adju])|6(?:09dl|10k|12b|71[efho]|76[hjk])|7(?:66[ahju]|67[hw]|7[045][bh]|71[hk]|73o|76[ho]|79w|81[hks]?|82h|90[bhsy]|99b)|810[hs]))(_\w(\w|\w\w))?(\)| bui)/i,
                                ],
                                [P, [y, 'TCL'], [v, T]],
                                [/(itel) ((\w+))/i],
                                [[y, Me], P, [v, ze, { tablet: ['p10001l', 'w7001'], '*': 'mobile' }]],
                                [/droid.+; ([ab][1-7]-?[0178a]\d\d?)/i],
                                [P, [y, 'Acer'], [v, k]],
                                [/droid.+; (m[1-5] note) bui/i, /\bmz-([-\w]{2,})/i],
                                [P, [y, 'Meizu'], [v, T]],
                                [/; ((?:power )?armor(?:[\w ]{0,8}))(?: bui|\))/i],
                                [P, [y, 'Ulefone'], [v, T]],
                                [/; (energy ?\w+)(?: bui|\))/i, /; energizer ([\w ]+)(?: bui|\))/i],
                                [P, [y, 'Energizer'], [v, T]],
                                [/; cat (b35);/i, /; (b15q?|s22 flip|s48c|s62 pro)(?: bui|\))/i],
                                [P, [y, 'Cat'], [v, T]],
                                [/((?:new )?andromax[\w- ]+)(?: bui|\))/i],
                                [P, [y, 'Smartfren'], [v, T]],
                                [/droid.+; (a(?:015|06[35]|142p?))/i],
                                [P, [y, 'Nothing'], [v, T]],
                                [
                                    /; (x67 5g|tikeasy \w+|ac[1789]\d\w+)( b|\))/i,
                                    /archos ?(5|gamepad2?|([\w ]*[t1789]|hello) ?\d+[\w ]*)( b|\))/i,
                                ],
                                [P, [y, 'Archos'], [v, k]],
                                [/archos ([\w ]+)( b|\))/i, /; (ac[3-6]\d\w{2,8})( b|\))/i],
                                [P, [y, 'Archos'], [v, T]],
                                [/(imo) (tab \w+)/i, /(infinix) (x1101b?)/i],
                                [y, P, [v, k]],
                                [
                                    /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus(?! zenw)|dell|jolla|meizu|motorola|polytron|infinix|tecno|micromax|advan)[-_ ]?([-\w]*)/i,
                                    /; (blu|hmd|imo|tcl)[_ ]([\w\+ ]+?)(?: bui|\)|; r)/i,
                                    /(hp) ([\w ]+\w)/i,
                                    /(microsoft); (lumia[\w ]+)/i,
                                    /(lenovo)[-_ ]?([-\w ]+?)(?: bui|\)|\/)/i,
                                    /(oppo) ?([\w ]+) bui/i,
                                ],
                                [y, P, [v, T]],
                                [
                                    /(kobo)\s(ereader|touch)/i,
                                    /(hp).+(touchpad(?!.+tablet)|tablet)/i,
                                    /(kindle)\/([\w\.]+)/i,
                                ],
                                [y, P, [v, k]],
                                [/(surface duo)/i],
                                [P, [y, ae], [v, k]],
                                [/droid [\d\.]+; (fp\du?)(?: b|\))/i],
                                [P, [y, 'Fairphone'], [v, T]],
                                [/((?:tegranote|shield t(?!.+d tv))[\w- ]*?)(?: b|\))/i],
                                [P, [y, oe], [v, k]],
                                [/(sprint) (\w+)/i],
                                [y, P, [v, T]],
                                [/(kin\.[onetw]{3})/i],
                                [
                                    [P, /\./g, ' '],
                                    [y, ae],
                                    [v, T],
                                ],
                                [/droid.+; ([c6]+|et5[16]|mc[239][23]x?|vc8[03]x?)\)/i],
                                [P, [y, ue], [v, k]],
                                [/droid.+; (ec30|ps20|tc[2-8]\d[kx])\)/i],
                                [P, [y, ue], [v, T]],
                                [/smart-tv.+(samsung)/i],
                                [y, [v, x]],
                                [/hbbtv.+maple;(\d+)/i],
                                [
                                    [P, /^/, 'SmartTV'],
                                    [y, pe],
                                    [v, x],
                                ],
                                [/tcast.+(lg)e?. ([-\w]+)/i],
                                [y, P, [v, x]],
                                [/(nux; netcast.+smarttv|lg (netcast\.tv-201\d|android tv))/i],
                                [
                                    [y, ie],
                                    [v, x],
                                ],
                                [/(apple) ?tv/i],
                                [y, [P, Z + ' TV'], [v, x]],
                                [/crkey.*devicetype\/chromecast/i],
                                [
                                    [P, _e + ' Third Generation'],
                                    [y, ee],
                                    [v, x],
                                ],
                                [/crkey.*devicetype\/([^/]*)/i],
                                [
                                    [P, /^/, 'Chromecast '],
                                    [y, ee],
                                    [v, x],
                                ],
                                [/fuchsia.*crkey/i],
                                [
                                    [P, _e + ' Nest Hub'],
                                    [y, ee],
                                    [v, x],
                                ],
                                [/crkey/i],
                                [
                                    [P, _e],
                                    [y, ee],
                                    [v, x],
                                ],
                                [/(portaltv)/i],
                                [P, [y, ve], [v, x]],
                                [/droid.+aft(\w+)( bui|\))/i],
                                [P, [y, Y], [v, x]],
                                [/(shield \w+ tv)/i],
                                [P, [y, oe], [v, x]],
                                [/\(dtv[\);].+(aquos)/i, /(aquos-tv[\w ]+)\)/i],
                                [P, [y, le], [v, x]],
                                [/(bravia[\w ]+)( bui|\))/i],
                                [P, [y, he], [v, x]],
                                [/(mi(tv|box)-?\w+) bui/i],
                                [P, [y, me], [v, x]],
                                [/Hbbtv.*(technisat) (.*);/i],
                                [y, P, [v, x]],
                                [
                                    /\b(roku)[\dx]*[\)\/]((?:dvp-)?[\d\.]*)/i,
                                    /hbbtv\/\d+\.\d+\.\d+ +\([\w\+ ]*; *([\w\d][^;]*);([^;]*)/i,
                                ],
                                [
                                    [y, Ne],
                                    [P, Ne],
                                    [v, x],
                                ],
                                [/droid.+; ([\w- ]+) (?:android tv|smart[- ]?tv)/i],
                                [P, [v, x]],
                                [/\b(android tv|smart[- ]?tv|opera tv|tv; rv:)\b/i],
                                [[v, x]],
                                [/(ouya)/i, /(nintendo) (\w+)/i],
                                [y, P, [v, D]],
                                [/droid.+; (shield)( bui|\))/i],
                                [P, [y, oe], [v, D]],
                                [/(playstation \w+)/i],
                                [P, [y, he], [v, D]],
                                [/\b(xbox(?: one)?(?!; xbox))[\); ]/i],
                                [P, [y, ae], [v, D]],
                                [/\b(sm-[lr]\d\d[0156][fnuw]?s?|gear live)\b/i],
                                [P, [y, pe], [v, E]],
                                [/((pebble))app/i, /(asus|google|lg|oppo) ((pixel |zen)?watch[\w ]*)( bui|\))/i],
                                [y, P, [v, E]],
                                [/(ow(?:19|20)?we?[1-3]{1,3})/i],
                                [P, [y, de], [v, E]],
                                [/(watch)(?: ?os[,\/]|\d,\d\/)[\d\.]+/i],
                                [P, [y, Z], [v, E]],
                                [/(opwwe\d{3})/i],
                                [P, [y, ce], [v, E]],
                                [/(moto 360)/i],
                                [P, [y, ne], [v, E]],
                                [/(smartwatch 3)/i],
                                [P, [y, he], [v, E]],
                                [/(g watch r)/i],
                                [P, [y, ie], [v, E]],
                                [/droid.+; (wt63?0{2,3})\)/i],
                                [P, [y, ue], [v, E]],
                                [/droid.+; (glass) \d/i],
                                [P, [y, ee], [v, L]],
                                [/(pico) (4|neo3(?: link|pro)?)/i],
                                [y, P, [v, L]],
                                [/(quest( \d| pro)?s?).+vr/i],
                                [P, [y, ve], [v, L]],
                                [/(tesla)(?: qtcarbrowser|\/[-\w\.]+)/i],
                                [y, [v, I]],
                                [/(aeobc)\b/i],
                                [P, [y, Y], [v, I]],
                                [/(homepod).+mac os/i],
                                [P, [y, Z], [v, I]],
                                [/windows iot/i],
                                [[v, I]],
                                [/droid .+?; ([^;]+?)(?: bui|; wv\)|\) applew).+?(mobile|vr|\d) safari/i],
                                [P, [v, ze, { mobile: 'Mobile', xr: 'VR', '*': k }]],
                                [/\b((tablet|tab)[;\/]|focus\/\d(?!.+mobile))/i],
                                [[v, k]],
                                [/(phone|mobile(?:[;\/]| [ \w\/\.]*safari)|pda(?=.+windows ce))/i],
                                [[v, T]],
                                [/droid .+?; ([\w\. -]+)( bui|\))/i],
                                [P, [y, 'Generic']],
                            ],
                            engine: [
                                [/windows.+ edge\/([\w\.]+)/i],
                                [S, [b, 'EdgeHTML']],
                                [/(arkweb)\/([\w\.]+)/i],
                                [b, S],
                                [/webkit\/537\.36.+chrome\/(?!27)([\w\.]+)/i],
                                [S, [b, 'Blink']],
                                [
                                    /(presto)\/([\w\.]+)/i,
                                    /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna|servo)\/([\w\.]+)/i,
                                    /ekioh(flow)\/([\w\.]+)/i,
                                    /(khtml|tasman|links)[\/ ]\(?([\w\.]+)/i,
                                    /(icab)[\/ ]([23]\.[\d\.]+)/i,
                                    /\b(libweb)/i,
                                ],
                                [b, S],
                                [/ladybird\//i],
                                [[b, 'LibWeb']],
                                [/rv\:([\w\.]{1,9})\b.+(gecko)/i],
                                [S, b],
                            ],
                            os: [
                                [/microsoft (windows) (vista|xp)/i],
                                [b, S],
                                [/(windows (?:phone(?: os)?|mobile|iot))[\/ ]?([\d\.\w ]*)/i],
                                [b, [S, ze, $e]],
                                [
                                    /windows nt 6\.2; (arm)/i,
                                    /windows[\/ ]([ntce\d\. ]+\w)(?!.+xbox)/i,
                                    /(?:win(?=3|9|n)|win 9x )([nt\d\.]+)/i,
                                ],
                                [
                                    [S, ze, $e],
                                    [b, Ce],
                                ],
                                [
                                    /[adehimnop]{4,7}\b(?:.*os ([\w]+) like mac|; opera)/i,
                                    /(?:ios;fbsv\/|iphone.+ios[\/ ])([\d\.]+)/i,
                                    /cfnetwork\/.+darwin/i,
                                ],
                                [
                                    [S, /_/g, '.'],
                                    [b, 'iOS'],
                                ],
                                [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i],
                                [
                                    [b, 'macOS'],
                                    [S, /_/g, '.'],
                                ],
                                [/android ([\d\.]+).*crkey/i],
                                [S, [b, _e + ' Android']],
                                [/fuchsia.*crkey\/([\d\.]+)/i],
                                [S, [b, _e + ' Fuchsia']],
                                [/crkey\/([\d\.]+).*devicetype\/smartspeaker/i],
                                [S, [b, _e + ' SmartSpeaker']],
                                [/linux.*crkey\/([\d\.]+)/i],
                                [S, [b, _e + ' Linux']],
                                [/crkey\/([\d\.]+)/i],
                                [S, [b, _e]],
                                [/droid ([\w\.]+)\b.+(android[- ]x86|harmonyos)/i],
                                [S, b],
                                [/(ubuntu) ([\w\.]+) like android/i],
                                [[b, /(.+)/, '$1 Touch'], S],
                                [
                                    /(android|bada|blackberry|kaios|maemo|meego|openharmony|qnx|rim tablet os|sailfish|series40|symbian|tizen|webos)\w*[-\/\.; ]?([\d\.]*)/i,
                                ],
                                [b, S],
                                [/\(bb(10);/i],
                                [S, [b, X]],
                                [/(?:symbian ?os|symbos|s60(?=;)|series ?60)[-\/ ]?([\w\.]*)/i],
                                [S, [b, 'Symbian']],
                                [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i],
                                [S, [b, we + ' OS']],
                                [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i],
                                [S, [b, 'webOS']],
                                [/watch(?: ?os[,\/]|\d,\d\/)([\d\.]+)/i],
                                [S, [b, 'watchOS']],
                                [/(cros) [\w]+(?:\)| ([\w\.]+)\b)/i],
                                [[b, 'Chrome OS'], S],
                                [
                                    /panasonic;(viera)/i,
                                    /(netrange)mmh/i,
                                    /(nettv)\/(\d+\.[\w\.]+)/i,
                                    /(nintendo|playstation) (\w+)/i,
                                    /(xbox); +xbox ([^\);]+)/i,
                                    /(pico) .+os([\w\.]+)/i,
                                    /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i,
                                    /(mint)[\/\(\) ]?(\w*)/i,
                                    /(mageia|vectorlinux)[; ]/i,
                                    /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i,
                                    /(hurd|linux)(?: arm\w*| x86\w*| ?)([\w\.]*)/i,
                                    /(gnu) ?([\w\.]*)/i,
                                    /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i,
                                    /(haiku) (\w+)/i,
                                ],
                                [b, S],
                                [/(sunos) ?([\w\.\d]*)/i],
                                [[b, 'Solaris'], S],
                                [
                                    /((?:open)?solaris)[-\/ ]?([\w\.]*)/i,
                                    /(aix) ((\d)(?=\.|\)| )[\w\.])*/i,
                                    /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux|serenityos)/i,
                                    /(unix) ?([\w\.]*)/i,
                                ],
                                [b, S],
                            ],
                        },
                        He =
                            (je.call((n = { init: {}, isIgnore: {}, isIgnoreRgx: {}, toString: {} }).init, [
                                [m, [b, S, C, v]],
                                [u, [R]],
                                [f, [v, P, y]],
                                [g, [b, S]],
                                [_, [b, S]],
                            ]),
                            je.call(n.isIgnore, [
                                [m, [S, C]],
                                [g, [S]],
                                [_, [S]],
                            ]),
                            je.call(n.isIgnoreRgx, [
                                [m, / ?browser$/i],
                                [_, / ?os$/i],
                            ]),
                            je.call(n.toString, [
                                [m, [b, S]],
                                [u, [R]],
                                [f, [y, P]],
                                [g, [b, S]],
                                [_, [b, S]],
                            ]),
                            n),
                        Ge = function (e, t) {
                            var r = He.init[t],
                                s = He.isIgnore[t] || 0,
                                i = He.isIgnoreRgx[t] || 0,
                                a = He.toString[t] || 0;
                            function n() {
                                je.call(this, r);
                            }
                            return (
                                (n.prototype.getItem = function () {
                                    return e;
                                }),
                                (n.prototype.withClientHints = function () {
                                    return Te
                                        ? Te.getHighEntropyValues(W).then(function (t) {
                                              return e.setCH(new qe(t, !1)).parseCH().get();
                                          })
                                        : e.parseCH().get();
                                }),
                                (n.prototype.withFeatureCheck = function () {
                                    return e.detectFeature().get();
                                }),
                                t != w &&
                                    ((n.prototype.is = function (e) {
                                        var t = !1;
                                        for (var r in this)
                                            if (
                                                this.hasOwnProperty(r) &&
                                                !xe(s, r) &&
                                                Me(i ? Fe(i, this[r]) : this[r]) == Me(i ? Fe(i, e) : e)
                                            ) {
                                                if (((t = !0), e != p)) break;
                                            } else if (e == p && t) {
                                                t = !t;
                                                break;
                                            }
                                        return t;
                                    }),
                                    (n.prototype.toString = function () {
                                        var e = c;
                                        for (var t in a) typeof this[a[t]] !== p && (e += (e ? ' ' : c) + this[a[t]]);
                                        return e || p;
                                    })),
                                Te ||
                                    (n.prototype.then = function (e) {
                                        var t = this,
                                            r = function () {
                                                for (var e in t) t.hasOwnProperty(e) && (this[e] = t[e]);
                                            };
                                        r.prototype = { is: n.prototype.is, toString: n.prototype.toString };
                                        var s = new r();
                                        return e(s), s;
                                    }),
                                new n()
                            );
                        };
                    function qe(e, t) {
                        if (((e = e || {}), je.call(this, W), t))
                            je.call(this, [
                                [O, Ie(e[z])],
                                [F, Ie(e[$])],
                                [T, /\?1/.test(e[G])],
                                [P, Ae(e[q])],
                                [A, Ae(e[V])],
                                [N, Ae(e[Q])],
                                [R, Ae(e[U])],
                                [j, Ie(e[H])],
                                [B, Ae(e[K])],
                            ]);
                        else for (var r in e) this.hasOwnProperty(r) && typeof e[r] !== p && (this[r] = e[r]);
                    }
                    function Ve(e, t, r, s) {
                        return (
                            (this.get = function (e) {
                                return e ? (this.data.hasOwnProperty(e) ? this.data[e] : a) : this.data;
                            }),
                            (this.set = function (e, t) {
                                return (this.data[e] = t), this;
                            }),
                            (this.setCH = function (e) {
                                return (this.uaCH = e), this;
                            }),
                            (this.detectFeature = function () {
                                if (De && De.userAgent == this.ua)
                                    switch (this.itemType) {
                                        case m:
                                            De.brave && typeof De.brave.isBrave == d && this.set(b, 'Brave');
                                            break;
                                        case f:
                                            !this.get(v) && Te && Te[T] && this.set(v, T),
                                                'Macintosh' == this.get(P) &&
                                                    De &&
                                                    typeof De.standalone !== p &&
                                                    De.maxTouchPoints &&
                                                    De.maxTouchPoints > 2 &&
                                                    this.set(P, 'iPad').set(v, k);
                                            break;
                                        case _:
                                            !this.get(b) && Te && Te[A] && this.set(b, Te[A]);
                                            break;
                                        case w:
                                            var e = this.data,
                                                t = function (t) {
                                                    return e[t].getItem().detectFeature().get();
                                                };
                                            this.set(m, t(m)).set(u, t(u)).set(f, t(f)).set(g, t(g)).set(_, t(_));
                                    }
                                return this;
                            }),
                            (this.parseUA = function () {
                                return (
                                    this.itemType != w && Be.call(this.data, this.ua, this.rgxMap),
                                    this.itemType == m && this.set(C, Oe(this.get(S))),
                                    this
                                );
                            }),
                            (this.parseCH = function () {
                                var e = this.uaCH,
                                    t = this.rgxMap;
                                switch (this.itemType) {
                                    case m:
                                    case g:
                                        var r,
                                            s = e[F] || e[O];
                                        if (s)
                                            for (var i in s) {
                                                var n = s[i].brand || s[i],
                                                    o = s[i].version;
                                                this.itemType != m ||
                                                    /not.a.brand/i.test(n) ||
                                                    (r && (!/chrom/i.test(r) || n == ge)) ||
                                                    ((n = ze(n, {
                                                        Chrome: 'Google Chrome',
                                                        Edge: 'Microsoft Edge',
                                                        'Chrome WebView': 'Android WebView',
                                                        'Chrome Headless': 'HeadlessChrome',
                                                        'Huawei Browser': 'HuaweiBrowser',
                                                        'MIUI Browser': 'Miui Browser',
                                                        'Opera Mobi': 'OperaMobile',
                                                        Yandex: 'YaBrowser',
                                                    })),
                                                    this.set(b, n).set(S, o).set(C, Oe(o)),
                                                    (r = n)),
                                                    this.itemType == g && n == ge && this.set(S, o);
                                            }
                                        break;
                                    case u:
                                        var c = e[R];
                                        c && (c && '64' == e[B] && (c += '64'), Be.call(this.data, c + ';', t));
                                        break;
                                    case f:
                                        if (
                                            (e[T] && this.set(v, T),
                                            e[P] && (this.set(P, e[P]), !this.get(v) || !this.get(y)))
                                        ) {
                                            var d = {};
                                            Be.call(d, 'droid 9; ' + e[P] + ')', t),
                                                !this.get(v) && d.type && this.set(v, d.type),
                                                !this.get(y) && d.vendor && this.set(y, d.vendor);
                                        }
                                        if (e[j]) {
                                            var p;
                                            if ('string' != typeof e[j])
                                                for (var l = 0; !p && l < e[j].length; ) p = ze(e[j][l++], Ue);
                                            else p = ze(e[j], Ue);
                                            this.set(v, p);
                                        }
                                        break;
                                    case _:
                                        var h = e[A];
                                        if (h) {
                                            var D = e[N];
                                            h == Ce && (D = parseInt(Oe(D), 10) >= 13 ? '11' : '10'),
                                                this.set(b, h).set(S, D);
                                        }
                                        this.get(b) == Ce && 'Xbox' == e[P] && this.set(b, 'Xbox').set(S, a);
                                        break;
                                    case w:
                                        var k = this.data,
                                            x = function (t) {
                                                return k[t].getItem().setCH(e).parseCH().get();
                                            };
                                        this.set(m, x(m)).set(u, x(u)).set(f, x(f)).set(g, x(g)).set(_, x(_));
                                }
                                return this;
                            }),
                            je.call(this, [
                                ['itemType', e],
                                ['ua', t],
                                ['uaCH', s],
                                ['rgxMap', r],
                                ['data', Ge(this, e)],
                            ]),
                            this
                        );
                    }
                    function Qe(e, t, r) {
                        if (
                            (typeof e === l
                                ? (Ee(e, !0) ? (typeof t === l && (r = t), (t = e)) : ((r = e), (t = a)), (e = a))
                                : typeof e !== h || Ee(t, !0) || ((r = t), (t = a)),
                            r && typeof r.append === d)
                        ) {
                            var s = {};
                            r.forEach(function (e, t) {
                                s[t] = e;
                            }),
                                (r = s);
                        }
                        if (!(this instanceof Qe)) return new Qe(e, t, r).getResult();
                        var i = typeof e === h ? e : r && r[o] ? r[o] : De && De.userAgent ? De.userAgent : c,
                            n = new qe(r, !0),
                            p = t
                                ? (function (e, t) {
                                      var r = {},
                                          s = t;
                                      if (!Ee(t))
                                          for (var i in ((s = {}), t))
                                              for (var a in t[i]) s[a] = t[i][a].concat(s[a] ? s[a] : []);
                                      for (var n in e) r[n] = s[n] && s[n].length % 2 == 0 ? s[n].concat(e[n]) : e[n];
                                      return r;
                                  })(Ke, t)
                                : Ke,
                            b = function (e) {
                                return e == w
                                    ? function () {
                                          return new Ve(e, i, p, n)
                                              .set('ua', i)
                                              .set(m, this.getBrowser())
                                              .set(u, this.getCPU())
                                              .set(f, this.getDevice())
                                              .set(g, this.getEngine())
                                              .set(_, this.getOS())
                                              .get();
                                      }
                                    : function () {
                                          return new Ve(e, i, p[e], n).parseUA().get();
                                      };
                            };
                        return (
                            je
                                .call(this, [
                                    ['getBrowser', b(m)],
                                    ['getCPU', b(u)],
                                    ['getDevice', b(f)],
                                    ['getEngine', b(g)],
                                    ['getOS', b(_)],
                                    ['getResult', b(w)],
                                    [
                                        'getUA',
                                        function () {
                                            return i;
                                        },
                                    ],
                                    [
                                        'setUA',
                                        function (e) {
                                            return Le(e) && (i = e.length > 500 ? Ne(e, 500) : e), this;
                                        },
                                    ],
                                ])
                                .setUA(i),
                            this
                        );
                    }
                    (Qe.VERSION = '2.0.3'),
                        (Qe.BROWSER = ke([b, S, C, v])),
                        (Qe.CPU = ke([R])),
                        (Qe.DEVICE = ke([P, y, v, D, T, x, k, E, I])),
                        (Qe.ENGINE = Qe.OS = ke([b, S])),
                        typeof t !== p
                            ? (e.exports && (t = e.exports = Qe), (t.UAParser = Qe))
                            : r.amdO
                              ? (s = function () {
                                    return Qe;
                                }.call(t, r, t, e)) === a || (e.exports = s)
                              : Pe && (i.UAParser = Qe);
                    var We = Pe && (i.jQuery || i.Zepto);
                    if (We && !We.ua) {
                        var Ye = new Qe();
                        (We.ua = Ye.getResult()),
                            (We.ua.get = function () {
                                return Ye.getUA();
                            }),
                            (We.ua.set = function (e) {
                                Ye.setUA(e);
                                var t = Ye.getResult();
                                for (var r in t) We.ua[r] = t[r];
                            });
                    }
                })('object' == typeof window ? window : this);
            },
            2183: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Chrome111 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(5938),
                    d = r(4256),
                    p = r(4893),
                    l = r(521),
                    h = r(1305),
                    m = r(3303),
                    u = new i.Logger('Chrome111'),
                    f = { OS: 1024, MIS: 1024 };
                class g extends l.HandlerInterface {
                    _closed = !1;
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new g();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Chrome111';
                    }
                    close() {
                        if ((u.debug('close()'), !this._closed)) {
                            if (((this._closed = !0), this._pc))
                                try {
                                    this._pc.close();
                                } catch (e) {}
                            this.emit('@close');
                        }
                    }
                    async getNativeRtpCapabilities() {
                        u.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'unified-plan',
                        });
                        try {
                            e.addTransceiver('audio'), e.addTransceiver('video');
                            const t = await e.createOffer();
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp),
                                i = o.extractRtpCapabilities({ sdpObject: r });
                            return d.addNackSupportForOpus(i), i;
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return u.debug('getNativeSctpCapabilities()'), { numStreams: f };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        this.assertNotClosed(),
                            u.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new h.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', p),
                                video: n.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', p),
                                video: n.getSendingRemoteRtpParameters('video', p),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'unified-plan',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : (u.warn('run() | pc.connectionState not supported, using pc.iceConnectionState'),
                                  this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (this._pc.iceConnectionState) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  }));
                    }
                    async updateIceServers(e) {
                        this.assertNotClosed(), u.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if (
                            (this.assertNotClosed(),
                            u.debug('restartIce()'),
                            this._remoteSdp.updateIceParameters(e),
                            this._transportReady)
                        )
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                u.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                u.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i, onRtpSender: d }) {
                        if (
                            (this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            t && t.length > 1)
                        ) {
                            let e = 1;
                            for (const r of t) {
                                const t = r.scalabilityMode ? (0, m.parse)(r.scalabilityMode).temporalLayers : 3;
                                t > e && (e = t);
                            }
                            t.forEach((t, r) => {
                                (t.rid = `r${r}`), (t.scalabilityMode = `L1T${e}`);
                            });
                        }
                        const p = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        p.codecs = n.reduceCodecs(p.codecs, i);
                        const l = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        l.codecs = n.reduceCodecs(l.codecs, i);
                        const h = this._remoteSdp.getNextMediaSectionIdx(),
                            f = this._pc.addTransceiver(e, {
                                direction: 'sendonly',
                                streams: [this._sendStream],
                                sendEncodings: t,
                            });
                        d && d(f.sender);
                        const g = await this._pc.createOffer();
                        let _ = s.parse(g.sdp);
                        _.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: _,
                                })),
                            u.debug('send() | calling pc.setLocalDescription() [offer:%o]', g),
                            await this._pc.setLocalDescription(g);
                        const w = f.mid;
                        (p.mid = w), (_ = s.parse(this._pc.localDescription.sdp));
                        const b = _.media[h.idx];
                        if (((p.rtcp.cname = o.getCname({ offerMediaObject: b })), t))
                            if (1 === t.length) {
                                const e = c.getRtpEncodings({ offerMediaObject: b });
                                Object.assign(e[0], t[0]), (p.encodings = e);
                            } else p.encodings = t;
                        else p.encodings = c.getRtpEncodings({ offerMediaObject: b });
                        this._remoteSdp.send({
                            offerMediaObject: b,
                            reuseMid: h.reuseMid,
                            offerRtpParameters: p,
                            answerRtpParameters: l,
                            codecOptions: r,
                        });
                        const v = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            u.debug('send() | calling pc.setRemoteDescription() [answer:%o]', v),
                            await this._pc.setRemoteDescription(v),
                            this._mapMidTransceiver.set(w, f),
                            { localId: w, rtpParameters: p, rtpSender: f.sender }
                        );
                    }
                    async stopSending(e) {
                        if ((this.assertSendDirection(), u.debug('stopSending() [localId:%s]', e), this._closed))
                            return;
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        if (
                            (t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.closeMediaSection(t.mid))
                        )
                            try {
                                t.stop();
                            } catch (e) {}
                        const r = await this._pc.createOffer();
                        u.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('pauseSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'inactive'), this._remoteSdp.pauseMediaSection(e);
                        const r = await this._pc.createOffer();
                        u.debug('pauseSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async resumeSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('resumeSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if ((this._remoteSdp.resumeSendingMediaSection(e), !t))
                            throw new Error('associated RTCRtpTransceiver not found');
                        t.direction = 'sendonly';
                        const r = await this._pc.createOffer();
                        u.debug('resumeSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            t
                                ? u.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : u.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        u.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % f.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                u.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            u.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            u.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        for (const t of e) {
                            const { trackId: e, onRtpReceiver: s } = t;
                            if (s) {
                                const t = r.get(e),
                                    i = this._pc.getTransceivers().find((e) => e.mid === t);
                                if (!i) throw new Error('transceiver not found');
                                s(i.receiver);
                            }
                        }
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: s } = t,
                                i = r.get(e),
                                a = n.media.find((e) => String(e.mid) === i);
                            o.applyCodecParameters({ offerRtpParameters: s, answerMediaObject: a });
                        }
                        (a = { type: 'answer', sdp: s.write(n) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: n,
                                })),
                            u.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if ((this.assertRecvDirection(), this._closed)) return;
                        for (const t of e) {
                            u.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('pauseReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'inactive'), this._remoteSdp.pauseMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('pauseReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('resumeReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'recvonly'), this._remoteSdp.resumeReceivingMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('resumeReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        u.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new p.InvalidStateError('method called in a closed handler');
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Chrome111 = g;
            },
            2292: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Firefox120 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(4893),
                    n = r(1765),
                    o = r(8046),
                    c = r(5544),
                    d = r(5938),
                    p = r(521),
                    l = r(1305),
                    h = r(3303),
                    m = new i.Logger('Firefox120'),
                    u = { OS: 16, MIS: 2048 };
                class f extends p.HandlerInterface {
                    _closed = !1;
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new f();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Firefox120';
                    }
                    close() {
                        if ((m.debug('close()'), !this._closed)) {
                            if (((this._closed = !0), this._pc))
                                try {
                                    this._pc.close();
                                } catch (e) {}
                            this.emit('@close');
                        }
                    }
                    async getNativeRtpCapabilities() {
                        m.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                                iceServers: [],
                                iceTransportPolicy: 'all',
                                bundlePolicy: 'max-bundle',
                                rtcpMuxPolicy: 'require',
                            }),
                            t = document.createElement('canvas');
                        t.getContext('2d');
                        const r = t.captureStream().getVideoTracks()[0];
                        try {
                            e.addTransceiver('audio', { direction: 'sendrecv' }),
                                e.addTransceiver(r, {
                                    direction: 'sendrecv',
                                    sendEncodings: [
                                        { rid: 'r0', maxBitrate: 1e5 },
                                        { rid: 'r1', maxBitrate: 5e5 },
                                    ],
                                });
                            const i = await e.createOffer();
                            try {
                                t.remove();
                            } catch (e) {}
                            try {
                                r.stop();
                            } catch (e) {}
                            try {
                                e.close();
                            } catch (e) {}
                            const a = s.parse(i.sdp);
                            return c.extractRtpCapabilities({ sdpObject: a });
                        } catch (s) {
                            try {
                                t.remove();
                            } catch (e) {}
                            try {
                                r.stop();
                            } catch (e) {}
                            try {
                                e.close();
                            } catch (e) {}
                            throw s;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return m.debug('getNativeSctpCapabilities()'), { numStreams: u };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        this.assertNotClosed(),
                            m.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new l.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: o.getSendingRtpParameters('audio', p),
                                video: o.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: o.getSendingRemoteRtpParameters('audio', p),
                                video: o.getSendingRemoteRtpParameters('video', p),
                            }),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: n ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (m.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        throw (this.assertNotClosed(), new a.UnsupportedError('not supported'));
                    }
                    async restartIce(e) {
                        if (
                            (this.assertNotClosed(),
                            m.debug('restartIce()'),
                            this._remoteSdp.updateIceParameters(e),
                            this._transportReady)
                        )
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                m.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                m.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                m.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                m.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i, onRtpSender: a }) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            m.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            t &&
                                t.length > 1 &&
                                t.forEach((e, t) => {
                                    e.rid = `r${t}`;
                                });
                        const p = n.clone(this._sendingRtpParametersByKind[e.kind]);
                        p.codecs = o.reduceCodecs(p.codecs, i);
                        const l = n.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        l.codecs = o.reduceCodecs(l.codecs, i);
                        const u = this._pc.addTransceiver(e, {
                            direction: 'sendonly',
                            streams: [this._sendStream],
                            sendEncodings: t,
                        });
                        a && a(u.sender);
                        const f = await this._pc.createOffer();
                        let g = s.parse(f.sdp);
                        g.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({ localDtlsRole: 'client', localSdpObject: g }));
                        const _ = (0, h.parse)((t ?? [{}])[0].scalabilityMode);
                        m.debug('send() | calling pc.setLocalDescription() [offer:%o]', f),
                            await this._pc.setLocalDescription(f);
                        const w = u.mid;
                        (p.mid = w), (g = s.parse(this._pc.localDescription.sdp));
                        const b = g.media[g.media.length - 1];
                        if (((p.rtcp.cname = c.getCname({ offerMediaObject: b })), t))
                            if (1 === t.length) {
                                const e = d.getRtpEncodings({ offerMediaObject: b });
                                Object.assign(e[0], t[0]), (p.encodings = e);
                            } else p.encodings = t;
                        else p.encodings = d.getRtpEncodings({ offerMediaObject: b });
                        if (
                            p.encodings.length > 1 &&
                            ('video/vp8' === p.codecs[0].mimeType.toLowerCase() ||
                                'video/h264' === p.codecs[0].mimeType.toLowerCase())
                        )
                            for (const e of p.encodings)
                                e.scalabilityMode
                                    ? (e.scalabilityMode = `L1T${_.temporalLayers}`)
                                    : (e.scalabilityMode = 'L1T3');
                        this._remoteSdp.send({
                            offerMediaObject: b,
                            offerRtpParameters: p,
                            answerRtpParameters: l,
                            codecOptions: r,
                        });
                        const v = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            m.debug('send() | calling pc.setRemoteDescription() [answer:%o]', v),
                            await this._pc.setRemoteDescription(v),
                            this._mapMidTransceiver.set(w, u),
                            { localId: w, rtpParameters: p, rtpSender: u.sender }
                        );
                    }
                    async stopSending(e) {
                        if ((this.assertSendDirection(), m.debug('stopSending() [localId:%s]', e), this._closed))
                            return;
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated transceiver not found');
                        t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.disableMediaSection(t.mid);
                        const r = await this._pc.createOffer();
                        m.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), m.debug('pauseSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'inactive'), this._remoteSdp.pauseMediaSection(e);
                        const r = await this._pc.createOffer();
                        m.debug('pauseSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('pauseSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async resumeSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), m.debug('resumeSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'sendonly'), this._remoteSdp.resumeSendingMediaSection(e);
                        const r = await this._pc.createOffer();
                        m.debug('resumeSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('resumeSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            t
                                ? m.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : m.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            m.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated transceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        m.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            m.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        m.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        m.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        m.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % u.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({ localDtlsRole: 'client', localSdpObject: t })),
                                m.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            m.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            m.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        for (const t of e) {
                            const { trackId: e, onRtpReceiver: s } = t;
                            if (s) {
                                const t = r.get(e),
                                    i = this._pc.getTransceivers().find((e) => e.mid === t);
                                if (!i) throw new Error('transceiver not found');
                                s(i.receiver);
                            }
                        }
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: i } = t,
                                o = r.get(e),
                                d = n.media.find((e) => String(e.mid) === o);
                            c.applyCodecParameters({ offerRtpParameters: i, answerMediaObject: d }),
                                (a = { type: 'answer', sdp: s.write(n) });
                        }
                        this._transportReady ||
                            (await this.setupTransport({ localDtlsRole: 'client', localSdpObject: n })),
                            m.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if ((this.assertRecvDirection(), this._closed)) return;
                        for (const t of e) {
                            m.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        m.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            m.debug('pauseReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'inactive'), this._remoteSdp.pauseMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('pauseReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        m.debug('pauseReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            m.debug('resumeReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'recvonly'), this._remoteSdp.resumeReceivingMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        m.debug('resumeReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        m.debug('resumeReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        m.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            m.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({ localDtlsRole: 'client', localSdpObject: e });
                            }
                            m.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = c.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new a.InvalidStateError('method called in a closed handler');
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Firefox120 = f;
            },
            2731: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.FakeHandler = void 0);
                const s = r(5476),
                    i = r(3953),
                    a = r(2994),
                    n = r(1765),
                    o = r(8046),
                    c = r(4893),
                    d = r(521),
                    p = new a.Logger('FakeHandler');
                class l extends i.EnhancedEventEmitter {
                    id;
                    ordered;
                    maxPacketLifeTime;
                    maxRetransmits;
                    label;
                    protocol;
                    constructor({ id: e, ordered: t, maxPacketLifeTime: r, maxRetransmits: s, label: i, protocol: a }) {
                        super(),
                            (this.id = e),
                            (this.ordered = t),
                            (this.maxPacketLifeTime = r),
                            (this.maxRetransmits = s),
                            (this.label = i),
                            (this.protocol = a);
                    }
                    close() {
                        this.safeEmit('close'), this.emit('@close');
                    }
                    send(e) {
                        this.safeEmit('message', e);
                    }
                    addEventListener(e, t) {
                        this.on(e, t);
                    }
                }
                class h extends d.HandlerInterface {
                    _closed = !1;
                    fakeParameters;
                    _rtpParametersByKind;
                    _cname = `CNAME-${n.generateRandomNumber()}`;
                    _transportReady = !1;
                    _nextLocalId = 1;
                    _tracks = new Map();
                    _nextSctpStreamId = 0;
                    static createFactory(e) {
                        return () => new h(e);
                    }
                    constructor(e) {
                        super(), (this.fakeParameters = e);
                    }
                    get name() {
                        return 'FakeHandler';
                    }
                    close() {
                        p.debug('close()'), this._closed || (this._closed = !0);
                    }
                    setIceGatheringState(e) {
                        this.emit('@icegatheringstatechange', e);
                    }
                    setConnectionState(e) {
                        this.emit('@connectionstatechange', e);
                    }
                    async getNativeRtpCapabilities() {
                        return (
                            p.debug('getNativeRtpCapabilities()'), this.fakeParameters.generateNativeRtpCapabilities()
                        );
                    }
                    async getNativeSctpCapabilities() {
                        return (
                            p.debug('getNativeSctpCapabilities()'), this.fakeParameters.generateNativeSctpCapabilities()
                        );
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        proprietaryConstraints: c,
                        extendedRtpCapabilities: d,
                    }) {
                        this.assertNotClosed(),
                            p.debug('run()'),
                            (this._rtpParametersByKind = {
                                audio: o.getSendingRtpParameters('audio', d),
                                video: o.getSendingRtpParameters('video', d),
                            });
                    }
                    async updateIceServers(e) {
                        this.assertNotClosed(), p.debug('updateIceServers()');
                    }
                    async restartIce(e) {
                        this.assertNotClosed(), p.debug('restartIce()');
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), new Map();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: s }) {
                        this.assertNotClosed(),
                            p.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            this._transportReady || (await this.setupTransport({ localDtlsRole: 'server' }));
                        const i = n.clone(this._rtpParametersByKind[e.kind]),
                            a = i.codecs.some((e) => /.+\/rtx$/i.test(e.mimeType));
                        (i.mid = `mid-${n.generateRandomNumber()}`), t || (t = [{}]);
                        for (const e of t)
                            (e.ssrc = n.generateRandomNumber()), a && (e.rtx = { ssrc: n.generateRandomNumber() });
                        (i.encodings = t), (i.rtcp = { cname: this._cname, reducedSize: !0, mux: !0 });
                        const o = this._nextLocalId++;
                        return this._tracks.set(o, e), { localId: String(o), rtpParameters: i };
                    }
                    async stopSending(e) {
                        if ((p.debug('stopSending() [localId:%s]', e), !this._closed)) {
                            if (!this._tracks.has(Number(e))) throw new Error('local track not found');
                            this._tracks.delete(Number(e));
                        }
                    }
                    async pauseSending(e) {
                        this.assertNotClosed();
                    }
                    async resumeSending(e) {
                        this.assertNotClosed();
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            t
                                ? p.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : p.debug('replaceTrack() [localId:%s, no track]', e),
                            this._tracks.delete(Number(e)),
                            this._tracks.set(Number(e), t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(), p.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(), p.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                    }
                    async getSenderStats(e) {
                        return this.assertNotClosed(), new Map();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: s,
                        protocol: i,
                    }) {
                        return (
                            this.assertNotClosed(),
                            this._transportReady || (await this.setupTransport({ localDtlsRole: 'server' })),
                            p.debug('sendDataChannel()'),
                            {
                                dataChannel: new l({
                                    id: this._nextSctpStreamId++,
                                    ordered: e,
                                    maxPacketLifeTime: t,
                                    maxRetransmits: r,
                                    label: s,
                                    protocol: i,
                                }),
                                sctpStreamParameters: {
                                    streamId: this._nextSctpStreamId,
                                    ordered: e,
                                    maxPacketLifeTime: t,
                                    maxRetransmits: r,
                                },
                            }
                        );
                    }
                    async receive(e) {
                        this.assertNotClosed();
                        const t = [];
                        for (const r of e) {
                            const { trackId: e, kind: i } = r;
                            this._transportReady || (await this.setupTransport({ localDtlsRole: 'client' })),
                                p.debug('receive() [trackId:%s, kind:%s]', e, i);
                            const a = this._nextLocalId++,
                                n = new s.FakeMediaStreamTrack({ kind: i });
                            this._tracks.set(a, n), t.push({ localId: String(a), track: n });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if (!this._closed)
                            for (const t of e)
                                p.debug('stopReceiving() [localId:%s]', t), this._tracks.delete(Number(t));
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed();
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed();
                    }
                    async getReceiverStats(e) {
                        return this.assertNotClosed(), new Map();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        return (
                            this.assertNotClosed(),
                            this._transportReady || (await this.setupTransport({ localDtlsRole: 'client' })),
                            p.debug('receiveDataChannel()'),
                            {
                                dataChannel: new l({
                                    id: e.streamId,
                                    ordered: e.ordered,
                                    maxPacketLifeTime: e.maxPacketLifeTime,
                                    maxRetransmits: e.maxRetransmits,
                                    label: t,
                                    protocol: r,
                                }),
                            }
                        );
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        const r = n.clone(this.fakeParameters.generateLocalDtlsParameters());
                        e && (r.role = e),
                            this.emit('@connectionstatechange', 'connecting'),
                            await new Promise((e, t) => this.emit('@connect', { dtlsParameters: r }, e, t)),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new c.InvalidStateError('method called in a closed handler');
                    }
                }
                t.FakeHandler = h;
            },
            2994: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Logger = void 0);
                const s = r(4646),
                    i = 'mediasoup-client';
                t.Logger = class {
                    _debug;
                    _warn;
                    _error;
                    constructor(e) {
                        e
                            ? ((this._debug = (0, s.default)(`${i}:${e}`)),
                              (this._warn = (0, s.default)(`${i}:WARN:${e}`)),
                              (this._error = (0, s.default)(`${i}:ERROR:${e}`)))
                            : ((this._debug = (0, s.default)(i)),
                              (this._warn = (0, s.default)(`${i}:WARN`)),
                              (this._error = (0, s.default)(`${i}:ERROR`))),
                            (this._debug.log = console.info.bind(console)),
                            (this._warn.log = console.warn.bind(console)),
                            (this._error.log = console.error.bind(console));
                    }
                    get debug() {
                        return this._debug;
                    }
                    get warn() {
                        return this._warn;
                    }
                    get error() {
                        return this._error;
                    }
                };
            },
            3200: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.ProfileLevelId = t.Level = t.Profile = void 0),
                    (t.parseProfileLevelId = h),
                    (t.profileLevelIdToString = m),
                    (t.profileToString = function (e) {
                        switch (e) {
                            case i.ConstrainedBaseline:
                                return 'ConstrainedBaseline';
                            case i.Baseline:
                                return 'Baseline';
                            case i.Main:
                                return 'Main';
                            case i.ConstrainedHigh:
                                return 'ConstrainedHigh';
                            case i.High:
                                return 'High';
                            case i.PredictiveHigh444:
                                return 'PredictiveHigh444';
                            default:
                                return void s.warn(`profileToString() | unrecognized profile ${e}`);
                        }
                    }),
                    (t.levelToString = function (e) {
                        switch (e) {
                            case a.L1_b:
                                return '1b';
                            case a.L1:
                                return '1';
                            case a.L1_1:
                                return '1.1';
                            case a.L1_2:
                                return '1.2';
                            case a.L1_3:
                                return '1.3';
                            case a.L2:
                                return '2';
                            case a.L2_1:
                                return '2.1';
                            case a.L2_2:
                                return '2.2';
                            case a.L3:
                                return '3';
                            case a.L3_1:
                                return '3.1';
                            case a.L3_2:
                                return '3.2';
                            case a.L4:
                                return '4';
                            case a.L4_1:
                                return '4.1';
                            case a.L4_2:
                                return '4.2';
                            case a.L5:
                                return '5';
                            case a.L5_1:
                                return '5.1';
                            case a.L5_2:
                                return '5.2';
                            default:
                                return void s.warn(`levelToString() | unrecognized level ${e}`);
                        }
                    }),
                    (t.parseSdpProfileLevelId = u),
                    (t.isSameProfile = function (e = {}, t = {}) {
                        const r = u(e),
                            s = u(t);
                        return Boolean(r && s && r.profile === s.profile);
                    }),
                    (t.isSameProfileAndLevel = function (e = {}, t = {}) {
                        const r = u(e),
                            s = u(t);
                        return Boolean(r && s && r.profile === s.profile && r.level == s.level);
                    }),
                    (t.generateProfileLevelIdStringForAnswer = function (e = {}, t = {}) {
                        if (!e['profile-level-id'] && !t['profile-level-id'])
                            return void s.warn(
                                'generateProfileLevelIdStringForAnswer() | profile-level-id missing in local and remote params',
                            );
                        const r = u(e),
                            i = u(t);
                        if (!r) throw new TypeError('invalid local_profile_level_id');
                        if (!i) throw new TypeError('invalid remote_profile_level_id');
                        if (r.profile !== i.profile) throw new TypeError('H264 Profile mismatch');
                        const o = g(e) && g(t),
                            c = r.level,
                            d = (function (e, t) {
                                return e === a.L1_b ? t !== a.L1 && t !== a.L1_b : t === a.L1_b ? e !== a.L1 : e < t;
                            })((l = c), (h = i.level))
                                ? l
                                : h,
                            p = o ? c : d;
                        var l, h;
                        return (
                            s.debug(
                                `generateProfileLevelIdStringForAnswer() | result [profile:${r.profile}, level:${p}]`,
                            ),
                            m(new n(r.profile, p))
                        );
                    }),
                    (t.supportedLevel = function (e, t) {
                        for (let r = l.length - 1; r >= 0; --r) {
                            const i = l[r];
                            if (
                                256 * i.max_macroblock_frame_size <= e &&
                                i.max_macroblocks_per_second <= t * i.max_macroblock_frame_size
                            )
                                return (
                                    s.debug(
                                        `supportedLevel() | result [max_frame_pixel_count:${e}, max_fps:${t}, level:${i.level}]`,
                                    ),
                                    i.level
                                );
                        }
                        s.warn(`supportedLevel() | no level supported [max_frame_pixel_count:${e}, max_fps:${t}]`);
                    });
                const s = new (r(3582).Logger)();
                var i, a;
                !(function (e) {
                    (e[(e.ConstrainedBaseline = 1)] = 'ConstrainedBaseline'),
                        (e[(e.Baseline = 2)] = 'Baseline'),
                        (e[(e.Main = 3)] = 'Main'),
                        (e[(e.ConstrainedHigh = 4)] = 'ConstrainedHigh'),
                        (e[(e.High = 5)] = 'High'),
                        (e[(e.PredictiveHigh444 = 6)] = 'PredictiveHigh444');
                })(i || (t.Profile = i = {})),
                    (function (e) {
                        (e[(e.L1_b = 0)] = 'L1_b'),
                            (e[(e.L1 = 10)] = 'L1'),
                            (e[(e.L1_1 = 11)] = 'L1_1'),
                            (e[(e.L1_2 = 12)] = 'L1_2'),
                            (e[(e.L1_3 = 13)] = 'L1_3'),
                            (e[(e.L2 = 20)] = 'L2'),
                            (e[(e.L2_1 = 21)] = 'L2_1'),
                            (e[(e.L2_2 = 22)] = 'L2_2'),
                            (e[(e.L3 = 30)] = 'L3'),
                            (e[(e.L3_1 = 31)] = 'L3_1'),
                            (e[(e.L3_2 = 32)] = 'L3_2'),
                            (e[(e.L4 = 40)] = 'L4'),
                            (e[(e.L4_1 = 41)] = 'L4_1'),
                            (e[(e.L4_2 = 42)] = 'L4_2'),
                            (e[(e.L5 = 50)] = 'L5'),
                            (e[(e.L5_1 = 51)] = 'L5_1'),
                            (e[(e.L5_2 = 52)] = 'L5_2');
                    })(a || (t.Level = a = {}));
                class n {
                    constructor(e, t) {
                        (this.profile = e), (this.level = t);
                    }
                }
                t.ProfileLevelId = n;
                const o = new n(i.ConstrainedBaseline, a.L3_1);
                class c {
                    constructor(e) {
                        (this.mask = ~f('x', e)), (this.masked_value = f('1', e));
                    }
                    isMatch(e) {
                        return this.masked_value === (e & this.mask);
                    }
                }
                class d {
                    constructor(e, t, r) {
                        (this.profile_idc = e), (this.profile_iop = t), (this.profile = r);
                    }
                }
                const p = [
                        new d(66, new c('x1xx0000'), i.ConstrainedBaseline),
                        new d(77, new c('1xxx0000'), i.ConstrainedBaseline),
                        new d(88, new c('11xx0000'), i.ConstrainedBaseline),
                        new d(66, new c('x0xx0000'), i.Baseline),
                        new d(88, new c('10xx0000'), i.Baseline),
                        new d(77, new c('0x0x0000'), i.Main),
                        new d(100, new c('00000000'), i.High),
                        new d(100, new c('00001100'), i.ConstrainedHigh),
                        new d(244, new c('00000000'), i.PredictiveHigh444),
                    ],
                    l = [
                        { max_macroblocks_per_second: 1485, max_macroblock_frame_size: 99, level: a.L1 },
                        { max_macroblocks_per_second: 1485, max_macroblock_frame_size: 99, level: a.L1_b },
                        { max_macroblocks_per_second: 3e3, max_macroblock_frame_size: 396, level: a.L1_1 },
                        { max_macroblocks_per_second: 6e3, max_macroblock_frame_size: 396, level: a.L1_2 },
                        { max_macroblocks_per_second: 11880, max_macroblock_frame_size: 396, level: a.L1_3 },
                        { max_macroblocks_per_second: 11880, max_macroblock_frame_size: 396, level: a.L2 },
                        { max_macroblocks_per_second: 19800, max_macroblock_frame_size: 792, level: a.L2_1 },
                        { max_macroblocks_per_second: 20250, max_macroblock_frame_size: 1620, level: a.L2_2 },
                        { max_macroblocks_per_second: 40500, max_macroblock_frame_size: 1620, level: a.L3 },
                        { max_macroblocks_per_second: 108e3, max_macroblock_frame_size: 3600, level: a.L3_1 },
                        { max_macroblocks_per_second: 216e3, max_macroblock_frame_size: 5120, level: a.L3_2 },
                        { max_macroblocks_per_second: 245760, max_macroblock_frame_size: 8192, level: a.L4 },
                        { max_macroblocks_per_second: 245760, max_macroblock_frame_size: 8192, level: a.L4_1 },
                        { max_macroblocks_per_second: 522240, max_macroblock_frame_size: 8704, level: a.L4_2 },
                        { max_macroblocks_per_second: 589824, max_macroblock_frame_size: 22080, level: a.L5 },
                        { max_macroblocks_per_second: 983040, max_macroblock_frame_size: 36864, level: a.L5_1 },
                        { max_macroblocks_per_second: 2073600, max_macroblock_frame_size: 36864, level: a.L5_2 },
                    ];
                function h(e) {
                    if ('string' != typeof e || 6 !== e.length) return;
                    const t = parseInt(e, 16);
                    if (0 === t) return;
                    const r = 255 & t,
                        i = (t >> 8) & 255,
                        o = (t >> 16) & 255;
                    let c;
                    switch (r) {
                        case a.L1_1:
                            c = 16 & i ? a.L1_b : a.L1_1;
                            break;
                        case a.L1:
                        case a.L1_2:
                        case a.L1_3:
                        case a.L2:
                        case a.L2_1:
                        case a.L2_2:
                        case a.L3:
                        case a.L3_1:
                        case a.L3_2:
                        case a.L4:
                        case a.L4_1:
                        case a.L4_2:
                        case a.L5:
                        case a.L5_1:
                        case a.L5_2:
                            c = r;
                            break;
                        default:
                            return void s.warn(
                                `parseProfileLevelId() | unrecognized level_idc [str:${e}, level_idc:${r}]`,
                            );
                    }
                    for (const t of p)
                        if (o === t.profile_idc && t.profile_iop.isMatch(i))
                            return (
                                s.debug(`parseProfileLevelId() | result [str:${e}, profile:${t.profile}, level:${c}]`),
                                new n(t.profile, c)
                            );
                    s.warn(
                        `parseProfileLevelId() | unrecognized profile_idc/profile_iop combination [str:${e}, profile_idc:${o}, profile_iop:${i}]`,
                    );
                }
                function m(e) {
                    if (e.level == a.L1_b)
                        switch (e.profile) {
                            case i.ConstrainedBaseline:
                                return '42f00b';
                            case i.Baseline:
                                return '42100b';
                            case i.Main:
                                return '4d100b';
                            default:
                                return void s.warn(
                                    `profileLevelIdToString() | Level 1_b not is allowed for profile ${e.profile}`,
                                );
                        }
                    let t;
                    switch (e.profile) {
                        case i.ConstrainedBaseline:
                            t = '42e0';
                            break;
                        case i.Baseline:
                            t = '4200';
                            break;
                        case i.Main:
                            t = '4d00';
                            break;
                        case i.ConstrainedHigh:
                            t = '640c';
                            break;
                        case i.High:
                            t = '6400';
                            break;
                        case i.PredictiveHigh444:
                            t = 'f400';
                            break;
                        default:
                            return void s.warn(`profileLevelIdToString() | unrecognized profile ${e.profile}`);
                    }
                    let r = e.level.toString(16);
                    return 1 === r.length && (r = `0${r}`), `${t}${r}`;
                }
                function u(e = {}) {
                    const t = e['profile-level-id'];
                    return t ? h(t) : o;
                }
                function f(e, t) {
                    return (
                        (Number(t[0] === e) << 7) |
                        (Number(t[1] === e) << 6) |
                        (Number(t[2] === e) << 5) |
                        (Number(t[3] === e) << 4) |
                        (Number(t[4] === e) << 3) |
                        (Number(t[5] === e) << 2) |
                        (Number(t[6] === e) << 1) |
                        Number(t[7] === e)
                    );
                }
                function g(e = {}) {
                    const t = e['level-asymmetry-allowed'];
                    return !0 === t || 1 === t || '1' === t;
                }
            },
            3221: (e, t) => {
                'use strict';
                function r(e) {
                    return 14 + (((e + 64) >>> 9) << 4) + 1;
                }
                function s(e, t) {
                    const r = (65535 & e) + (65535 & t);
                    return (((e >> 16) + (t >> 16) + (r >> 16)) << 16) | (65535 & r);
                }
                function i(e, t, r, i, a, n) {
                    return s(((o = s(s(t, e), s(i, n))) << (c = a)) | (o >>> (32 - c)), r);
                    var o, c;
                }
                function a(e, t, r, s, a, n, o) {
                    return i((t & r) | (~t & s), e, t, a, n, o);
                }
                function n(e, t, r, s, a, n, o) {
                    return i((t & s) | (r & ~s), e, t, a, n, o);
                }
                function o(e, t, r, s, a, n, o) {
                    return i(t ^ r ^ s, e, t, a, n, o);
                }
                function c(e, t, r, s, a, n, o) {
                    return i(r ^ (t | ~s), e, t, a, n, o);
                }
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                t.default = function (e) {
                    if ('string' == typeof e) {
                        const t = unescape(encodeURIComponent(e));
                        e = new Uint8Array(t.length);
                        for (let r = 0; r < t.length; ++r) e[r] = t.charCodeAt(r);
                    }
                    return (function (e) {
                        const t = [],
                            r = 32 * e.length,
                            s = '0123456789abcdef';
                        for (let i = 0; i < r; i += 8) {
                            const r = (e[i >> 5] >>> i % 32) & 255,
                                a = parseInt(s.charAt((r >>> 4) & 15) + s.charAt(15 & r), 16);
                            t.push(a);
                        }
                        return t;
                    })(
                        (function (e, t) {
                            (e[t >> 5] |= 128 << t % 32), (e[r(t) - 1] = t);
                            let i = 1732584193,
                                d = -271733879,
                                p = -1732584194,
                                l = 271733878;
                            for (let t = 0; t < e.length; t += 16) {
                                const r = i,
                                    h = d,
                                    m = p,
                                    u = l;
                                (i = a(i, d, p, l, e[t], 7, -680876936)),
                                    (l = a(l, i, d, p, e[t + 1], 12, -389564586)),
                                    (p = a(p, l, i, d, e[t + 2], 17, 606105819)),
                                    (d = a(d, p, l, i, e[t + 3], 22, -1044525330)),
                                    (i = a(i, d, p, l, e[t + 4], 7, -176418897)),
                                    (l = a(l, i, d, p, e[t + 5], 12, 1200080426)),
                                    (p = a(p, l, i, d, e[t + 6], 17, -1473231341)),
                                    (d = a(d, p, l, i, e[t + 7], 22, -45705983)),
                                    (i = a(i, d, p, l, e[t + 8], 7, 1770035416)),
                                    (l = a(l, i, d, p, e[t + 9], 12, -1958414417)),
                                    (p = a(p, l, i, d, e[t + 10], 17, -42063)),
                                    (d = a(d, p, l, i, e[t + 11], 22, -1990404162)),
                                    (i = a(i, d, p, l, e[t + 12], 7, 1804603682)),
                                    (l = a(l, i, d, p, e[t + 13], 12, -40341101)),
                                    (p = a(p, l, i, d, e[t + 14], 17, -1502002290)),
                                    (d = a(d, p, l, i, e[t + 15], 22, 1236535329)),
                                    (i = n(i, d, p, l, e[t + 1], 5, -165796510)),
                                    (l = n(l, i, d, p, e[t + 6], 9, -1069501632)),
                                    (p = n(p, l, i, d, e[t + 11], 14, 643717713)),
                                    (d = n(d, p, l, i, e[t], 20, -373897302)),
                                    (i = n(i, d, p, l, e[t + 5], 5, -701558691)),
                                    (l = n(l, i, d, p, e[t + 10], 9, 38016083)),
                                    (p = n(p, l, i, d, e[t + 15], 14, -660478335)),
                                    (d = n(d, p, l, i, e[t + 4], 20, -405537848)),
                                    (i = n(i, d, p, l, e[t + 9], 5, 568446438)),
                                    (l = n(l, i, d, p, e[t + 14], 9, -1019803690)),
                                    (p = n(p, l, i, d, e[t + 3], 14, -187363961)),
                                    (d = n(d, p, l, i, e[t + 8], 20, 1163531501)),
                                    (i = n(i, d, p, l, e[t + 13], 5, -1444681467)),
                                    (l = n(l, i, d, p, e[t + 2], 9, -51403784)),
                                    (p = n(p, l, i, d, e[t + 7], 14, 1735328473)),
                                    (d = n(d, p, l, i, e[t + 12], 20, -1926607734)),
                                    (i = o(i, d, p, l, e[t + 5], 4, -378558)),
                                    (l = o(l, i, d, p, e[t + 8], 11, -2022574463)),
                                    (p = o(p, l, i, d, e[t + 11], 16, 1839030562)),
                                    (d = o(d, p, l, i, e[t + 14], 23, -35309556)),
                                    (i = o(i, d, p, l, e[t + 1], 4, -1530992060)),
                                    (l = o(l, i, d, p, e[t + 4], 11, 1272893353)),
                                    (p = o(p, l, i, d, e[t + 7], 16, -155497632)),
                                    (d = o(d, p, l, i, e[t + 10], 23, -1094730640)),
                                    (i = o(i, d, p, l, e[t + 13], 4, 681279174)),
                                    (l = o(l, i, d, p, e[t], 11, -358537222)),
                                    (p = o(p, l, i, d, e[t + 3], 16, -722521979)),
                                    (d = o(d, p, l, i, e[t + 6], 23, 76029189)),
                                    (i = o(i, d, p, l, e[t + 9], 4, -640364487)),
                                    (l = o(l, i, d, p, e[t + 12], 11, -421815835)),
                                    (p = o(p, l, i, d, e[t + 15], 16, 530742520)),
                                    (d = o(d, p, l, i, e[t + 2], 23, -995338651)),
                                    (i = c(i, d, p, l, e[t], 6, -198630844)),
                                    (l = c(l, i, d, p, e[t + 7], 10, 1126891415)),
                                    (p = c(p, l, i, d, e[t + 14], 15, -1416354905)),
                                    (d = c(d, p, l, i, e[t + 5], 21, -57434055)),
                                    (i = c(i, d, p, l, e[t + 12], 6, 1700485571)),
                                    (l = c(l, i, d, p, e[t + 3], 10, -1894986606)),
                                    (p = c(p, l, i, d, e[t + 10], 15, -1051523)),
                                    (d = c(d, p, l, i, e[t + 1], 21, -2054922799)),
                                    (i = c(i, d, p, l, e[t + 8], 6, 1873313359)),
                                    (l = c(l, i, d, p, e[t + 15], 10, -30611744)),
                                    (p = c(p, l, i, d, e[t + 6], 15, -1560198380)),
                                    (d = c(d, p, l, i, e[t + 13], 21, 1309151649)),
                                    (i = c(i, d, p, l, e[t + 4], 6, -145523070)),
                                    (l = c(l, i, d, p, e[t + 11], 10, -1120210379)),
                                    (p = c(p, l, i, d, e[t + 2], 15, 718787259)),
                                    (d = c(d, p, l, i, e[t + 9], 21, -343485551)),
                                    (i = s(i, r)),
                                    (d = s(d, h)),
                                    (p = s(p, m)),
                                    (l = s(l, u));
                            }
                            return [i, d, p, l];
                        })(
                            (function (e) {
                                if (0 === e.length) return [];
                                const t = 8 * e.length,
                                    s = new Uint32Array(r(t));
                                for (let r = 0; r < t; r += 8) s[r >> 5] |= (255 & e[r / 8]) << r % 32;
                                return s;
                            })(e),
                            8 * e.length,
                        ),
                    );
                };
            },
            3303: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.parse = function (e) {
                        const t = r.exec(e ?? '');
                        return t
                            ? { spatialLayers: Number(t[1]), temporalLayers: Number(t[2]) }
                            : { spatialLayers: 1, temporalLayers: 1 };
                    });
                const r = new RegExp('^[LS]([1-9]\\d{0,1})T([1-9]\\d{0,1})');
            },
            3385: (e, t, r) => {
                e.exports = function (e) {
                    function t(e) {
                        let r,
                            i,
                            a,
                            n = null;
                        function o(...e) {
                            if (!o.enabled) return;
                            const s = o,
                                i = Number(new Date()),
                                a = i - (r || i);
                            (s.diff = a),
                                (s.prev = r),
                                (s.curr = i),
                                (r = i),
                                (e[0] = t.coerce(e[0])),
                                'string' != typeof e[0] && e.unshift('%O');
                            let n = 0;
                            (e[0] = e[0].replace(/%([a-zA-Z%])/g, (r, i) => {
                                if ('%%' === r) return '%';
                                n++;
                                const a = t.formatters[i];
                                if ('function' == typeof a) {
                                    const t = e[n];
                                    (r = a.call(s, t)), e.splice(n, 1), n--;
                                }
                                return r;
                            })),
                                t.formatArgs.call(s, e),
                                (s.log || t.log).apply(s, e);
                        }
                        return (
                            (o.namespace = e),
                            (o.useColors = t.useColors()),
                            (o.color = t.selectColor(e)),
                            (o.extend = s),
                            (o.destroy = t.destroy),
                            Object.defineProperty(o, 'enabled', {
                                enumerable: !0,
                                configurable: !1,
                                get: () =>
                                    null !== n
                                        ? n
                                        : (i !== t.namespaces && ((i = t.namespaces), (a = t.enabled(e))), a),
                                set: (e) => {
                                    n = e;
                                },
                            }),
                            'function' == typeof t.init && t.init(o),
                            o
                        );
                    }
                    function s(e, r) {
                        const s = t(this.namespace + (void 0 === r ? ':' : r) + e);
                        return (s.log = this.log), s;
                    }
                    function i(e, t) {
                        let r = 0,
                            s = 0,
                            i = -1,
                            a = 0;
                        for (; r < e.length; )
                            if (s < t.length && (t[s] === e[r] || '*' === t[s]))
                                '*' === t[s] ? ((i = s), (a = r), s++) : (r++, s++);
                            else {
                                if (-1 === i) return !1;
                                (s = i + 1), a++, (r = a);
                            }
                        for (; s < t.length && '*' === t[s]; ) s++;
                        return s === t.length;
                    }
                    return (
                        (t.debug = t),
                        (t.default = t),
                        (t.coerce = function (e) {
                            return e instanceof Error ? e.stack || e.message : e;
                        }),
                        (t.disable = function () {
                            const e = [...t.names, ...t.skips.map((e) => '-' + e)].join(',');
                            return t.enable(''), e;
                        }),
                        (t.enable = function (e) {
                            t.save(e), (t.namespaces = e), (t.names = []), (t.skips = []);
                            const r = ('string' == typeof e ? e : '')
                                .trim()
                                .replace(' ', ',')
                                .split(',')
                                .filter(Boolean);
                            for (const e of r) '-' === e[0] ? t.skips.push(e.slice(1)) : t.names.push(e);
                        }),
                        (t.enabled = function (e) {
                            for (const r of t.skips) if (i(e, r)) return !1;
                            for (const r of t.names) if (i(e, r)) return !0;
                            return !1;
                        }),
                        (t.humanize = r(3552)),
                        (t.destroy = function () {
                            console.warn(
                                'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
                            );
                        }),
                        Object.keys(e).forEach((r) => {
                            t[r] = e[r];
                        }),
                        (t.names = []),
                        (t.skips = []),
                        (t.formatters = {}),
                        (t.selectColor = function (e) {
                            let r = 0;
                            for (let t = 0; t < e.length; t++) (r = (r << 5) - r + e.charCodeAt(t)), (r |= 0);
                            return t.colors[Math.abs(r) % t.colors.length];
                        }),
                        t.enable(t.load()),
                        t
                    );
                };
            },
            3471: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.OfferMediaSection = t.AnswerMediaSection = t.MediaSection = void 0);
                const s = r(7363),
                    i = r(1765);
                class a {
                    _mediaObject;
                    _planB;
                    constructor({ iceParameters: e, iceCandidates: t, dtlsParameters: r, planB: s = !1 }) {
                        if (((this._mediaObject = {}), (this._planB = s), e && this.setIceParameters(e), t)) {
                            this._mediaObject.candidates = [];
                            for (const e of t) {
                                const t = { component: 1 };
                                (t.foundation = e.foundation),
                                    (t.ip = e.address ?? e.ip),
                                    (t.port = e.port),
                                    (t.priority = e.priority),
                                    (t.transport = e.protocol),
                                    (t.type = e.type),
                                    e.tcpType && (t.tcptype = e.tcpType),
                                    this._mediaObject.candidates.push(t);
                            }
                            (this._mediaObject.endOfCandidates = 'end-of-candidates'),
                                (this._mediaObject.iceOptions = 'renomination');
                        }
                        r && this.setDtlsRole(r.role);
                    }
                    get mid() {
                        return String(this._mediaObject.mid);
                    }
                    get closed() {
                        return 0 === this._mediaObject.port;
                    }
                    getObject() {
                        return this._mediaObject;
                    }
                    setIceParameters(e) {
                        (this._mediaObject.iceUfrag = e.usernameFragment), (this._mediaObject.icePwd = e.password);
                    }
                    pause() {
                        this._mediaObject.direction = 'inactive';
                    }
                    disable() {
                        this.pause(),
                            delete this._mediaObject.ext,
                            delete this._mediaObject.ssrcs,
                            delete this._mediaObject.ssrcGroups,
                            delete this._mediaObject.simulcast,
                            delete this._mediaObject.simulcast_03,
                            delete this._mediaObject.rids,
                            delete this._mediaObject.extmapAllowMixed;
                    }
                    close() {
                        this.disable(), (this._mediaObject.port = 0);
                    }
                }
                function n(e) {
                    const t = new RegExp('^(audio|video)/(.+)', 'i').exec(e.mimeType);
                    if (!t) throw new TypeError('invalid codec.mimeType');
                    return t[2];
                }
                (t.MediaSection = a),
                    (t.AnswerMediaSection = class extends a {
                        constructor({
                            iceParameters: e,
                            iceCandidates: t,
                            dtlsParameters: r,
                            sctpParameters: s,
                            plainRtpParameters: a,
                            planB: o = !1,
                            offerMediaObject: c,
                            offerRtpParameters: d,
                            answerRtpParameters: p,
                            codecOptions: l,
                        }) {
                            switch (
                                (super({ iceParameters: e, iceCandidates: t, dtlsParameters: r, planB: o }),
                                (this._mediaObject.mid = String(c.mid)),
                                (this._mediaObject.type = c.type),
                                (this._mediaObject.protocol = c.protocol),
                                a
                                    ? ((this._mediaObject.connection = { ip: a.ip, version: a.ipVersion }),
                                      (this._mediaObject.port = a.port))
                                    : ((this._mediaObject.connection = { ip: '127.0.0.1', version: 4 }),
                                      (this._mediaObject.port = 7)),
                                c.type)
                            ) {
                                case 'audio':
                                case 'video':
                                    (this._mediaObject.direction = 'recvonly'),
                                        (this._mediaObject.rtp = []),
                                        (this._mediaObject.rtcpFb = []),
                                        (this._mediaObject.fmtp = []);
                                    for (const e of p.codecs) {
                                        const t = { payload: e.payloadType, codec: n(e), rate: e.clockRate };
                                        e.channels > 1 && (t.encoding = e.channels), this._mediaObject.rtp.push(t);
                                        const r = i.clone(e.parameters) ?? {};
                                        let s = i.clone(e.rtcpFeedback) ?? [];
                                        if (l) {
                                            const {
                                                    opusStereo: t,
                                                    opusFec: i,
                                                    opusDtx: a,
                                                    opusMaxPlaybackRate: n,
                                                    opusMaxAverageBitrate: o,
                                                    opusPtime: c,
                                                    opusNack: p,
                                                    videoGoogleStartBitrate: h,
                                                    videoGoogleMaxBitrate: m,
                                                    videoGoogleMinBitrate: u,
                                                } = l,
                                                f = d.codecs.find((t) => t.payloadType === e.payloadType);
                                            switch (e.mimeType.toLowerCase()) {
                                                case 'audio/opus':
                                                case 'audio/multiopus':
                                                    void 0 !== t &&
                                                        ((f.parameters['sprop-stereo'] = t ? 1 : 0),
                                                        (r.stereo = t ? 1 : 0)),
                                                        void 0 !== i &&
                                                            ((f.parameters.useinbandfec = i ? 1 : 0),
                                                            (r.useinbandfec = i ? 1 : 0)),
                                                        void 0 !== a &&
                                                            ((f.parameters.usedtx = a ? 1 : 0), (r.usedtx = a ? 1 : 0)),
                                                        void 0 !== n && (r.maxplaybackrate = n),
                                                        void 0 !== o && (r.maxaveragebitrate = o),
                                                        void 0 !== c && ((f.parameters.ptime = c), (r.ptime = c)),
                                                        p ||
                                                            ((f.rtcpFeedback = f.rtcpFeedback.filter(
                                                                (e) => 'nack' !== e.type || e.parameter,
                                                            )),
                                                            (s = s.filter((e) => 'nack' !== e.type || e.parameter)));
                                                    break;
                                                case 'video/vp8':
                                                case 'video/vp9':
                                                case 'video/h264':
                                                case 'video/h265':
                                                    void 0 !== h && (r['x-google-start-bitrate'] = h),
                                                        void 0 !== m && (r['x-google-max-bitrate'] = m),
                                                        void 0 !== u && (r['x-google-min-bitrate'] = u);
                                            }
                                        }
                                        const a = { payload: e.payloadType, config: '' };
                                        for (const e of Object.keys(r))
                                            a.config && (a.config += ';'), (a.config += `${e}=${r[e]}`);
                                        a.config && this._mediaObject.fmtp.push(a);
                                        for (const t of s)
                                            this._mediaObject.rtcpFb.push({
                                                payload: e.payloadType,
                                                type: t.type,
                                                subtype: t.parameter,
                                            });
                                    }
                                    (this._mediaObject.payloads = p.codecs.map((e) => e.payloadType).join(' ')),
                                        (this._mediaObject.ext = []);
                                    for (const e of p.headerExtensions)
                                        (c.ext ?? []).some((t) => t.uri === e.uri) &&
                                            this._mediaObject.ext.push({ uri: e.uri, value: e.id });
                                    if (
                                        ('extmap-allow-mixed' === c.extmapAllowMixed &&
                                            (this._mediaObject.extmapAllowMixed = 'extmap-allow-mixed'),
                                        c.simulcast)
                                    ) {
                                        (this._mediaObject.simulcast = { dir1: 'recv', list1: c.simulcast.list1 }),
                                            (this._mediaObject.rids = []);
                                        for (const e of c.rids ?? [])
                                            'send' === e.direction &&
                                                this._mediaObject.rids.push({ id: e.id, direction: 'recv' });
                                    } else if (c.simulcast_03) {
                                        (this._mediaObject.simulcast_03 = {
                                            value: c.simulcast_03.value.replace(/send/g, 'recv'),
                                        }),
                                            (this._mediaObject.rids = []);
                                        for (const e of c.rids ?? [])
                                            'send' === e.direction &&
                                                this._mediaObject.rids.push({ id: e.id, direction: 'recv' });
                                    }
                                    (this._mediaObject.rtcpMux = 'rtcp-mux'),
                                        (this._mediaObject.rtcpRsize = 'rtcp-rsize'),
                                        this._planB &&
                                            'video' === this._mediaObject.type &&
                                            (this._mediaObject.xGoogleFlag = 'conference');
                                    break;
                                case 'application':
                                    'number' == typeof c.sctpPort
                                        ? ((this._mediaObject.payloads = 'webrtc-datachannel'),
                                          (this._mediaObject.sctpPort = s.port),
                                          (this._mediaObject.maxMessageSize = s.maxMessageSize))
                                        : c.sctpmap &&
                                          ((this._mediaObject.payloads = s.port),
                                          (this._mediaObject.sctpmap = {
                                              app: 'webrtc-datachannel',
                                              sctpmapNumber: s.port,
                                              maxMessageSize: s.maxMessageSize,
                                          }));
                            }
                        }
                        setDtlsRole(e) {
                            switch (e) {
                                case 'client':
                                    this._mediaObject.setup = 'active';
                                    break;
                                case 'server':
                                    this._mediaObject.setup = 'passive';
                                    break;
                                case 'auto':
                                    this._mediaObject.setup = 'actpass';
                            }
                        }
                        resume() {
                            this._mediaObject.direction = 'recvonly';
                        }
                        muxSimulcastStreams(e) {
                            if (!this._mediaObject.simulcast?.list1) return;
                            const t = {};
                            for (const r of e) r.rid && (t[r.rid] = r);
                            const r = this._mediaObject.simulcast.list1,
                                i = s.parseSimulcastStreamList(r);
                            for (const e of i) for (const r of e) r.paused = !t[r.scid]?.active;
                            this._mediaObject.simulcast.list1 = i
                                .map((e) => e.map((e) => `${e.paused ? '~' : ''}${e.scid}`).join(','))
                                .join(';');
                        }
                    }),
                    (t.OfferMediaSection = class extends a {
                        constructor({
                            iceParameters: e,
                            iceCandidates: t,
                            dtlsParameters: r,
                            sctpParameters: s,
                            plainRtpParameters: i,
                            planB: a = !1,
                            mid: o,
                            kind: c,
                            offerRtpParameters: d,
                            streamId: p,
                            trackId: l,
                            oldDataChannelSpec: h = !1,
                        }) {
                            switch (
                                (super({ iceParameters: e, iceCandidates: t, dtlsParameters: r, planB: a }),
                                (this._mediaObject.mid = String(o)),
                                (this._mediaObject.type = c),
                                i
                                    ? ((this._mediaObject.connection = { ip: i.ip, version: i.ipVersion }),
                                      (this._mediaObject.protocol = 'RTP/AVP'),
                                      (this._mediaObject.port = i.port))
                                    : ((this._mediaObject.connection = { ip: '127.0.0.1', version: 4 }),
                                      (this._mediaObject.protocol = s ? 'UDP/DTLS/SCTP' : 'UDP/TLS/RTP/SAVPF'),
                                      (this._mediaObject.port = 7)),
                                c)
                            ) {
                                case 'audio':
                                case 'video': {
                                    (this._mediaObject.direction = 'sendonly'),
                                        (this._mediaObject.rtp = []),
                                        (this._mediaObject.rtcpFb = []),
                                        (this._mediaObject.fmtp = []),
                                        this._planB || (this._mediaObject.msid = `${p ?? '-'} ${l}`);
                                    for (const e of d.codecs) {
                                        const t = { payload: e.payloadType, codec: n(e), rate: e.clockRate };
                                        e.channels > 1 && (t.encoding = e.channels), this._mediaObject.rtp.push(t);
                                        const r = { payload: e.payloadType, config: '' };
                                        for (const t of Object.keys(e.parameters))
                                            r.config && (r.config += ';'), (r.config += `${t}=${e.parameters[t]}`);
                                        r.config && this._mediaObject.fmtp.push(r);
                                        for (const t of e.rtcpFeedback)
                                            this._mediaObject.rtcpFb.push({
                                                payload: e.payloadType,
                                                type: t.type,
                                                subtype: t.parameter,
                                            });
                                    }
                                    (this._mediaObject.payloads = d.codecs.map((e) => e.payloadType).join(' ')),
                                        (this._mediaObject.ext = []);
                                    for (const e of d.headerExtensions)
                                        this._mediaObject.ext.push({ uri: e.uri, value: e.id });
                                    (this._mediaObject.rtcpMux = 'rtcp-mux'),
                                        (this._mediaObject.rtcpRsize = 'rtcp-rsize');
                                    const e = d.encodings[0],
                                        t = e.ssrc,
                                        r = e.rtx?.ssrc;
                                    (this._mediaObject.ssrcs = []),
                                        (this._mediaObject.ssrcGroups = []),
                                        d.rtcp.cname &&
                                            this._mediaObject.ssrcs.push({
                                                id: t,
                                                attribute: 'cname',
                                                value: d.rtcp.cname,
                                            }),
                                        this._planB &&
                                            this._mediaObject.ssrcs.push({
                                                id: t,
                                                attribute: 'msid',
                                                value: `${p ?? '-'} ${l}`,
                                            }),
                                        r &&
                                            (d.rtcp.cname &&
                                                this._mediaObject.ssrcs.push({
                                                    id: r,
                                                    attribute: 'cname',
                                                    value: d.rtcp.cname,
                                                }),
                                            this._planB &&
                                                this._mediaObject.ssrcs.push({
                                                    id: r,
                                                    attribute: 'msid',
                                                    value: `${p ?? '-'} ${l}`,
                                                }),
                                            this._mediaObject.ssrcGroups.push({
                                                semantics: 'FID',
                                                ssrcs: `${t} ${r}`,
                                            }));
                                    break;
                                }
                                case 'application':
                                    h
                                        ? ((this._mediaObject.payloads = s.port),
                                          (this._mediaObject.sctpmap = {
                                              app: 'webrtc-datachannel',
                                              sctpmapNumber: s.port,
                                              maxMessageSize: s.maxMessageSize,
                                          }))
                                        : ((this._mediaObject.payloads = 'webrtc-datachannel'),
                                          (this._mediaObject.sctpPort = s.port),
                                          (this._mediaObject.maxMessageSize = s.maxMessageSize));
                            }
                        }
                        setDtlsRole(e) {
                            this._mediaObject.setup = 'actpass';
                        }
                        resume() {
                            this._mediaObject.direction = 'sendonly';
                        }
                        planBReceive({ offerRtpParameters: e, streamId: t, trackId: r }) {
                            const s = e.encodings[0],
                                i = s.ssrc,
                                a = s.rtx?.ssrc,
                                o = this._mediaObject.payloads.split(' ');
                            for (const t of e.codecs) {
                                if (o.includes(String(t.payloadType))) continue;
                                const e = { payload: t.payloadType, codec: n(t), rate: t.clockRate };
                                t.channels > 1 && (e.encoding = t.channels), this._mediaObject.rtp.push(e);
                                const r = { payload: t.payloadType, config: '' };
                                for (const e of Object.keys(t.parameters))
                                    r.config && (r.config += ';'), (r.config += `${e}=${t.parameters[e]}`);
                                r.config && this._mediaObject.fmtp.push(r);
                                for (const e of t.rtcpFeedback)
                                    this._mediaObject.rtcpFb.push({
                                        payload: t.payloadType,
                                        type: e.type,
                                        subtype: e.parameter,
                                    });
                            }
                            (this._mediaObject.payloads += ` ${e.codecs
                                .filter((e) => !this._mediaObject.payloads.includes(e.payloadType))
                                .map((e) => e.payloadType)
                                .join(' ')}`),
                                (this._mediaObject.payloads = this._mediaObject.payloads.trim()),
                                e.rtcp.cname &&
                                    this._mediaObject.ssrcs.push({ id: i, attribute: 'cname', value: e.rtcp.cname }),
                                this._mediaObject.ssrcs.push({ id: i, attribute: 'msid', value: `${t ?? '-'} ${r}` }),
                                a &&
                                    (e.rtcp.cname &&
                                        this._mediaObject.ssrcs.push({
                                            id: a,
                                            attribute: 'cname',
                                            value: e.rtcp.cname,
                                        }),
                                    this._mediaObject.ssrcs.push({
                                        id: a,
                                        attribute: 'msid',
                                        value: `${t ?? '-'} ${r}`,
                                    }),
                                    this._mediaObject.ssrcGroups.push({ semantics: 'FID', ssrcs: `${i} ${a}` }));
                        }
                        planBStopReceiving({ offerRtpParameters: e }) {
                            const t = e.encodings[0],
                                r = t.ssrc,
                                s = t.rtx?.ssrc;
                            (this._mediaObject.ssrcs = this._mediaObject.ssrcs.filter((e) => e.id !== r && e.id !== s)),
                                s &&
                                    (this._mediaObject.ssrcGroups = this._mediaObject.ssrcGroups.filter(
                                        (e) => e.ssrcs !== `${r} ${s}`,
                                    ));
                        }
                    });
            },
            3518: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Consumer = void 0);
                const s = r(2994),
                    i = r(3953),
                    a = r(4893),
                    n = new s.Logger('Consumer');
                class o extends i.EnhancedEventEmitter {
                    _id;
                    _localId;
                    _producerId;
                    _closed = !1;
                    _rtpReceiver;
                    _track;
                    _rtpParameters;
                    _paused;
                    _appData;
                    _observer = new i.EnhancedEventEmitter();
                    constructor({
                        id: e,
                        localId: t,
                        producerId: r,
                        rtpReceiver: s,
                        track: i,
                        rtpParameters: a,
                        appData: o,
                    }) {
                        super(),
                            n.debug('constructor()'),
                            (this._id = e),
                            (this._localId = t),
                            (this._producerId = r),
                            (this._rtpReceiver = s),
                            (this._track = i),
                            (this._rtpParameters = a),
                            (this._paused = !i.enabled),
                            (this._appData = o ?? {}),
                            (this.onTrackEnded = this.onTrackEnded.bind(this)),
                            this.handleTrack();
                    }
                    get id() {
                        return this._id;
                    }
                    get localId() {
                        return this._localId;
                    }
                    get producerId() {
                        return this._producerId;
                    }
                    get closed() {
                        return this._closed;
                    }
                    get kind() {
                        return this._track.kind;
                    }
                    get rtpReceiver() {
                        return this._rtpReceiver;
                    }
                    get track() {
                        return this._track;
                    }
                    get rtpParameters() {
                        return this._rtpParameters;
                    }
                    get paused() {
                        return this._paused;
                    }
                    get appData() {
                        return this._appData;
                    }
                    set appData(e) {
                        this._appData = e;
                    }
                    get observer() {
                        return this._observer;
                    }
                    close() {
                        this._closed ||
                            (n.debug('close()'),
                            (this._closed = !0),
                            this.destroyTrack(),
                            this.emit('@close'),
                            this._observer.safeEmit('close'));
                    }
                    transportClosed() {
                        this._closed ||
                            (n.debug('transportClosed()'),
                            (this._closed = !0),
                            this.destroyTrack(),
                            this.safeEmit('transportclose'),
                            this._observer.safeEmit('close'));
                    }
                    async getStats() {
                        if (this._closed) throw new a.InvalidStateError('closed');
                        return new Promise((e, t) => {
                            this.safeEmit('@getstats', e, t);
                        });
                    }
                    pause() {
                        n.debug('pause()'),
                            this._closed
                                ? n.error('pause() | Consumer closed')
                                : this._paused
                                  ? n.debug('pause() | Consumer is already paused')
                                  : ((this._paused = !0),
                                    (this._track.enabled = !1),
                                    this.emit('@pause'),
                                    this._observer.safeEmit('pause'));
                    }
                    resume() {
                        n.debug('resume()'),
                            this._closed
                                ? n.error('resume() | Consumer closed')
                                : this._paused
                                  ? ((this._paused = !1),
                                    (this._track.enabled = !0),
                                    this.emit('@resume'),
                                    this._observer.safeEmit('resume'))
                                  : n.debug('resume() | Consumer is already resumed');
                    }
                    onTrackEnded() {
                        n.debug('track "ended" event'),
                            this.safeEmit('trackended'),
                            this._observer.safeEmit('trackended');
                    }
                    handleTrack() {
                        this._track.addEventListener('ended', this.onTrackEnded);
                    }
                    destroyTrack() {
                        try {
                            this._track.removeEventListener('ended', this.onTrackEnded), this._track.stop();
                        } catch (e) {}
                    }
                }
                t.Consumer = o;
            },
            3552: (e) => {
                var t = 1e3,
                    r = 60 * t,
                    s = 60 * r,
                    i = 24 * s,
                    a = 7 * i;
                function n(e, t, r, s) {
                    var i = t >= 1.5 * r;
                    return Math.round(e / r) + ' ' + s + (i ? 's' : '');
                }
                e.exports = function (e, o) {
                    o = o || {};
                    var c,
                        d,
                        p = typeof e;
                    if ('string' === p && e.length > 0)
                        return (function (e) {
                            if (!((e = String(e)).length > 100)) {
                                var n =
                                    /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
                                        e,
                                    );
                                if (n) {
                                    var o = parseFloat(n[1]);
                                    switch ((n[2] || 'ms').toLowerCase()) {
                                        case 'years':
                                        case 'year':
                                        case 'yrs':
                                        case 'yr':
                                        case 'y':
                                            return 315576e5 * o;
                                        case 'weeks':
                                        case 'week':
                                        case 'w':
                                            return o * a;
                                        case 'days':
                                        case 'day':
                                        case 'd':
                                            return o * i;
                                        case 'hours':
                                        case 'hour':
                                        case 'hrs':
                                        case 'hr':
                                        case 'h':
                                            return o * s;
                                        case 'minutes':
                                        case 'minute':
                                        case 'mins':
                                        case 'min':
                                        case 'm':
                                            return o * r;
                                        case 'seconds':
                                        case 'second':
                                        case 'secs':
                                        case 'sec':
                                        case 's':
                                            return o * t;
                                        case 'milliseconds':
                                        case 'millisecond':
                                        case 'msecs':
                                        case 'msec':
                                        case 'ms':
                                            return o;
                                        default:
                                            return;
                                    }
                                }
                            }
                        })(e);
                    if ('number' === p && isFinite(e))
                        return o.long
                            ? ((c = e),
                              (d = Math.abs(c)) >= i
                                  ? n(c, d, i, 'day')
                                  : d >= s
                                    ? n(c, d, s, 'hour')
                                    : d >= r
                                      ? n(c, d, r, 'minute')
                                      : d >= t
                                        ? n(c, d, t, 'second')
                                        : c + ' ms')
                            : (function (e) {
                                  var a = Math.abs(e);
                                  return a >= i
                                      ? Math.round(e / i) + 'd'
                                      : a >= s
                                        ? Math.round(e / s) + 'h'
                                        : a >= r
                                          ? Math.round(e / r) + 'm'
                                          : a >= t
                                            ? Math.round(e / t) + 's'
                                            : e + 'ms';
                              })(e);
                    throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(e));
                };
            },
            3582: function (e, t, r) {
                'use strict';
                var s =
                    (this && this.__importDefault) ||
                    function (e) {
                        return e && e.__esModule ? e : { default: e };
                    };
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Logger = void 0);
                const i = s(r(1970)),
                    a = 'h264-profile-level-id';
                t.Logger = class {
                    constructor(e) {
                        e
                            ? ((this._debug = (0, i.default)(`${a}:${e}`)),
                              (this._warn = (0, i.default)(`${a}:WARN:${e}`)),
                              (this._error = (0, i.default)(`${a}:ERROR:${e}`)))
                            : ((this._debug = (0, i.default)(a)),
                              (this._warn = (0, i.default)(`${a}:WARN`)),
                              (this._error = (0, i.default)(`${a}:ERROR`))),
                            (this._debug.log = console.info.bind(console)),
                            (this._warn.log = console.warn.bind(console)),
                            (this._error.log = console.error.bind(console));
                    }
                    get debug() {
                        return this._debug;
                    }
                    get warn() {
                        return this._warn;
                    }
                    get error() {
                        return this._error;
                    }
                };
            },
            3804: (e, t, r) => {
                var s = r(5602),
                    i = /%[sdv%]/g,
                    a = function (e) {
                        var t = 1,
                            r = arguments,
                            s = r.length;
                        return e.replace(i, function (e) {
                            if (t >= s) return e;
                            var i = r[t];
                            switch (((t += 1), e)) {
                                case '%%':
                                    return '%';
                                case '%s':
                                    return String(i);
                                case '%d':
                                    return Number(i);
                                case '%v':
                                    return '';
                            }
                        });
                    },
                    n = function (e, t, r) {
                        var s = [
                            e + '=' + (t.format instanceof Function ? t.format(t.push ? r : r[t.name]) : t.format),
                        ];
                        if (t.names)
                            for (var i = 0; i < t.names.length; i += 1) {
                                var n = t.names[i];
                                t.name ? s.push(r[t.name][n]) : s.push(r[t.names[i]]);
                            }
                        else s.push(r[t.name]);
                        return a.apply(null, s);
                    },
                    o = ['v', 'o', 's', 'i', 'u', 'e', 'p', 'c', 'b', 't', 'r', 'z', 'a'],
                    c = ['i', 'c', 'b', 'a'];
                e.exports = function (e, t) {
                    (t = t || {}),
                        null == e.version && (e.version = 0),
                        null == e.name && (e.name = ' '),
                        e.media.forEach(function (e) {
                            null == e.payloads && (e.payloads = '');
                        });
                    var r = t.outerOrder || o,
                        i = t.innerOrder || c,
                        a = [];
                    return (
                        r.forEach(function (t) {
                            s[t].forEach(function (r) {
                                r.name in e && null != e[r.name]
                                    ? a.push(n(t, r, e))
                                    : r.push in e &&
                                      null != e[r.push] &&
                                      e[r.push].forEach(function (e) {
                                          a.push(n(t, r, e));
                                      });
                            });
                        }),
                        e.media.forEach(function (e) {
                            a.push(n('m', s.m[0], e)),
                                i.forEach(function (t) {
                                    s[t].forEach(function (r) {
                                        r.name in e && null != e[r.name]
                                            ? a.push(n(t, r, e))
                                            : r.push in e &&
                                              null != e[r.push] &&
                                              e[r.push].forEach(function (e) {
                                                  a.push(n(t, r, e));
                                              });
                                    });
                                });
                        }),
                        a.join('\r\n') + '\r\n'
                    );
                };
            },
            3907: (e, t) => {
                'use strict';
                let r;
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.default = function () {
                        if (
                            !r &&
                            ((r =
                                'undefined' != typeof crypto &&
                                crypto.getRandomValues &&
                                crypto.getRandomValues.bind(crypto)),
                            !r)
                        )
                            throw new Error(
                                'crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported',
                            );
                        return r(s);
                    });
                const s = new Uint8Array(16);
            },
            3953: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.EnhancedEventEmitter = void 0);
                const s = r(9596),
                    i = new (r(2994).Logger)('EnhancedEventEmitter');
                class a extends s.EventEmitter {
                    constructor() {
                        super(), this.setMaxListeners(1 / 0);
                    }
                    emit(e, ...t) {
                        return super.emit(e, ...t);
                    }
                    safeEmit(e, ...t) {
                        try {
                            return super.emit(e, ...t);
                        } catch (t) {
                            i.error('safeEmit() | event listener threw an error [eventName:%s]:%o', e, t);
                            try {
                                super.emit('listenererror', e, t);
                            } catch (e) {}
                            return Boolean(super.listenerCount(e));
                        }
                    }
                    on(e, t) {
                        return super.on(e, t), this;
                    }
                    off(e, t) {
                        return super.off(e, t), this;
                    }
                    addListener(e, t) {
                        return super.on(e, t), this;
                    }
                    prependListener(e, t) {
                        return super.prependListener(e, t), this;
                    }
                    once(e, t) {
                        return super.once(e, t), this;
                    }
                    prependOnceListener(e, t) {
                        return super.prependOnceListener(e, t), this;
                    }
                    removeListener(e, t) {
                        return super.off(e, t), this;
                    }
                    removeAllListeners(e) {
                        return super.removeAllListeners(e), this;
                    }
                    listenerCount(e) {
                        return super.listenerCount(e);
                    }
                    listeners(e) {
                        return super.listeners(e);
                    }
                    rawListeners(e) {
                        return super.rawListeners(e);
                    }
                }
                t.EnhancedEventEmitter = a;
            },
            4039: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.ReactNativeUnifiedPlan = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(5938),
                    d = r(4256),
                    p = r(4893),
                    l = r(521),
                    h = r(1305),
                    m = r(3303),
                    u = new i.Logger('ReactNativeUnifiedPlan'),
                    f = { OS: 1024, MIS: 1024 };
                class g extends l.HandlerInterface {
                    _closed = !1;
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new g();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'ReactNativeUnifiedPlan';
                    }
                    close() {
                        if ((u.debug('close()'), !this._closed)) {
                            if (((this._closed = !0), this._sendStream.release(!1), this._pc))
                                try {
                                    this._pc.close();
                                } catch (e) {}
                            this.emit('@close');
                        }
                    }
                    async getNativeRtpCapabilities() {
                        u.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'unified-plan',
                        });
                        try {
                            e.addTransceiver('audio'), e.addTransceiver('video');
                            const t = await e.createOffer();
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp),
                                i = o.extractRtpCapabilities({ sdpObject: r });
                            return d.addNackSupportForOpus(i), i;
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return u.debug('getNativeSctpCapabilities()'), { numStreams: f };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        this.assertNotClosed(),
                            u.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new h.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', p),
                                video: n.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', p),
                                video: n.getSendingRemoteRtpParameters('video', p),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'unified-plan',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (u.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        this.assertNotClosed(), u.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if (
                            (this.assertNotClosed(),
                            u.debug('restartIce()'),
                            this._remoteSdp.updateIceParameters(e),
                            this._transportReady)
                        )
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                u.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                u.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i, onRtpSender: d }) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            t &&
                                t.length > 1 &&
                                t.forEach((e, t) => {
                                    e.rid = `r${t}`;
                                });
                        const p = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        p.codecs = n.reduceCodecs(p.codecs, i);
                        const l = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        l.codecs = n.reduceCodecs(l.codecs, i);
                        const h = this._remoteSdp.getNextMediaSectionIdx(),
                            f = this._pc.addTransceiver(e, {
                                direction: 'sendonly',
                                streams: [this._sendStream],
                                sendEncodings: t,
                            });
                        d && d(f.sender);
                        let g,
                            _ = await this._pc.createOffer(),
                            w = s.parse(_.sdp);
                        w.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: w,
                                }));
                        let b = !1;
                        const v = (0, m.parse)((t ?? [{}])[0].scalabilityMode);
                        t &&
                            1 === t.length &&
                            v.spatialLayers > 1 &&
                            'video/vp9' === p.codecs[0].mimeType.toLowerCase() &&
                            (u.debug('send() | enabling legacy simulcast for VP9 SVC'),
                            (b = !0),
                            (w = s.parse(_.sdp)),
                            (g = w.media[h.idx]),
                            c.addLegacySimulcast({ offerMediaObject: g, numStreams: v.spatialLayers }),
                            (_ = { type: 'offer', sdp: s.write(w) })),
                            u.debug('send() | calling pc.setLocalDescription() [offer:%o]', _),
                            await this._pc.setLocalDescription(_);
                        let y = f.mid ?? void 0;
                        if (
                            (y ||
                                u.warn(
                                    'send() | missing transceiver.mid (bug in react-native-webrtc, using a workaround',
                                ),
                            (p.mid = y),
                            (w = s.parse(this._pc.localDescription.sdp)),
                            (g = w.media[h.idx]),
                            (p.rtcp.cname = o.getCname({ offerMediaObject: g })),
                            t)
                        )
                            if (1 === t.length) {
                                let e = c.getRtpEncodings({ offerMediaObject: g });
                                Object.assign(e[0], t[0]), b && (e = [e[0]]), (p.encodings = e);
                            } else p.encodings = t;
                        else p.encodings = c.getRtpEncodings({ offerMediaObject: g });
                        if (
                            p.encodings.length > 1 &&
                            ('video/vp8' === p.codecs[0].mimeType.toLowerCase() ||
                                'video/h264' === p.codecs[0].mimeType.toLowerCase())
                        )
                            for (const e of p.encodings)
                                e.scalabilityMode
                                    ? (e.scalabilityMode = `L1T${v.temporalLayers}`)
                                    : (e.scalabilityMode = 'L1T3');
                        this._remoteSdp.send({
                            offerMediaObject: g,
                            reuseMid: h.reuseMid,
                            offerRtpParameters: p,
                            answerRtpParameters: l,
                            codecOptions: r,
                        });
                        const S = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            u.debug('send() | calling pc.setRemoteDescription() [answer:%o]', S),
                            await this._pc.setRemoteDescription(S),
                            y || ((y = f.mid), (p.mid = y)),
                            this._mapMidTransceiver.set(y, f),
                            { localId: y, rtpParameters: p, rtpSender: f.sender }
                        );
                    }
                    async stopSending(e) {
                        if ((this.assertSendDirection(), this._closed)) return;
                        u.debug('stopSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        if (
                            (t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.closeMediaSection(t.mid))
                        )
                            try {
                                t.stop();
                            } catch (e) {}
                        const r = await this._pc.createOffer();
                        u.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('pauseSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'inactive'), this._remoteSdp.pauseMediaSection(e);
                        const r = await this._pc.createOffer();
                        u.debug('pauseSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async resumeSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('resumeSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if ((this._remoteSdp.resumeSendingMediaSection(e), !t))
                            throw new Error('associated RTCRtpTransceiver not found');
                        t.direction = 'sendonly';
                        const r = await this._pc.createOffer();
                        u.debug('resumeSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            t
                                ? u.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : u.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        u.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % f.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                u.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            u.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            u.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        for (const t of e) {
                            const { trackId: e, onRtpReceiver: s } = t;
                            if (s) {
                                const t = r.get(e),
                                    i = this._pc.getTransceivers().find((e) => e.mid === t);
                                if (!i) throw new Error('transceiver not found');
                                s(i.receiver);
                            }
                        }
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: s } = t,
                                i = r.get(e),
                                a = n.media.find((e) => String(e.mid) === i);
                            o.applyCodecParameters({ offerRtpParameters: s, answerMediaObject: a });
                        }
                        (a = { type: 'answer', sdp: s.write(n) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: n,
                                })),
                            u.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if ((this.assertRecvDirection(), this._closed)) return;
                        for (const t of e) {
                            u.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('pauseReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'inactive'), this._remoteSdp.pauseMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('pauseReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('resumeReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'recvonly'), this._remoteSdp.resumeReceivingMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('resumeReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        u.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new p.InvalidStateError('method called in a closed handler');
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.ReactNativeUnifiedPlan = g;
            },
            4057: (e, t, r) => {
                e.exports = function (e) {
                    function t(e) {
                        let r,
                            i,
                            a,
                            n = null;
                        function o(...e) {
                            if (!o.enabled) return;
                            const s = o,
                                i = Number(new Date()),
                                a = i - (r || i);
                            (s.diff = a),
                                (s.prev = r),
                                (s.curr = i),
                                (r = i),
                                (e[0] = t.coerce(e[0])),
                                'string' != typeof e[0] && e.unshift('%O');
                            let n = 0;
                            (e[0] = e[0].replace(/%([a-zA-Z%])/g, (r, i) => {
                                if ('%%' === r) return '%';
                                n++;
                                const a = t.formatters[i];
                                if ('function' == typeof a) {
                                    const t = e[n];
                                    (r = a.call(s, t)), e.splice(n, 1), n--;
                                }
                                return r;
                            })),
                                t.formatArgs.call(s, e),
                                (s.log || t.log).apply(s, e);
                        }
                        return (
                            (o.namespace = e),
                            (o.useColors = t.useColors()),
                            (o.color = t.selectColor(e)),
                            (o.extend = s),
                            (o.destroy = t.destroy),
                            Object.defineProperty(o, 'enabled', {
                                enumerable: !0,
                                configurable: !1,
                                get: () =>
                                    null !== n
                                        ? n
                                        : (i !== t.namespaces && ((i = t.namespaces), (a = t.enabled(e))), a),
                                set: (e) => {
                                    n = e;
                                },
                            }),
                            'function' == typeof t.init && t.init(o),
                            o
                        );
                    }
                    function s(e, r) {
                        const s = t(this.namespace + (void 0 === r ? ':' : r) + e);
                        return (s.log = this.log), s;
                    }
                    function i(e, t) {
                        let r = 0,
                            s = 0,
                            i = -1,
                            a = 0;
                        for (; r < e.length; )
                            if (s < t.length && (t[s] === e[r] || '*' === t[s]))
                                '*' === t[s] ? ((i = s), (a = r), s++) : (r++, s++);
                            else {
                                if (-1 === i) return !1;
                                (s = i + 1), a++, (r = a);
                            }
                        for (; s < t.length && '*' === t[s]; ) s++;
                        return s === t.length;
                    }
                    return (
                        (t.debug = t),
                        (t.default = t),
                        (t.coerce = function (e) {
                            return e instanceof Error ? e.stack || e.message : e;
                        }),
                        (t.disable = function () {
                            const e = [...t.names, ...t.skips.map((e) => '-' + e)].join(',');
                            return t.enable(''), e;
                        }),
                        (t.enable = function (e) {
                            t.save(e), (t.namespaces = e), (t.names = []), (t.skips = []);
                            const r = ('string' == typeof e ? e : '')
                                .trim()
                                .replace(' ', ',')
                                .split(',')
                                .filter(Boolean);
                            for (const e of r) '-' === e[0] ? t.skips.push(e.slice(1)) : t.names.push(e);
                        }),
                        (t.enabled = function (e) {
                            for (const r of t.skips) if (i(e, r)) return !1;
                            for (const r of t.names) if (i(e, r)) return !0;
                            return !1;
                        }),
                        (t.humanize = r(7104)),
                        (t.destroy = function () {
                            console.warn(
                                'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
                            );
                        }),
                        Object.keys(e).forEach((r) => {
                            t[r] = e[r];
                        }),
                        (t.names = []),
                        (t.skips = []),
                        (t.formatters = {}),
                        (t.selectColor = function (e) {
                            let r = 0;
                            for (let t = 0; t < e.length; t++) (r = (r << 5) - r + e.charCodeAt(t)), (r |= 0);
                            return t.colors[Math.abs(r) % t.colors.length];
                        }),
                        t.enable(t.load()),
                        t
                    );
                };
            },
            4160: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 });
            },
            4253: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.AwaitQueueRemovedTaskError = t.AwaitQueueStoppedError = void 0);
                class r extends Error {
                    constructor(e) {
                        super(e ?? 'queue stopped'),
                            (this.name = 'AwaitQueueStoppedError'),
                            'function' == typeof Error.captureStackTrace && Error.captureStackTrace(this, r);
                    }
                }
                t.AwaitQueueStoppedError = r;
                class s extends Error {
                    constructor(e) {
                        super(e ?? 'queue task removed'),
                            (this.name = 'AwaitQueueRemovedTaskError'),
                            'function' == typeof Error.captureStackTrace && Error.captureStackTrace(this, s);
                    }
                }
                t.AwaitQueueRemovedTaskError = s;
            },
            4256: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.addNackSupportForOpus = function (e) {
                        for (const t of e.codecs ?? [])
                            ('audio/opus' !== t.mimeType.toLowerCase() &&
                                'audio/multiopus' !== t.mimeType.toLowerCase()) ||
                                t.rtcpFeedback?.some((e) => 'nack' === e.type && !e.parameter) ||
                                (t.rtcpFeedback || (t.rtcpFeedback = []), t.rtcpFeedback.push({ type: 'nack' }));
                    });
            },
            4271: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s = a(r(4604)),
                    i = a(r(3221));
                function a(e) {
                    return e && e.__esModule ? e : { default: e };
                }
                var n = (0, s.default)('v3', 48, i.default);
                t.default = n;
            },
            4496: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.getRtpEncodings = function ({ offerMediaObject: e, track: t }) {
                        let r;
                        const s = new Set();
                        for (const i of e.ssrcs ?? [])
                            if ('msid' === i.attribute && i.value.split(' ')[1] === t.id) {
                                const e = i.id;
                                s.add(e), r || (r = e);
                            }
                        if (0 === s.size)
                            throw new Error(`a=ssrc line with msid information not found [track.id:${t.id}]`);
                        const i = new Map();
                        for (const t of e.ssrcGroups ?? []) {
                            if ('FID' !== t.semantics) continue;
                            let [e, r] = t.ssrcs.split(/\s+/);
                            (e = Number(e)), (r = Number(r)), s.has(e) && (s.delete(e), s.delete(r), i.set(e, r));
                        }
                        for (const e of s) i.set(e, null);
                        const a = [];
                        for (const [e, t] of i) {
                            const r = { ssrc: e };
                            t && (r.rtx = { ssrc: t }), a.push(r);
                        }
                        return a;
                    }),
                    (t.addLegacySimulcast = function ({ offerMediaObject: e, track: t, numStreams: r }) {
                        if (r <= 1) throw new TypeError('numStreams must be greater than 1');
                        let s, i, a;
                        if (
                            !(e.ssrcs ?? []).find(
                                (e) =>
                                    'msid' === e.attribute &&
                                    e.value.split(' ')[1] === t.id &&
                                    ((s = e.id), (a = e.value.split(' ')[0]), !0),
                            )
                        )
                            throw new Error(`a=ssrc line with msid information not found [track.id:${t.id}]`);
                        (e.ssrcGroups ?? []).some((e) => {
                            if ('FID' !== e.semantics) return !1;
                            const t = e.ssrcs.split(/\s+/);
                            return Number(t[0]) === s && ((i = Number(t[1])), !0);
                        });
                        const n = e.ssrcs.find((e) => 'cname' === e.attribute && e.id === s);
                        if (!n) throw new Error(`a=ssrc line with cname information not found [track.id:${t.id}]`);
                        const o = n.value,
                            c = [],
                            d = [];
                        for (let e = 0; e < r; ++e) c.push(s + e), i && d.push(i + e);
                        (e.ssrcGroups = e.ssrcGroups ?? []),
                            (e.ssrcs = e.ssrcs ?? []),
                            e.ssrcGroups.push({ semantics: 'SIM', ssrcs: c.join(' ') });
                        for (const r of c)
                            e.ssrcs.push({ id: r, attribute: 'cname', value: o }),
                                e.ssrcs.push({ id: r, attribute: 'msid', value: `${a} ${t.id}` });
                        for (let r = 0; r < d.length; ++r) {
                            const s = c[r],
                                i = d[r];
                            e.ssrcs.push({ id: i, attribute: 'cname', value: o }),
                                e.ssrcs.push({ id: i, attribute: 'msid', value: `${a} ${t.id}` }),
                                e.ssrcGroups.push({ semantics: 'FID', ssrcs: `${s} ${i}` });
                        }
                    });
            },
            4604: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.URL = t.DNS = void 0),
                    (t.default = function (e, t, r) {
                        function s(e, s, n, o) {
                            var c;
                            if (
                                ('string' == typeof e &&
                                    (e = (function (e) {
                                        e = unescape(encodeURIComponent(e));
                                        const t = [];
                                        for (let r = 0; r < e.length; ++r) t.push(e.charCodeAt(r));
                                        return t;
                                    })(e)),
                                'string' == typeof s && (s = (0, a.default)(s)),
                                16 !== (null === (c = s) || void 0 === c ? void 0 : c.length))
                            )
                                throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
                            let d = new Uint8Array(16 + e.length);
                            if (
                                (d.set(s),
                                d.set(e, s.length),
                                (d = r(d)),
                                (d[6] = (15 & d[6]) | t),
                                (d[8] = (63 & d[8]) | 128),
                                n)
                            ) {
                                o = o || 0;
                                for (let e = 0; e < 16; ++e) n[o + e] = d[e];
                                return n;
                            }
                            return (0, i.unsafeStringify)(d);
                        }
                        try {
                            s.name = e;
                        } catch (e) {}
                        return (s.DNS = n), (s.URL = o), s;
                    });
                var s,
                    i = r(1131),
                    a = (s = r(6773)) && s.__esModule ? s : { default: s };
                const n = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
                t.DNS = n;
                const o = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
                t.URL = o;
            },
            4646: (e, t, r) => {
                (t.formatArgs = function (t) {
                    if (
                        ((t[0] =
                            (this.useColors ? '%c' : '') +
                            this.namespace +
                            (this.useColors ? ' %c' : ' ') +
                            t[0] +
                            (this.useColors ? '%c ' : ' ') +
                            '+' +
                            e.exports.humanize(this.diff)),
                        !this.useColors)
                    )
                        return;
                    const r = 'color: ' + this.color;
                    t.splice(1, 0, r, 'color: inherit');
                    let s = 0,
                        i = 0;
                    t[0].replace(/%[a-zA-Z%]/g, (e) => {
                        '%%' !== e && (s++, '%c' === e && (i = s));
                    }),
                        t.splice(i, 0, r);
                }),
                    (t.save = function (e) {
                        try {
                            e ? t.storage.setItem('debug', e) : t.storage.removeItem('debug');
                        } catch (e) {}
                    }),
                    (t.load = function () {
                        let e;
                        try {
                            e = t.storage.getItem('debug');
                        } catch (e) {}
                        return !e && 'undefined' != typeof process && 'env' in process && (e = process.env.DEBUG), e;
                    }),
                    (t.useColors = function () {
                        if (
                            'undefined' != typeof window &&
                            window.process &&
                            ('renderer' === window.process.type || window.process.__nwjs)
                        )
                            return !0;
                        if (
                            'undefined' != typeof navigator &&
                            navigator.userAgent &&
                            navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
                        )
                            return !1;
                        let e;
                        return (
                            ('undefined' != typeof document &&
                                document.documentElement &&
                                document.documentElement.style &&
                                document.documentElement.style.WebkitAppearance) ||
                            ('undefined' != typeof window &&
                                window.console &&
                                (window.console.firebug || (window.console.exception && window.console.table))) ||
                            ('undefined' != typeof navigator &&
                                navigator.userAgent &&
                                (e = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
                                parseInt(e[1], 10) >= 31) ||
                            ('undefined' != typeof navigator &&
                                navigator.userAgent &&
                                navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
                        );
                    }),
                    (t.storage = (function () {
                        try {
                            return localStorage;
                        } catch (e) {}
                    })()),
                    (t.destroy = (() => {
                        let e = !1;
                        return () => {
                            e ||
                                ((e = !0),
                                console.warn(
                                    'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
                                ));
                        };
                    })()),
                    (t.colors = [
                        '#0000CC',
                        '#0000FF',
                        '#0033CC',
                        '#0033FF',
                        '#0066CC',
                        '#0066FF',
                        '#0099CC',
                        '#0099FF',
                        '#00CC00',
                        '#00CC33',
                        '#00CC66',
                        '#00CC99',
                        '#00CCCC',
                        '#00CCFF',
                        '#3300CC',
                        '#3300FF',
                        '#3333CC',
                        '#3333FF',
                        '#3366CC',
                        '#3366FF',
                        '#3399CC',
                        '#3399FF',
                        '#33CC00',
                        '#33CC33',
                        '#33CC66',
                        '#33CC99',
                        '#33CCCC',
                        '#33CCFF',
                        '#6600CC',
                        '#6600FF',
                        '#6633CC',
                        '#6633FF',
                        '#66CC00',
                        '#66CC33',
                        '#9900CC',
                        '#9900FF',
                        '#9933CC',
                        '#9933FF',
                        '#99CC00',
                        '#99CC33',
                        '#CC0000',
                        '#CC0033',
                        '#CC0066',
                        '#CC0099',
                        '#CC00CC',
                        '#CC00FF',
                        '#CC3300',
                        '#CC3333',
                        '#CC3366',
                        '#CC3399',
                        '#CC33CC',
                        '#CC33FF',
                        '#CC6600',
                        '#CC6633',
                        '#CC9900',
                        '#CC9933',
                        '#CCCC00',
                        '#CCCC33',
                        '#FF0000',
                        '#FF0033',
                        '#FF0066',
                        '#FF0099',
                        '#FF00CC',
                        '#FF00FF',
                        '#FF3300',
                        '#FF3333',
                        '#FF3366',
                        '#FF3399',
                        '#FF33CC',
                        '#FF33FF',
                        '#FF6600',
                        '#FF6633',
                        '#FF9900',
                        '#FF9933',
                        '#FFCC00',
                        '#FFCC33',
                    ]),
                    (t.log = console.debug || console.log || (() => {})),
                    (e.exports = r(3385)(t));
                const { formatters: s } = e.exports;
                s.j = function (e) {
                    try {
                        return JSON.stringify(e);
                    } catch (e) {
                        return '[UnexpectedJSONParseError]: ' + e.message;
                    }
                };
            },
            4756: (e) => {
                var t = 1e3,
                    r = 60 * t,
                    s = 60 * r,
                    i = 24 * s,
                    a = 7 * i;
                function n(e, t, r, s) {
                    var i = t >= 1.5 * r;
                    return Math.round(e / r) + ' ' + s + (i ? 's' : '');
                }
                e.exports = function (e, o) {
                    o = o || {};
                    var c,
                        d,
                        p = typeof e;
                    if ('string' === p && e.length > 0)
                        return (function (e) {
                            if (!((e = String(e)).length > 100)) {
                                var n =
                                    /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
                                        e,
                                    );
                                if (n) {
                                    var o = parseFloat(n[1]);
                                    switch ((n[2] || 'ms').toLowerCase()) {
                                        case 'years':
                                        case 'year':
                                        case 'yrs':
                                        case 'yr':
                                        case 'y':
                                            return 315576e5 * o;
                                        case 'weeks':
                                        case 'week':
                                        case 'w':
                                            return o * a;
                                        case 'days':
                                        case 'day':
                                        case 'd':
                                            return o * i;
                                        case 'hours':
                                        case 'hour':
                                        case 'hrs':
                                        case 'hr':
                                        case 'h':
                                            return o * s;
                                        case 'minutes':
                                        case 'minute':
                                        case 'mins':
                                        case 'min':
                                        case 'm':
                                            return o * r;
                                        case 'seconds':
                                        case 'second':
                                        case 'secs':
                                        case 'sec':
                                        case 's':
                                            return o * t;
                                        case 'milliseconds':
                                        case 'millisecond':
                                        case 'msecs':
                                        case 'msec':
                                        case 'ms':
                                            return o;
                                        default:
                                            return;
                                    }
                                }
                            }
                        })(e);
                    if ('number' === p && isFinite(e))
                        return o.long
                            ? ((c = e),
                              (d = Math.abs(c)) >= i
                                  ? n(c, d, i, 'day')
                                  : d >= s
                                    ? n(c, d, s, 'hour')
                                    : d >= r
                                      ? n(c, d, r, 'minute')
                                      : d >= t
                                        ? n(c, d, t, 'second')
                                        : c + ' ms')
                            : (function (e) {
                                  var a = Math.abs(e);
                                  return a >= i
                                      ? Math.round(e / i) + 'd'
                                      : a >= s
                                        ? Math.round(e / s) + 'h'
                                        : a >= r
                                          ? Math.round(e / r) + 'm'
                                          : a >= t
                                            ? Math.round(e / t) + 's'
                                            : e + 'ms';
                              })(e);
                    throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(e));
                };
            },
            4893: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.InvalidStateError = t.UnsupportedError = void 0);
                class r extends Error {
                    constructor(e) {
                        super(e),
                            (this.name = 'UnsupportedError'),
                            Error.hasOwnProperty('captureStackTrace')
                                ? Error.captureStackTrace(this, r)
                                : (this.stack = new Error(e).stack);
                    }
                }
                t.UnsupportedError = r;
                class s extends Error {
                    constructor(e) {
                        super(e),
                            (this.name = 'InvalidStateError'),
                            Error.hasOwnProperty('captureStackTrace')
                                ? Error.captureStackTrace(this, s)
                                : (this.stack = new Error(e).stack);
                    }
                }
                t.InvalidStateError = s;
            },
            5020: (e, t, r) => {
                var s = function (e) {
                        return String(Number(e)) === e ? Number(e) : e;
                    },
                    i = function (e, t, r) {
                        var i = e.name && e.names;
                        e.push && !t[e.push] ? (t[e.push] = []) : i && !t[e.name] && (t[e.name] = {});
                        var a = e.push ? {} : i ? t[e.name] : t;
                        !(function (e, t, r, i) {
                            if (i && !r) t[i] = s(e[1]);
                            else for (var a = 0; a < r.length; a += 1) null != e[a + 1] && (t[r[a]] = s(e[a + 1]));
                        })(r.match(e.reg), a, e.names, e.name),
                            e.push && t[e.push].push(a);
                    },
                    a = r(5602),
                    n = RegExp.prototype.test.bind(/^([a-z])=(.*)/);
                t.parse = function (e) {
                    var t = {},
                        r = [],
                        s = t;
                    return (
                        e
                            .split(/(\r\n|\r|\n)/)
                            .filter(n)
                            .forEach(function (e) {
                                var t = e[0],
                                    n = e.slice(2);
                                'm' === t && (r.push({ rtp: [], fmtp: [] }), (s = r[r.length - 1]));
                                for (var o = 0; o < (a[t] || []).length; o += 1) {
                                    var c = a[t][o];
                                    if (c.reg.test(n)) return i(c, s, n);
                                }
                            }),
                        (t.media = r),
                        t
                    );
                };
                var o = function (e, t) {
                    var r = t.split(/=(.+)/, 2);
                    return (
                        2 === r.length ? (e[r[0]] = s(r[1])) : 1 === r.length && t.length > 1 && (e[r[0]] = void 0), e
                    );
                };
                (t.parseParams = function (e) {
                    return e.split(/;\s?/).reduce(o, {});
                }),
                    (t.parseFmtpConfig = t.parseParams),
                    (t.parsePayloads = function (e) {
                        return e.toString().split(' ').map(Number);
                    }),
                    (t.parseRemoteCandidates = function (e) {
                        for (var t = [], r = e.split(' ').map(s), i = 0; i < r.length; i += 3)
                            t.push({ component: r[i], ip: r[i + 1], port: r[i + 2] });
                        return t;
                    }),
                    (t.parseImageAttributes = function (e) {
                        return e.split(' ').map(function (e) {
                            return e
                                .substring(1, e.length - 1)
                                .split(',')
                                .reduce(o, {});
                        });
                    }),
                    (t.parseSimulcastStreamList = function (e) {
                        return e.split(';').map(function (e) {
                            return e.split(',').map(function (e) {
                                var t,
                                    r = !1;
                                return (
                                    '~' !== e[0] ? (t = s(e)) : ((t = s(e.substring(1, e.length))), (r = !0)),
                                    { scid: t, paused: r }
                                );
                            });
                        });
                    });
            },
            5105: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s,
                    i = (s = r(3907)) && s.__esModule ? s : { default: s },
                    a = r(1131);
                let n,
                    o,
                    c = 0,
                    d = 0;
                t.default = function (e, t, r) {
                    let s = (t && r) || 0;
                    const p = t || new Array(16);
                    let l = (e = e || {}).node || n,
                        h = void 0 !== e.clockseq ? e.clockseq : o;
                    if (null == l || null == h) {
                        const t = e.random || (e.rng || i.default)();
                        null == l && (l = n = [1 | t[0], t[1], t[2], t[3], t[4], t[5]]),
                            null == h && (h = o = 16383 & ((t[6] << 8) | t[7]));
                    }
                    let m = void 0 !== e.msecs ? e.msecs : Date.now(),
                        u = void 0 !== e.nsecs ? e.nsecs : d + 1;
                    const f = m - c + (u - d) / 1e4;
                    if (
                        (f < 0 && void 0 === e.clockseq && (h = (h + 1) & 16383),
                        (f < 0 || m > c) && void 0 === e.nsecs && (u = 0),
                        u >= 1e4)
                    )
                        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
                    (c = m), (d = u), (o = h), (m += 122192928e5);
                    const g = (1e4 * (268435455 & m) + u) % 4294967296;
                    (p[s++] = (g >>> 24) & 255),
                        (p[s++] = (g >>> 16) & 255),
                        (p[s++] = (g >>> 8) & 255),
                        (p[s++] = 255 & g);
                    const _ = ((m / 4294967296) * 1e4) & 268435455;
                    (p[s++] = (_ >>> 8) & 255),
                        (p[s++] = 255 & _),
                        (p[s++] = ((_ >>> 24) & 15) | 16),
                        (p[s++] = (_ >>> 16) & 255),
                        (p[s++] = (h >>> 8) | 128),
                        (p[s++] = 255 & h);
                    for (let e = 0; e < 6; ++e) p[s + e] = l[e];
                    return t || (0, a.unsafeStringify)(p);
                };
            },
            5158: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, 'v4', {
                    enumerable: !0,
                    get: function () {
                        return s.default;
                    },
                });
                i(r(5105)), i(r(4271));
                var s = i(r(1966));
                i(r(1885)), i(r(8729)), i(r(5362)), i(r(9874)), i(r(1131)), i(r(6773));
                function i(e) {
                    return e && e.__esModule ? e : { default: e };
                }
            },
            5248: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.generateRouterRtpCapabilities = function () {
                        return s.deepFreeze({
                            codecs: [
                                {
                                    mimeType: 'audio/opus',
                                    kind: 'audio',
                                    preferredPayloadType: 100,
                                    clockRate: 48e3,
                                    channels: 2,
                                    rtcpFeedback: [{ type: 'transport-cc' }],
                                    parameters: { useinbandfec: 1, foo: 'bar' },
                                },
                                {
                                    mimeType: 'video/VP8',
                                    kind: 'video',
                                    preferredPayloadType: 101,
                                    clockRate: 9e4,
                                    rtcpFeedback: [
                                        { type: 'nack' },
                                        { type: 'nack', parameter: 'pli' },
                                        { type: 'ccm', parameter: 'fir' },
                                        { type: 'goog-remb' },
                                        { type: 'transport-cc' },
                                    ],
                                    parameters: { 'x-google-start-bitrate': 1500 },
                                },
                                {
                                    mimeType: 'video/rtx',
                                    kind: 'video',
                                    preferredPayloadType: 102,
                                    clockRate: 9e4,
                                    rtcpFeedback: [],
                                    parameters: { apt: 101 },
                                },
                                {
                                    mimeType: 'video/H264',
                                    kind: 'video',
                                    preferredPayloadType: 103,
                                    clockRate: 9e4,
                                    rtcpFeedback: [
                                        { type: 'nack' },
                                        { type: 'nack', parameter: 'pli' },
                                        { type: 'ccm', parameter: 'fir' },
                                        { type: 'goog-remb' },
                                        { type: 'transport-cc' },
                                    ],
                                    parameters: {
                                        'level-asymmetry-allowed': 1,
                                        'packetization-mode': 1,
                                        'profile-level-id': '42e01f',
                                    },
                                },
                                {
                                    mimeType: 'video/rtx',
                                    kind: 'video',
                                    preferredPayloadType: 104,
                                    clockRate: 9e4,
                                    rtcpFeedback: [],
                                    parameters: { apt: 103 },
                                },
                            ],
                            headerExtensions: [
                                {
                                    kind: 'audio',
                                    uri: 'urn:ietf:params:rtp-hdrext:sdes:mid',
                                    preferredId: 1,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'urn:ietf:params:rtp-hdrext:sdes:mid',
                                    preferredId: 1,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id',
                                    preferredId: 2,
                                    preferredEncrypt: !1,
                                    direction: 'recvonly',
                                },
                                {
                                    kind: 'video',
                                    uri: 'urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id',
                                    preferredId: 3,
                                    preferredEncrypt: !1,
                                    direction: 'recvonly',
                                },
                                {
                                    kind: 'audio',
                                    uri: 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
                                    preferredId: 4,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
                                    preferredId: 4,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'audio',
                                    uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                    preferredId: 5,
                                    preferredEncrypt: !1,
                                    direction: 'recvonly',
                                },
                                {
                                    kind: 'video',
                                    uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                    preferredId: 5,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'http://tools.ietf.org/html/draft-ietf-avtext-framemarking-07',
                                    preferredId: 6,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'urn:ietf:params:rtp-hdrext:framemarking',
                                    preferredId: 7,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'audio',
                                    uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
                                    preferredId: 10,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'urn:3gpp:video-orientation',
                                    preferredId: 11,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                                {
                                    kind: 'video',
                                    uri: 'urn:ietf:params:rtp-hdrext:toffset',
                                    preferredId: 12,
                                    preferredEncrypt: !1,
                                    direction: 'sendrecv',
                                },
                            ],
                        });
                    }),
                    (t.generateNativeRtpCapabilities = function () {
                        return s.deepFreeze({
                            codecs: [
                                {
                                    mimeType: 'audio/opus',
                                    kind: 'audio',
                                    preferredPayloadType: 111,
                                    clockRate: 48e3,
                                    channels: 2,
                                    rtcpFeedback: [{ type: 'transport-cc' }],
                                    parameters: { minptime: 10, useinbandfec: 1 },
                                },
                                {
                                    mimeType: 'audio/ISAC',
                                    kind: 'audio',
                                    preferredPayloadType: 103,
                                    clockRate: 16e3,
                                    channels: 1,
                                    rtcpFeedback: [{ type: 'transport-cc' }],
                                    parameters: {},
                                },
                                {
                                    mimeType: 'audio/CN',
                                    kind: 'audio',
                                    preferredPayloadType: 106,
                                    clockRate: 32e3,
                                    channels: 1,
                                    rtcpFeedback: [{ type: 'transport-cc' }],
                                    parameters: {},
                                },
                                {
                                    mimeType: 'video/VP8',
                                    kind: 'video',
                                    preferredPayloadType: 96,
                                    clockRate: 9e4,
                                    rtcpFeedback: [
                                        { type: 'goog-remb' },
                                        { type: 'transport-cc' },
                                        { type: 'ccm', parameter: 'fir' },
                                        { type: 'nack' },
                                        { type: 'nack', parameter: 'pli' },
                                    ],
                                    parameters: { baz: '1234abcd' },
                                },
                                {
                                    mimeType: 'video/rtx',
                                    kind: 'video',
                                    preferredPayloadType: 97,
                                    clockRate: 9e4,
                                    rtcpFeedback: [],
                                    parameters: { apt: 96 },
                                },
                            ],
                            headerExtensions: [
                                { kind: 'audio', uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', preferredId: 1 },
                                { kind: 'video', uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', preferredId: 1 },
                                { kind: 'video', uri: 'urn:ietf:params:rtp-hdrext:toffset', preferredId: 2 },
                                {
                                    kind: 'video',
                                    uri: 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
                                    preferredId: 3,
                                },
                                { kind: 'video', uri: 'urn:3gpp:video-orientation', preferredId: 4 },
                                {
                                    kind: 'video',
                                    uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                    preferredId: 5,
                                },
                                {
                                    kind: 'video',
                                    uri: 'http://www.webrtc.org/experiments/rtp-hdrext/playout-delay',
                                    preferredId: 6,
                                },
                                {
                                    kind: 'video',
                                    uri: 'http://www.webrtc.org/experiments/rtp-hdrext/video-content-type',
                                    preferredId: 7,
                                },
                                {
                                    kind: 'video',
                                    uri: 'http://www.webrtc.org/experiments/rtp-hdrext/video-timing',
                                    preferredId: 8,
                                },
                                { kind: 'audio', uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level', preferredId: 10 },
                            ],
                        });
                    }),
                    (t.generateNativeSctpCapabilities = function () {
                        return s.deepFreeze({ numStreams: { OS: 2048, MIS: 2048 } });
                    }),
                    (t.generateLocalDtlsParameters = function () {
                        return s.deepFreeze({
                            fingerprints: [
                                {
                                    algorithm: 'sha-256',
                                    value: '82:5A:68:3D:36:C3:0A:DE:AF:E7:32:43:D2:88:83:57:AC:2D:65:E5:80:C4:B6:FB:AF:1A:A0:21:9F:6D:0C:AD',
                                },
                            ],
                            role: 'auto',
                        });
                    }),
                    (t.generateTransportRemoteParameters = function () {
                        return {
                            id: i(),
                            iceParameters: s.deepFreeze({
                                iceLite: !0,
                                password: 'yku5ej8nvfaor28lvtrabcx0wkrpkztz',
                                usernameFragment: 'h3hk1iz6qqlnqlne',
                            }),
                            iceCandidates: s.deepFreeze([
                                {
                                    foundation: 'udpcandidate',
                                    address: '9.9.9.9',
                                    ip: '9.9.9.9',
                                    port: 40533,
                                    priority: 1078862079,
                                    protocol: 'udp',
                                    type: 'host',
                                    tcpType: 'passive',
                                },
                                {
                                    foundation: 'udpcandidate',
                                    address: '9.9.9.9',
                                    ip: '9:9:9:9:9:9',
                                    port: 41333,
                                    priority: 1078862089,
                                    protocol: 'udp',
                                    type: 'host',
                                    tcpType: 'passive',
                                },
                            ]),
                            dtlsParameters: s.deepFreeze({
                                fingerprints: [
                                    {
                                        algorithm: 'sha-256',
                                        value: 'A9:F4:E0:D2:74:D3:0F:D9:CA:A5:2F:9F:7F:47:FA:F0:C4:72:DD:73:49:D0:3B:14:90:20:51:30:1B:90:8E:71',
                                    },
                                    {
                                        algorithm: 'sha-384',
                                        value: '03:D9:0B:87:13:98:F6:6D:BC:FC:92:2E:39:D4:E1:97:32:61:30:56:84:70:81:6E:D1:82:97:EA:D9:C1:21:0F:6B:C5:E7:7F:E1:97:0C:17:97:6E:CF:B3:EF:2E:74:B0',
                                    },
                                    {
                                        algorithm: 'sha-512',
                                        value: '84:27:A4:28:A4:73:AF:43:02:2A:44:68:FF:2F:29:5C:3B:11:9A:60:F4:A8:F0:F5:AC:A0:E3:49:3E:B1:34:53:A9:85:CE:51:9B:ED:87:5E:B8:F4:8E:3D:FA:20:51:B8:96:EE:DA:56:DC:2F:5C:62:79:15:23:E0:21:82:2B:2C',
                                    },
                                ],
                                role: 'auto',
                            }),
                            sctpParameters: s.deepFreeze({ port: 5e3, OS: 2048, MIS: 2048, maxMessageSize: 2e6 }),
                        };
                    }),
                    (t.generateProducerRemoteParameters = function () {
                        return s.deepFreeze({ id: i() });
                    }),
                    (t.generateConsumerRemoteParameters = function ({ id: e, codecMimeType: t } = {}) {
                        switch (t) {
                            case 'audio/opus':
                                return {
                                    id: e ?? i(),
                                    producerId: i(),
                                    kind: 'audio',
                                    rtpParameters: s.deepFreeze({
                                        codecs: [
                                            {
                                                mimeType: 'audio/opus',
                                                payloadType: 100,
                                                clockRate: 48e3,
                                                channels: 2,
                                                rtcpFeedback: [{ type: 'transport-cc' }],
                                                parameters: { useinbandfec: 1, foo: 'bar' },
                                            },
                                        ],
                                        encodings: [{ ssrc: 46687003 }],
                                        headerExtensions: [
                                            { uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 },
                                            {
                                                uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                                id: 5,
                                            },
                                            { uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level', id: 10 },
                                        ],
                                        rtcp: { cname: 'wB4Ql4lrsxYLjzuN', reducedSize: !0, mux: !0 },
                                    }),
                                };
                            case 'audio/ISAC':
                                return {
                                    id: e ?? i(),
                                    producerId: i(),
                                    kind: 'audio',
                                    rtpParameters: s.deepFreeze({
                                        codecs: [
                                            {
                                                mimeType: 'audio/ISAC',
                                                payloadType: 111,
                                                clockRate: 16e3,
                                                channels: 1,
                                                rtcpFeedback: [{ type: 'transport-cc' }],
                                                parameters: {},
                                            },
                                        ],
                                        encodings: [{ ssrc: 46687004 }],
                                        headerExtensions: [
                                            { uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 },
                                            {
                                                uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                                id: 5,
                                            },
                                        ],
                                        rtcp: { cname: 'wB4Ql4lrsxYLjzuN', reducedSize: !0, mux: !0 },
                                    }),
                                };
                            case 'video/VP8':
                                return {
                                    id: e ?? i(),
                                    producerId: i(),
                                    kind: 'video',
                                    rtpParameters: s.deepFreeze({
                                        codecs: [
                                            {
                                                mimeType: 'video/VP8',
                                                payloadType: 101,
                                                clockRate: 9e4,
                                                rtcpFeedback: [
                                                    { type: 'nack' },
                                                    { type: 'nack', parameter: 'pli' },
                                                    { type: 'ccm', parameter: 'fir' },
                                                    { type: 'goog-remb' },
                                                    { type: 'transport-cc' },
                                                ],
                                                parameters: { 'x-google-start-bitrate': 1500 },
                                            },
                                            {
                                                mimeType: 'video/rtx',
                                                payloadType: 102,
                                                clockRate: 9e4,
                                                rtcpFeedback: [],
                                                parameters: { apt: 101 },
                                            },
                                        ],
                                        encodings: [{ ssrc: 99991111, rtx: { ssrc: 99991112 } }],
                                        headerExtensions: [
                                            { uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 },
                                            {
                                                uri: 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
                                                id: 4,
                                            },
                                            {
                                                uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                                id: 5,
                                            },
                                            { uri: 'urn:3gpp:video-orientation', id: 11 },
                                            { uri: 'urn:ietf:params:rtp-hdrext:toffset', id: 12 },
                                        ],
                                        rtcp: { cname: 'wB4Ql4lrsxYLjzuN', reducedSize: !0, mux: !0 },
                                    }),
                                };
                            case 'video/H264':
                                return {
                                    id: e ?? i(),
                                    producerId: i(),
                                    kind: 'video',
                                    rtpParameters: s.deepFreeze({
                                        codecs: [
                                            {
                                                mimeType: 'video/H264',
                                                payloadType: 103,
                                                clockRate: 9e4,
                                                rtcpFeedback: [
                                                    { type: 'nack' },
                                                    { type: 'nack', parameter: 'pli' },
                                                    { type: 'ccm', parameter: 'fir' },
                                                    { type: 'goog-remb' },
                                                    { type: 'transport-cc' },
                                                ],
                                                parameters: {
                                                    'level-asymmetry-allowed': 1,
                                                    'packetization-mode': 1,
                                                    'profile-level-id': '42e01f',
                                                },
                                            },
                                            {
                                                mimeType: 'video/rtx',
                                                payloadType: 104,
                                                clockRate: 9e4,
                                                rtcpFeedback: [],
                                                parameters: { apt: 103 },
                                            },
                                        ],
                                        encodings: [{ ssrc: 99991113, rtx: { ssrc: 99991114 } }],
                                        headerExtensions: [
                                            { uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 },
                                            {
                                                uri: 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
                                                id: 4,
                                            },
                                            {
                                                uri: 'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01',
                                                id: 5,
                                            },
                                            { uri: 'urn:3gpp:video-orientation', id: 11 },
                                            { uri: 'urn:ietf:params:rtp-hdrext:toffset', id: 12 },
                                        ],
                                        rtcp: { cname: 'wB4Ql4lrsxYLjzuN', reducedSize: !0, mux: !0 },
                                    }),
                                };
                            default:
                                throw new TypeError(`unknown codecMimeType '${t}'`);
                        }
                    }),
                    (t.generateDataProducerRemoteParameters = function () {
                        return s.deepFreeze({ id: i() });
                    }),
                    (t.generateDataConsumerRemoteParameters = function ({ id: e } = {}) {
                        return {
                            id: e ?? i(),
                            dataProducerId: i(),
                            sctpStreamParameters: s.deepFreeze({
                                streamId: 666,
                                maxPacketLifeTime: 5e3,
                                maxRetransmits: void 0,
                            }),
                        };
                    });
                const s = r(1765);
                function i() {
                    return String(s.generateRandomNumber());
                }
            },
            5321: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.default = void 0),
                    (t.default =
                        /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i);
            },
            5362: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s,
                    i = (s = r(9874)) && s.__esModule ? s : { default: s };
                t.default = function (e) {
                    if (!(0, i.default)(e)) throw TypeError('Invalid UUID');
                    return parseInt(e.slice(14, 15), 16);
                };
            },
            5370: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 });
            },
            5476: (e, t, r) => {
                const { EventTarget: s, defineEventAttribute: i } = r(1599),
                    a = r(5158).v4;
                class n extends s {
                    constructor({
                        kind: e,
                        id: t,
                        label: r,
                        isolated: s,
                        muted: i,
                        readyState: n,
                        constraints: o,
                        data: c,
                    } = {}) {
                        if ((super(), !e)) throw new TypeError('missing kind');
                        (this._id = t || a()),
                            (this._kind = e),
                            (this._label = r || ''),
                            (this._isolated = s || !1),
                            (this._enabled = !0),
                            (this._muted = i || !1),
                            (this._readyState = n || 'live'),
                            (this._constraints = o || {}),
                            (this._data = c || {});
                    }
                    get id() {
                        return this._id;
                    }
                    get kind() {
                        return this._kind;
                    }
                    get label() {
                        return this._label;
                    }
                    get isolated() {
                        return this._isolated;
                    }
                    get enabled() {
                        return this._enabled;
                    }
                    set enabled(e) {
                        const t = this._enabled !== e;
                        (this._enabled = e), t && this.dispatchEvent({ type: '@enabledchange' });
                    }
                    get muted() {
                        return this._muted;
                    }
                    get readyState() {
                        return this._readyState;
                    }
                    get data() {
                        return this._data;
                    }
                    set data(e) {
                        throw new TypeError('cannot replace data object');
                    }
                    clone({ id: e, data: t } = {}) {
                        return new n({
                            id: e || a(),
                            kind: this._kind,
                            label: this._label,
                            isolated: this._isolated,
                            enabled: this._enabled,
                            muted: this._muted,
                            readyState: this._readyState,
                            constraints: this._constraints,
                            data: void 0 !== t ? t : this._data,
                        });
                    }
                    stop() {
                        'ended' !== this._readyState &&
                            ((this._readyState = 'ended'), this.dispatchEvent({ type: '@stop' }));
                    }
                    getConstraints() {
                        return this._constraints;
                    }
                    applyConstraints(e) {
                        'ended' !== this._readyState && (this._constraints = e);
                    }
                    remoteStop() {
                        'ended' !== this._readyState &&
                            ((this._readyState = 'ended'),
                            this.dispatchEvent({ type: '@stop' }),
                            this.dispatchEvent({ type: 'ended' }));
                    }
                    remoteMute() {
                        this._muted || ((this._muted = !0), this.dispatchEvent({ type: 'mute' }));
                    }
                    remoteUnmute() {
                        this._muted && ((this._muted = !1), this.dispatchEvent({ type: 'unmute' }));
                    }
                }
                i(n.prototype, 'ended'),
                    i(n.prototype, 'mute'),
                    i(n.prototype, 'unmute'),
                    i(n.prototype, '@enabledchange'),
                    i(n.prototype, '@stop'),
                    i(n.prototype, 'isolationchange'),
                    i(n.prototype, 'overconstrained'),
                    (t.FakeMediaStreamTrack = n);
            },
            5535: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Chrome70 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(5938),
                    d = r(521),
                    p = r(1305),
                    l = r(3303),
                    h = new i.Logger('Chrome70'),
                    m = { OS: 1024, MIS: 1024 };
                class u extends d.HandlerInterface {
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new u();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Chrome70';
                    }
                    close() {
                        if ((h.debug('close()'), this._pc))
                            try {
                                this._pc.close();
                            } catch (e) {}
                        this.emit('@close');
                    }
                    async getNativeRtpCapabilities() {
                        h.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'unified-plan',
                        });
                        try {
                            e.addTransceiver('audio'), e.addTransceiver('video');
                            const t = await e.createOffer();
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp);
                            return o.extractRtpCapabilities({ sdpObject: r });
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return h.debug('getNativeSctpCapabilities()'), { numStreams: m };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: l,
                    }) {
                        h.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new p.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', l),
                                video: n.getSendingRtpParameters('video', l),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', l),
                                video: n.getSendingRemoteRtpParameters('video', l),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'unified-plan',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (h.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        h.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if ((h.debug('restartIce()'), this._remoteSdp.updateIceParameters(e), this._transportReady))
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                h.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                h.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                h.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                h.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertSendDirection(), h.debug('send() [kind:%s, track.id:%s]', e.kind, e.id);
                        const d = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        d.codecs = n.reduceCodecs(d.codecs, i);
                        const p = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        p.codecs = n.reduceCodecs(p.codecs, i);
                        const m = this._remoteSdp.getNextMediaSectionIdx(),
                            u = this._pc.addTransceiver(e, { direction: 'sendonly', streams: [this._sendStream] });
                        let f,
                            g = await this._pc.createOffer(),
                            _ = s.parse(g.sdp);
                        _.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: _,
                                })),
                            t &&
                                t.length > 1 &&
                                (h.debug('send() | enabling legacy simulcast'),
                                (_ = s.parse(g.sdp)),
                                (f = _.media[m.idx]),
                                c.addLegacySimulcast({ offerMediaObject: f, numStreams: t.length }),
                                (g = { type: 'offer', sdp: s.write(_) }));
                        let w = !1;
                        const b = (0, l.parse)((t ?? [{}])[0].scalabilityMode);
                        if (
                            (t &&
                                1 === t.length &&
                                b.spatialLayers > 1 &&
                                'video/vp9' === d.codecs[0].mimeType.toLowerCase() &&
                                (h.debug('send() | enabling legacy simulcast for VP9 SVC'),
                                (w = !0),
                                (_ = s.parse(g.sdp)),
                                (f = _.media[m.idx]),
                                c.addLegacySimulcast({ offerMediaObject: f, numStreams: b.spatialLayers }),
                                (g = { type: 'offer', sdp: s.write(_) })),
                            h.debug('send() | calling pc.setLocalDescription() [offer:%o]', g),
                            await this._pc.setLocalDescription(g),
                            t)
                        ) {
                            h.debug('send() | applying given encodings');
                            const e = u.sender.getParameters();
                            for (let r = 0; r < (e.encodings ?? []).length; ++r) {
                                const s = e.encodings[r],
                                    i = t[r];
                                if (!i) break;
                                e.encodings[r] = Object.assign(s, i);
                            }
                            await u.sender.setParameters(e);
                        }
                        const v = u.mid;
                        if (
                            ((d.mid = v),
                            (_ = s.parse(this._pc.localDescription.sdp)),
                            (f = _.media[m.idx]),
                            (d.rtcp.cname = o.getCname({ offerMediaObject: f })),
                            (d.encodings = c.getRtpEncodings({ offerMediaObject: f })),
                            t)
                        )
                            for (let e = 0; e < d.encodings.length; ++e) t[e] && Object.assign(d.encodings[e], t[e]);
                        if (
                            (w && (d.encodings = [d.encodings[0]]),
                            d.encodings.length > 1 &&
                                ('video/vp8' === d.codecs[0].mimeType.toLowerCase() ||
                                    'video/h264' === d.codecs[0].mimeType.toLowerCase()))
                        )
                            for (const e of d.encodings) e.scalabilityMode = 'L1T3';
                        this._remoteSdp.send({
                            offerMediaObject: f,
                            reuseMid: m.reuseMid,
                            offerRtpParameters: d,
                            answerRtpParameters: p,
                            codecOptions: r,
                        });
                        const y = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            h.debug('send() | calling pc.setRemoteDescription() [answer:%o]', y),
                            await this._pc.setRemoteDescription(y),
                            this._mapMidTransceiver.set(v, u),
                            { localId: v, rtpParameters: d, rtpSender: u.sender }
                        );
                    }
                    async stopSending(e) {
                        this.assertSendDirection(), h.debug('stopSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        if (
                            (t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.closeMediaSection(t.mid))
                        )
                            try {
                                t.stop();
                            } catch (e) {}
                        const r = await this._pc.createOffer();
                        h.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {}
                    async resumeSending(e) {}
                    async replaceTrack(e, t) {
                        this.assertSendDirection(),
                            t
                                ? h.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : h.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertSendDirection(), h.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        h.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertSendDirection(), h.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        h.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmitTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        h.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % m.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                h.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            h.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            h.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        h.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: s } = t,
                                i = r.get(e),
                                a = n.media.find((e) => String(e.mid) === i);
                            o.applyCodecParameters({ offerRtpParameters: s, answerMediaObject: a });
                        }
                        (a = { type: 'answer', sdp: s.write(n) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: n,
                                })),
                            h.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        this.assertRecvDirection();
                        for (const t of e) {
                            h.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        h.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        h.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {}
                    async resumeReceiving(e) {}
                    async getReceiverStats(e) {
                        this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmitTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        h.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            h.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            h.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Chrome70 = u;
            },
            5544: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.extractRtpCapabilities = function ({ sdpObject: e }) {
                        const t = new Map(),
                            r = [];
                        let i = !1,
                            a = !1;
                        for (const n of e.media) {
                            const e = n.type;
                            switch (e) {
                                case 'audio':
                                    if (i) continue;
                                    i = !0;
                                    break;
                                case 'video':
                                    if (a) continue;
                                    a = !0;
                                    break;
                                default:
                                    continue;
                            }
                            for (const r of n.rtp) {
                                const s = {
                                    kind: e,
                                    mimeType: `${e}/${r.codec}`,
                                    preferredPayloadType: r.payload,
                                    clockRate: r.rate,
                                    channels: r.encoding,
                                    parameters: {},
                                    rtcpFeedback: [],
                                };
                                t.set(s.preferredPayloadType, s);
                            }
                            for (const e of n.fmtp ?? []) {
                                const r = s.parseParams(e.config),
                                    i = t.get(e.payload);
                                i &&
                                    (r?.hasOwnProperty('profile-level-id') &&
                                        (r['profile-level-id'] = String(r['profile-level-id'])),
                                    (i.parameters = r));
                            }
                            for (const r of n.rtcpFb ?? []) {
                                const s = { type: r.type, parameter: r.subtype };
                                if ((s.parameter || delete s.parameter, '*' !== r.payload)) {
                                    const e = t.get(r.payload);
                                    if (!e) continue;
                                    e.rtcpFeedback.push(s);
                                } else
                                    for (const r of t.values())
                                        r.kind !== e || /.+\/rtx$/i.test(r.mimeType) || r.rtcpFeedback.push(s);
                            }
                            for (const t of n.ext ?? []) {
                                if (t['encrypt-uri']) continue;
                                const s = { kind: e, uri: t.uri, preferredId: t.value };
                                r.push(s);
                            }
                        }
                        return { codecs: Array.from(t.values()), headerExtensions: r };
                    }),
                    (t.extractDtlsParameters = function ({ sdpObject: e }) {
                        let t,
                            r = e.setup,
                            s = e.fingerprint;
                        if (!r || !s) {
                            const t = (e.media ?? []).find((e) => 0 !== e.port);
                            t && ((r ??= t.setup), (s ??= t.fingerprint));
                        }
                        if (!r) throw new Error('no a=setup found at SDP session or media level');
                        if (!s) throw new Error('no a=fingerprint found at SDP session or media level');
                        switch (r) {
                            case 'active':
                                t = 'client';
                                break;
                            case 'passive':
                                t = 'server';
                                break;
                            case 'actpass':
                                t = 'auto';
                        }
                        return { role: t, fingerprints: [{ algorithm: s.type, value: s.hash }] };
                    }),
                    (t.getCname = function ({ offerMediaObject: e }) {
                        const t = (e.ssrcs ?? []).find((e) => 'cname' === e.attribute);
                        return t ? t.value : '';
                    }),
                    (t.applyCodecParameters = function ({ offerRtpParameters: e, answerMediaObject: t }) {
                        for (const r of e.codecs) {
                            const e = r.mimeType.toLowerCase();
                            if ('audio/opus' !== e) continue;
                            if (!(t.rtp ?? []).find((e) => e.payload === r.payloadType)) continue;
                            t.fmtp = t.fmtp ?? [];
                            let i = t.fmtp.find((e) => e.payload === r.payloadType);
                            i || ((i = { payload: r.payloadType, config: '' }), t.fmtp.push(i));
                            const a = s.parseParams(i.config);
                            switch (e) {
                                case 'audio/opus': {
                                    const e = r.parameters['sprop-stereo'];
                                    void 0 !== e && (a.stereo = Number(e) ? 1 : 0);
                                    break;
                                }
                            }
                            i.config = '';
                            for (const e of Object.keys(a)) i.config && (i.config += ';'), (i.config += `${e}=${a[e]}`);
                        }
                    });
                const s = r(7363);
            },
            5601: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Transport = void 0);
                const s = r(8876),
                    i = r(2994),
                    a = r(3953),
                    n = r(4893),
                    o = r(1765),
                    c = r(8046),
                    d = r(9792),
                    p = r(3518),
                    l = r(7504),
                    h = r(9166),
                    m = new i.Logger('Transport');
                class u {
                    consumerOptions;
                    promise;
                    resolve;
                    reject;
                    constructor(e) {
                        (this.consumerOptions = e),
                            (this.promise = new Promise((e, t) => {
                                (this.resolve = e), (this.reject = t);
                            }));
                    }
                }
                class f extends a.EnhancedEventEmitter {
                    _id;
                    _closed = !1;
                    _direction;
                    _extendedRtpCapabilities;
                    _canProduceByKind;
                    _maxSctpMessageSize;
                    _handler;
                    _iceGatheringState = 'new';
                    _connectionState = 'new';
                    _appData;
                    _producers = new Map();
                    _consumers = new Map();
                    _dataProducers = new Map();
                    _dataConsumers = new Map();
                    _probatorConsumerCreated = !1;
                    _awaitQueue = new s.AwaitQueue();
                    _pendingConsumerTasks = [];
                    _consumerCreationInProgress = !1;
                    _pendingPauseConsumers = new Map();
                    _consumerPauseInProgress = !1;
                    _pendingResumeConsumers = new Map();
                    _consumerResumeInProgress = !1;
                    _pendingCloseConsumers = new Map();
                    _consumerCloseInProgress = !1;
                    _observer = new a.EnhancedEventEmitter();
                    constructor({
                        direction: e,
                        id: t,
                        iceParameters: r,
                        iceCandidates: s,
                        dtlsParameters: i,
                        sctpParameters: a,
                        iceServers: n,
                        iceTransportPolicy: c,
                        additionalSettings: d,
                        proprietaryConstraints: p,
                        appData: l,
                        handlerFactory: h,
                        extendedRtpCapabilities: u,
                        canProduceByKind: f,
                    }) {
                        super(),
                            m.debug('constructor() [id:%s, direction:%s]', t, e),
                            (this._id = t),
                            (this._direction = e),
                            (this._extendedRtpCapabilities = u),
                            (this._canProduceByKind = f),
                            (this._maxSctpMessageSize = a ? a.maxMessageSize : null);
                        const g = o.clone(d) ?? {};
                        delete g.iceServers,
                            delete g.iceTransportPolicy,
                            delete g.bundlePolicy,
                            delete g.rtcpMuxPolicy,
                            delete g.sdpSemantics,
                            (this._handler = h()),
                            this._handler.run({
                                direction: e,
                                iceParameters: r,
                                iceCandidates: s,
                                dtlsParameters: i,
                                sctpParameters: a,
                                iceServers: n,
                                iceTransportPolicy: c,
                                additionalSettings: g,
                                proprietaryConstraints: p,
                                extendedRtpCapabilities: u,
                            }),
                            (this._appData = l ?? {}),
                            this.handleHandler();
                    }
                    get id() {
                        return this._id;
                    }
                    get closed() {
                        return this._closed;
                    }
                    get direction() {
                        return this._direction;
                    }
                    get handler() {
                        return this._handler;
                    }
                    get iceGatheringState() {
                        return this._iceGatheringState;
                    }
                    get connectionState() {
                        return this._connectionState;
                    }
                    get appData() {
                        return this._appData;
                    }
                    set appData(e) {
                        this._appData = e;
                    }
                    get observer() {
                        return this._observer;
                    }
                    close() {
                        if (!this._closed) {
                            m.debug('close()'),
                                (this._closed = !0),
                                this._awaitQueue.stop(),
                                this._handler.close(),
                                (this._connectionState = 'closed');
                            for (const e of this._producers.values()) e.transportClosed();
                            this._producers.clear();
                            for (const e of this._consumers.values()) e.transportClosed();
                            this._consumers.clear();
                            for (const e of this._dataProducers.values()) e.transportClosed();
                            this._dataProducers.clear();
                            for (const e of this._dataConsumers.values()) e.transportClosed();
                            this._dataConsumers.clear(), this._observer.safeEmit('close');
                        }
                    }
                    async getStats() {
                        if (this._closed) throw new n.InvalidStateError('closed');
                        return this._handler.getTransportStats();
                    }
                    async restartIce({ iceParameters: e }) {
                        if ((m.debug('restartIce()'), this._closed)) throw new n.InvalidStateError('closed');
                        if (!e) throw new TypeError('missing iceParameters');
                        return this._awaitQueue.push(
                            async () => await this._handler.restartIce(e),
                            'transport.restartIce()',
                        );
                    }
                    async updateIceServers({ iceServers: e } = {}) {
                        if ((m.debug('updateIceServers()'), this._closed)) throw new n.InvalidStateError('closed');
                        if (!Array.isArray(e)) throw new TypeError('missing iceServers');
                        return this._awaitQueue.push(
                            async () => this._handler.updateIceServers(e),
                            'transport.updateIceServers()',
                        );
                    }
                    async produce({
                        track: e,
                        encodings: t,
                        codecOptions: r,
                        codec: s,
                        stopTracks: i = !0,
                        disableTrackOnPause: a = !0,
                        zeroRtpOnPause: o = !1,
                        onRtpSender: p,
                        appData: l = {},
                    } = {}) {
                        if ((m.debug('produce() [track:%o]', e), this._closed)) throw new n.InvalidStateError('closed');
                        if (!e) throw new TypeError('missing track');
                        if ('send' !== this._direction) throw new n.UnsupportedError('not a sending Transport');
                        if (!this._canProduceByKind[e.kind]) throw new n.UnsupportedError(`cannot produce ${e.kind}`);
                        if ('ended' === e.readyState) throw new n.InvalidStateError('track ended');
                        if (0 === this.listenerCount('connect') && 'new' === this._connectionState)
                            throw new TypeError('no "connect" listener set into this transport');
                        if (0 === this.listenerCount('produce'))
                            throw new TypeError('no "produce" listener set into this transport');
                        if (l && 'object' != typeof l) throw new TypeError('if given, appData must be an object');
                        return this._awaitQueue
                            .push(async () => {
                                let n;
                                if (t && !Array.isArray(t)) throw TypeError('encodings must be an array');
                                t && 0 === t.length
                                    ? (n = void 0)
                                    : t &&
                                      (n = t.map((e) => {
                                          const t = { active: !0 };
                                          return (
                                              !1 === e.active && (t.active = !1),
                                              'boolean' == typeof e.dtx && (t.dtx = e.dtx),
                                              'string' == typeof e.scalabilityMode &&
                                                  (t.scalabilityMode = e.scalabilityMode),
                                              'number' == typeof e.scaleResolutionDownBy &&
                                                  (t.scaleResolutionDownBy = e.scaleResolutionDownBy),
                                              'number' == typeof e.maxBitrate && (t.maxBitrate = e.maxBitrate),
                                              'number' == typeof e.maxFramerate && (t.maxFramerate = e.maxFramerate),
                                              'boolean' == typeof e.adaptivePtime &&
                                                  (t.adaptivePtime = e.adaptivePtime),
                                              'string' == typeof e.priority && (t.priority = e.priority),
                                              'string' == typeof e.networkPriority &&
                                                  (t.networkPriority = e.networkPriority),
                                              t
                                          );
                                      }));
                                const {
                                    localId: h,
                                    rtpParameters: m,
                                    rtpSender: u,
                                } = await this._handler.send({
                                    track: e,
                                    encodings: n,
                                    codecOptions: r,
                                    codec: s,
                                    onRtpSender: p,
                                });
                                try {
                                    c.validateRtpParameters(m);
                                    const { id: t } = await new Promise((t, r) => {
                                            this.safeEmit(
                                                'produce',
                                                { kind: e.kind, rtpParameters: m, appData: l },
                                                t,
                                                r,
                                            );
                                        }),
                                        r = new d.Producer({
                                            id: t,
                                            localId: h,
                                            rtpSender: u,
                                            track: e,
                                            rtpParameters: m,
                                            stopTracks: i,
                                            disableTrackOnPause: a,
                                            zeroRtpOnPause: o,
                                            appData: l,
                                        });
                                    return (
                                        this._producers.set(r.id, r),
                                        this.handleProducer(r),
                                        this._observer.safeEmit('newproducer', r),
                                        r
                                    );
                                } catch (e) {
                                    throw (this._handler.stopSending(h).catch(() => {}), e);
                                }
                            }, 'transport.produce()')
                            .catch((t) => {
                                if (i)
                                    try {
                                        e.stop();
                                    } catch (e) {}
                                throw t;
                            });
                    }
                    async consume({
                        id: e,
                        producerId: t,
                        kind: r,
                        rtpParameters: s,
                        streamId: i,
                        onRtpReceiver: a,
                        appData: d = {},
                    }) {
                        if ((m.debug('consume()'), this._closed)) throw new n.InvalidStateError('closed');
                        if ('recv' !== this._direction) throw new n.UnsupportedError('not a receiving Transport');
                        if ('string' != typeof e) throw new TypeError('missing id');
                        if ('string' != typeof t) throw new TypeError('missing producerId');
                        if ('audio' !== r && 'video' !== r) throw new TypeError(`invalid kind '${r}'`);
                        if (0 === this.listenerCount('connect') && 'new' === this._connectionState)
                            throw new TypeError('no "connect" listener set into this transport');
                        if (d && 'object' != typeof d) throw new TypeError('if given, appData must be an object');
                        const p = o.clone(s);
                        if (!c.canReceive(p, this._extendedRtpCapabilities))
                            throw new n.UnsupportedError('cannot consume this Producer');
                        const l = new u({
                            id: e,
                            producerId: t,
                            kind: r,
                            rtpParameters: p,
                            streamId: i,
                            onRtpReceiver: a,
                            appData: d,
                        });
                        return (
                            this._pendingConsumerTasks.push(l),
                            queueMicrotask(() => {
                                this._closed ||
                                    (!1 === this._consumerCreationInProgress && this.createPendingConsumers());
                            }),
                            l.promise
                        );
                    }
                    async produceData({
                        ordered: e = !0,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: s = '',
                        protocol: i = '',
                        appData: a = {},
                    } = {}) {
                        if ((m.debug('produceData()'), this._closed)) throw new n.InvalidStateError('closed');
                        if ('send' !== this._direction) throw new n.UnsupportedError('not a sending Transport');
                        if (!this._maxSctpMessageSize)
                            throw new n.UnsupportedError('SCTP not enabled by remote Transport');
                        if (0 === this.listenerCount('connect') && 'new' === this._connectionState)
                            throw new TypeError('no "connect" listener set into this transport');
                        if (0 === this.listenerCount('producedata'))
                            throw new TypeError('no "producedata" listener set into this transport');
                        if (a && 'object' != typeof a) throw new TypeError('if given, appData must be an object');
                        return (
                            (t || r) && (e = !1),
                            this._awaitQueue.push(async () => {
                                const { dataChannel: n, sctpStreamParameters: o } = await this._handler.sendDataChannel(
                                    { ordered: e, maxPacketLifeTime: t, maxRetransmits: r, label: s, protocol: i },
                                );
                                c.validateSctpStreamParameters(o);
                                const { id: d } = await new Promise((e, t) => {
                                        this.safeEmit(
                                            'producedata',
                                            { sctpStreamParameters: o, label: s, protocol: i, appData: a },
                                            e,
                                            t,
                                        );
                                    }),
                                    p = new l.DataProducer({
                                        id: d,
                                        dataChannel: n,
                                        sctpStreamParameters: o,
                                        appData: a,
                                    });
                                return (
                                    this._dataProducers.set(p.id, p),
                                    this.handleDataProducer(p),
                                    this._observer.safeEmit('newdataproducer', p),
                                    p
                                );
                            }, 'transport.produceData()')
                        );
                    }
                    async consumeData({
                        id: e,
                        dataProducerId: t,
                        sctpStreamParameters: r,
                        label: s = '',
                        protocol: i = '',
                        appData: a = {},
                    }) {
                        if ((m.debug('consumeData()'), this._closed)) throw new n.InvalidStateError('closed');
                        if ('recv' !== this._direction) throw new n.UnsupportedError('not a receiving Transport');
                        if (!this._maxSctpMessageSize)
                            throw new n.UnsupportedError('SCTP not enabled by remote Transport');
                        if ('string' != typeof e) throw new TypeError('missing id');
                        if ('string' != typeof t) throw new TypeError('missing dataProducerId');
                        if (0 === this.listenerCount('connect') && 'new' === this._connectionState)
                            throw new TypeError('no "connect" listener set into this transport');
                        if (a && 'object' != typeof a) throw new TypeError('if given, appData must be an object');
                        const d = o.clone(r);
                        return (
                            c.validateSctpStreamParameters(d),
                            this._awaitQueue.push(async () => {
                                const { dataChannel: r } = await this._handler.receiveDataChannel({
                                        sctpStreamParameters: d,
                                        label: s,
                                        protocol: i,
                                    }),
                                    n = new h.DataConsumer({
                                        id: e,
                                        dataProducerId: t,
                                        dataChannel: r,
                                        sctpStreamParameters: d,
                                        appData: a,
                                    });
                                return (
                                    this._dataConsumers.set(n.id, n),
                                    this.handleDataConsumer(n),
                                    this._observer.safeEmit('newdataconsumer', n),
                                    n
                                );
                            }, 'transport.consumeData()')
                        );
                    }
                    async createPendingConsumers() {
                        (this._consumerCreationInProgress = !0),
                            this._awaitQueue
                                .push(async () => {
                                    if (0 === this._pendingConsumerTasks.length)
                                        return void m.debug(
                                            'createPendingConsumers() | there is no Consumer to be created',
                                        );
                                    const e = [...this._pendingConsumerTasks];
                                    let t;
                                    this._pendingConsumerTasks = [];
                                    const r = [];
                                    for (const t of e) {
                                        const {
                                            id: e,
                                            kind: s,
                                            rtpParameters: i,
                                            streamId: a,
                                            onRtpReceiver: n,
                                        } = t.consumerOptions;
                                        r.push({
                                            trackId: e,
                                            kind: s,
                                            rtpParameters: i,
                                            streamId: a,
                                            onRtpReceiver: n,
                                        });
                                    }
                                    try {
                                        const s = await this._handler.receive(r);
                                        for (let r = 0; r < s.length; ++r) {
                                            const i = e[r],
                                                a = s[r],
                                                {
                                                    id: n,
                                                    producerId: o,
                                                    kind: c,
                                                    rtpParameters: d,
                                                    appData: l,
                                                } = i.consumerOptions,
                                                { localId: h, rtpReceiver: m, track: u } = a,
                                                f = new p.Consumer({
                                                    id: n,
                                                    localId: h,
                                                    producerId: o,
                                                    rtpReceiver: m,
                                                    track: u,
                                                    rtpParameters: d,
                                                    appData: l,
                                                });
                                            this._consumers.set(f.id, f),
                                                this.handleConsumer(f),
                                                this._probatorConsumerCreated || t || 'video' !== c || (t = f),
                                                this._observer.safeEmit('newconsumer', f),
                                                i.resolve(f);
                                        }
                                    } catch (t) {
                                        for (const r of e) r.reject(t);
                                    }
                                    if (t)
                                        try {
                                            const e = c.generateProbatorRtpParameters(t.rtpParameters);
                                            await this._handler.receive([
                                                { trackId: 'probator', kind: 'video', rtpParameters: e },
                                            ]),
                                                m.debug(
                                                    'createPendingConsumers() | Consumer for RTP probation created',
                                                ),
                                                (this._probatorConsumerCreated = !0);
                                        } catch (e) {
                                            m.error(
                                                'createPendingConsumers() | failed to create Consumer for RTP probation:%o',
                                                e,
                                            );
                                        }
                                }, 'transport.createPendingConsumers()')
                                .then(() => {
                                    (this._consumerCreationInProgress = !1),
                                        this._pendingConsumerTasks.length > 0 && this.createPendingConsumers();
                                })
                                .catch(() => {});
                    }
                    pausePendingConsumers() {
                        (this._consumerPauseInProgress = !0),
                            this._awaitQueue
                                .push(async () => {
                                    if (0 === this._pendingPauseConsumers.size)
                                        return void m.debug(
                                            'pausePendingConsumers() | there is no Consumer to be paused',
                                        );
                                    const e = Array.from(this._pendingPauseConsumers.values());
                                    this._pendingPauseConsumers.clear();
                                    try {
                                        const t = e.map((e) => e.localId);
                                        await this._handler.pauseReceiving(t);
                                    } catch (e) {
                                        m.error('pausePendingConsumers() | failed to pause Consumers:', e);
                                    }
                                }, 'transport.pausePendingConsumers')
                                .then(() => {
                                    (this._consumerPauseInProgress = !1),
                                        this._pendingPauseConsumers.size > 0 && this.pausePendingConsumers();
                                })
                                .catch(() => {});
                    }
                    resumePendingConsumers() {
                        (this._consumerResumeInProgress = !0),
                            this._awaitQueue
                                .push(async () => {
                                    if (0 === this._pendingResumeConsumers.size)
                                        return void m.debug(
                                            'resumePendingConsumers() | there is no Consumer to be resumed',
                                        );
                                    const e = Array.from(this._pendingResumeConsumers.values());
                                    this._pendingResumeConsumers.clear();
                                    try {
                                        const t = e.map((e) => e.localId);
                                        await this._handler.resumeReceiving(t);
                                    } catch (e) {
                                        m.error('resumePendingConsumers() | failed to resume Consumers:', e);
                                    }
                                }, 'transport.resumePendingConsumers')
                                .then(() => {
                                    (this._consumerResumeInProgress = !1),
                                        this._pendingResumeConsumers.size > 0 && this.resumePendingConsumers();
                                })
                                .catch(() => {});
                    }
                    closePendingConsumers() {
                        (this._consumerCloseInProgress = !0),
                            this._awaitQueue
                                .push(async () => {
                                    if (0 === this._pendingCloseConsumers.size)
                                        return void m.debug(
                                            'closePendingConsumers() | there is no Consumer to be closed',
                                        );
                                    const e = Array.from(this._pendingCloseConsumers.values());
                                    this._pendingCloseConsumers.clear();
                                    try {
                                        await this._handler.stopReceiving(e.map((e) => e.localId));
                                    } catch (e) {
                                        m.error('closePendingConsumers() | failed to close Consumers:', e);
                                    }
                                }, 'transport.closePendingConsumers')
                                .then(() => {
                                    (this._consumerCloseInProgress = !1),
                                        this._pendingCloseConsumers.size > 0 && this.closePendingConsumers();
                                })
                                .catch(() => {});
                    }
                    handleHandler() {
                        const e = this._handler;
                        e.on('@connect', ({ dtlsParameters: e }, t, r) => {
                            this._closed
                                ? r(new n.InvalidStateError('closed'))
                                : this.safeEmit('connect', { dtlsParameters: e }, t, r);
                        }),
                            e.on('@icegatheringstatechange', (e) => {
                                e !== this._iceGatheringState &&
                                    (m.debug('ICE gathering state changed to %s', e),
                                    (this._iceGatheringState = e),
                                    this._closed || this.safeEmit('icegatheringstatechange', e));
                            }),
                            e.on('@icecandidateerror', (e) => {
                                m.warn(
                                    `ICE candidate error [url:${e.url}, localAddress:${e.address}, localPort:${e.port}]: ${e.errorCode} "${e.errorText}"`,
                                ),
                                    this.safeEmit('icecandidateerror', e);
                            }),
                            e.on('@connectionstatechange', (e) => {
                                e !== this._connectionState &&
                                    (m.debug('connection state changed to %s', e),
                                    (this._connectionState = e),
                                    this._closed || this.safeEmit('connectionstatechange', e));
                            });
                    }
                    handleProducer(e) {
                        e.on('@close', () => {
                            this._producers.delete(e.id),
                                this._closed ||
                                    this._awaitQueue
                                        .push(
                                            async () => await this._handler.stopSending(e.localId),
                                            'producer @close event',
                                        )
                                        .catch((e) => m.warn('producer.close() failed:%o', e));
                        }),
                            e.on('@pause', (t, r) => {
                                this._awaitQueue
                                    .push(
                                        async () => await this._handler.pauseSending(e.localId),
                                        'producer @pause event',
                                    )
                                    .then(t)
                                    .catch(r);
                            }),
                            e.on('@resume', (t, r) => {
                                this._awaitQueue
                                    .push(
                                        async () => await this._handler.resumeSending(e.localId),
                                        'producer @resume event',
                                    )
                                    .then(t)
                                    .catch(r);
                            }),
                            e.on('@replacetrack', (t, r, s) => {
                                this._awaitQueue
                                    .push(
                                        async () => await this._handler.replaceTrack(e.localId, t),
                                        'producer @replacetrack event',
                                    )
                                    .then(r)
                                    .catch(s);
                            }),
                            e.on('@setmaxspatiallayer', (t, r, s) => {
                                this._awaitQueue
                                    .push(
                                        async () => await this._handler.setMaxSpatialLayer(e.localId, t),
                                        'producer @setmaxspatiallayer event',
                                    )
                                    .then(r)
                                    .catch(s);
                            }),
                            e.on('@setrtpencodingparameters', (t, r, s) => {
                                this._awaitQueue
                                    .push(
                                        async () => await this._handler.setRtpEncodingParameters(e.localId, t),
                                        'producer @setrtpencodingparameters event',
                                    )
                                    .then(r)
                                    .catch(s);
                            }),
                            e.on('@getstats', (t, r) => {
                                if (this._closed) return r(new n.InvalidStateError('closed'));
                                this._handler.getSenderStats(e.localId).then(t).catch(r);
                            });
                    }
                    handleConsumer(e) {
                        e.on('@close', () => {
                            this._consumers.delete(e.id),
                                this._pendingPauseConsumers.delete(e.id),
                                this._pendingResumeConsumers.delete(e.id),
                                this._closed ||
                                    (this._pendingCloseConsumers.set(e.id, e),
                                    !1 === this._consumerCloseInProgress && this.closePendingConsumers());
                        }),
                            e.on('@pause', () => {
                                this._pendingResumeConsumers.has(e.id) && this._pendingResumeConsumers.delete(e.id),
                                    this._pendingPauseConsumers.set(e.id, e),
                                    queueMicrotask(() => {
                                        this._closed ||
                                            (!1 === this._consumerPauseInProgress && this.pausePendingConsumers());
                                    });
                            }),
                            e.on('@resume', () => {
                                this._pendingPauseConsumers.has(e.id) && this._pendingPauseConsumers.delete(e.id),
                                    this._pendingResumeConsumers.set(e.id, e),
                                    queueMicrotask(() => {
                                        this._closed ||
                                            (!1 === this._consumerResumeInProgress && this.resumePendingConsumers());
                                    });
                            }),
                            e.on('@getstats', (t, r) => {
                                if (this._closed) return r(new n.InvalidStateError('closed'));
                                this._handler.getReceiverStats(e.localId).then(t).catch(r);
                            });
                    }
                    handleDataProducer(e) {
                        e.on('@close', () => {
                            this._dataProducers.delete(e.id);
                        });
                    }
                    handleDataConsumer(e) {
                        e.on('@close', () => {
                            this._dataConsumers.delete(e.id);
                        });
                    }
                }
                t.Transport = f;
            },
            5602: (e) => {
                var t = (e.exports = {
                    v: [{ name: 'version', reg: /^(\d*)$/ }],
                    o: [
                        {
                            name: 'origin',
                            reg: /^(\S*) (\d*) (\d*) (\S*) IP(\d) (\S*)/,
                            names: ['username', 'sessionId', 'sessionVersion', 'netType', 'ipVer', 'address'],
                            format: '%s %s %d %s IP%d %s',
                        },
                    ],
                    s: [{ name: 'name' }],
                    i: [{ name: 'description' }],
                    u: [{ name: 'uri' }],
                    e: [{ name: 'email' }],
                    p: [{ name: 'phone' }],
                    z: [{ name: 'timezones' }],
                    r: [{ name: 'repeats' }],
                    t: [{ name: 'timing', reg: /^(\d*) (\d*)/, names: ['start', 'stop'], format: '%d %d' }],
                    c: [
                        { name: 'connection', reg: /^IN IP(\d) (\S*)/, names: ['version', 'ip'], format: 'IN IP%d %s' },
                    ],
                    b: [
                        {
                            push: 'bandwidth',
                            reg: /^(TIAS|AS|CT|RR|RS):(\d*)/,
                            names: ['type', 'limit'],
                            format: '%s:%s',
                        },
                    ],
                    m: [
                        {
                            reg: /^(\w*) (\d*) ([\w/]*)(?: (.*))?/,
                            names: ['type', 'port', 'protocol', 'payloads'],
                            format: '%s %d %s %s',
                        },
                    ],
                    a: [
                        {
                            push: 'rtp',
                            reg: /^rtpmap:(\d*) ([\w\-.]*)(?:\s*\/(\d*)(?:\s*\/(\S*))?)?/,
                            names: ['payload', 'codec', 'rate', 'encoding'],
                            format: function (e) {
                                return e.encoding ? 'rtpmap:%d %s/%s/%s' : e.rate ? 'rtpmap:%d %s/%s' : 'rtpmap:%d %s';
                            },
                        },
                        {
                            push: 'fmtp',
                            reg: /^fmtp:(\d*) ([\S| ]*)/,
                            names: ['payload', 'config'],
                            format: 'fmtp:%d %s',
                        },
                        { name: 'control', reg: /^control:(.*)/, format: 'control:%s' },
                        {
                            name: 'rtcp',
                            reg: /^rtcp:(\d*)(?: (\S*) IP(\d) (\S*))?/,
                            names: ['port', 'netType', 'ipVer', 'address'],
                            format: function (e) {
                                return null != e.address ? 'rtcp:%d %s IP%d %s' : 'rtcp:%d';
                            },
                        },
                        {
                            push: 'rtcpFbTrrInt',
                            reg: /^rtcp-fb:(\*|\d*) trr-int (\d*)/,
                            names: ['payload', 'value'],
                            format: 'rtcp-fb:%s trr-int %d',
                        },
                        {
                            push: 'rtcpFb',
                            reg: /^rtcp-fb:(\*|\d*) ([\w-_]*)(?: ([\w-_]*))?/,
                            names: ['payload', 'type', 'subtype'],
                            format: function (e) {
                                return null != e.subtype ? 'rtcp-fb:%s %s %s' : 'rtcp-fb:%s %s';
                            },
                        },
                        {
                            push: 'ext',
                            reg: /^extmap:(\d+)(?:\/(\w+))?(?: (urn:ietf:params:rtp-hdrext:encrypt))? (\S*)(?: (\S*))?/,
                            names: ['value', 'direction', 'encrypt-uri', 'uri', 'config'],
                            format: function (e) {
                                return (
                                    'extmap:%d' +
                                    (e.direction ? '/%s' : '%v') +
                                    (e['encrypt-uri'] ? ' %s' : '%v') +
                                    ' %s' +
                                    (e.config ? ' %s' : '')
                                );
                            },
                        },
                        { name: 'extmapAllowMixed', reg: /^(extmap-allow-mixed)/ },
                        {
                            push: 'crypto',
                            reg: /^crypto:(\d*) ([\w_]*) (\S*)(?: (\S*))?/,
                            names: ['id', 'suite', 'config', 'sessionConfig'],
                            format: function (e) {
                                return null != e.sessionConfig ? 'crypto:%d %s %s %s' : 'crypto:%d %s %s';
                            },
                        },
                        { name: 'setup', reg: /^setup:(\w*)/, format: 'setup:%s' },
                        { name: 'connectionType', reg: /^connection:(new|existing)/, format: 'connection:%s' },
                        { name: 'mid', reg: /^mid:([^\s]*)/, format: 'mid:%s' },
                        { name: 'msid', reg: /^msid:(.*)/, format: 'msid:%s' },
                        { name: 'ptime', reg: /^ptime:(\d*(?:\.\d*)*)/, format: 'ptime:%d' },
                        { name: 'maxptime', reg: /^maxptime:(\d*(?:\.\d*)*)/, format: 'maxptime:%d' },
                        { name: 'direction', reg: /^(sendrecv|recvonly|sendonly|inactive)/ },
                        { name: 'icelite', reg: /^(ice-lite)/ },
                        { name: 'iceUfrag', reg: /^ice-ufrag:(\S*)/, format: 'ice-ufrag:%s' },
                        { name: 'icePwd', reg: /^ice-pwd:(\S*)/, format: 'ice-pwd:%s' },
                        {
                            name: 'fingerprint',
                            reg: /^fingerprint:(\S*) (\S*)/,
                            names: ['type', 'hash'],
                            format: 'fingerprint:%s %s',
                        },
                        {
                            push: 'candidates',
                            reg: /^candidate:(\S*) (\d*) (\S*) (\d*) (\S*) (\d*) typ (\S*)(?: raddr (\S*) rport (\d*))?(?: tcptype (\S*))?(?: generation (\d*))?(?: network-id (\d*))?(?: network-cost (\d*))?/,
                            names: [
                                'foundation',
                                'component',
                                'transport',
                                'priority',
                                'ip',
                                'port',
                                'type',
                                'raddr',
                                'rport',
                                'tcptype',
                                'generation',
                                'network-id',
                                'network-cost',
                            ],
                            format: function (e) {
                                var t = 'candidate:%s %d %s %d %s %d typ %s';
                                return (
                                    (t += null != e.raddr ? ' raddr %s rport %d' : '%v%v'),
                                    (t += null != e.tcptype ? ' tcptype %s' : '%v'),
                                    null != e.generation && (t += ' generation %d'),
                                    (t += null != e['network-id'] ? ' network-id %d' : '%v') +
                                        (null != e['network-cost'] ? ' network-cost %d' : '%v')
                                );
                            },
                        },
                        { name: 'endOfCandidates', reg: /^(end-of-candidates)/ },
                        { name: 'remoteCandidates', reg: /^remote-candidates:(.*)/, format: 'remote-candidates:%s' },
                        { name: 'iceOptions', reg: /^ice-options:(\S*)/, format: 'ice-options:%s' },
                        {
                            push: 'ssrcs',
                            reg: /^ssrc:(\d*) ([\w_-]*)(?::(.*))?/,
                            names: ['id', 'attribute', 'value'],
                            format: function (e) {
                                var t = 'ssrc:%d';
                                return null != e.attribute && ((t += ' %s'), null != e.value && (t += ':%s')), t;
                            },
                        },
                        {
                            push: 'ssrcGroups',
                            reg: /^ssrc-group:([\x21\x23\x24\x25\x26\x27\x2A\x2B\x2D\x2E\w]*) (.*)/,
                            names: ['semantics', 'ssrcs'],
                            format: 'ssrc-group:%s %s',
                        },
                        {
                            name: 'msidSemantic',
                            reg: /^msid-semantic:\s?(\w*) (\S*)/,
                            names: ['semantic', 'token'],
                            format: 'msid-semantic: %s %s',
                        },
                        { push: 'groups', reg: /^group:(\w*) (.*)/, names: ['type', 'mids'], format: 'group:%s %s' },
                        { name: 'rtcpMux', reg: /^(rtcp-mux)/ },
                        { name: 'rtcpRsize', reg: /^(rtcp-rsize)/ },
                        {
                            name: 'sctpmap',
                            reg: /^sctpmap:([\w_/]*) (\S*)(?: (\S*))?/,
                            names: ['sctpmapNumber', 'app', 'maxMessageSize'],
                            format: function (e) {
                                return null != e.maxMessageSize ? 'sctpmap:%s %s %s' : 'sctpmap:%s %s';
                            },
                        },
                        { name: 'xGoogleFlag', reg: /^x-google-flag:([^\s]*)/, format: 'x-google-flag:%s' },
                        {
                            push: 'rids',
                            reg: /^rid:([\d\w]+) (\w+)(?: ([\S| ]*))?/,
                            names: ['id', 'direction', 'params'],
                            format: function (e) {
                                return e.params ? 'rid:%s %s %s' : 'rid:%s %s';
                            },
                        },
                        {
                            push: 'imageattrs',
                            reg: new RegExp(
                                '^imageattr:(\\d+|\\*)[\\s\\t]+(send|recv)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*)(?:[\\s\\t]+(recv|send)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*))?',
                            ),
                            names: ['pt', 'dir1', 'attrs1', 'dir2', 'attrs2'],
                            format: function (e) {
                                return 'imageattr:%s %s %s' + (e.dir2 ? ' %s %s' : '');
                            },
                        },
                        {
                            name: 'simulcast',
                            reg: new RegExp(
                                '^simulcast:(send|recv) ([a-zA-Z0-9\\-_~;,]+)(?:\\s?(send|recv) ([a-zA-Z0-9\\-_~;,]+))?$',
                            ),
                            names: ['dir1', 'list1', 'dir2', 'list2'],
                            format: function (e) {
                                return 'simulcast:%s %s' + (e.dir2 ? ' %s %s' : '');
                            },
                        },
                        {
                            name: 'simulcast_03',
                            reg: /^simulcast:[\s\t]+([\S+\s\t]+)$/,
                            names: ['value'],
                            format: 'simulcast: %s',
                        },
                        { name: 'framerate', reg: /^framerate:(\d+(?:$|\.\d+))/, format: 'framerate:%s' },
                        {
                            name: 'sourceFilter',
                            reg: /^source-filter: *(excl|incl) (\S*) (IP4|IP6|\*) (\S*) (.*)/,
                            names: ['filterMode', 'netType', 'addressTypes', 'destAddress', 'srcList'],
                            format: 'source-filter: %s %s %s %s %s',
                        },
                        { name: 'bundleOnly', reg: /^(bundle-only)/ },
                        { name: 'label', reg: /^label:(.+)/, format: 'label:%s' },
                        { name: 'sctpPort', reg: /^sctp-port:(\d+)$/, format: 'sctp-port:%s' },
                        { name: 'maxMessageSize', reg: /^max-message-size:(\d+)$/, format: 'max-message-size:%s' },
                        {
                            push: 'tsRefClocks',
                            reg: /^ts-refclk:([^\s=]*)(?:=(\S*))?/,
                            names: ['clksrc', 'clksrcExt'],
                            format: function (e) {
                                return 'ts-refclk:%s' + (null != e.clksrcExt ? '=%s' : '');
                            },
                        },
                        {
                            name: 'mediaClk',
                            reg: /^mediaclk:(?:id=(\S*))? *([^\s=]*)(?:=(\S*))?(?: *rate=(\d+)\/(\d+))?/,
                            names: ['id', 'mediaClockName', 'mediaClockValue', 'rateNumerator', 'rateDenominator'],
                            format: function (e) {
                                var t = 'mediaclk:';
                                return (
                                    (t += null != e.id ? 'id=%s %s' : '%v%s'),
                                    (t += null != e.mediaClockValue ? '=%s' : ''),
                                    (t += null != e.rateNumerator ? ' rate=%s' : '') +
                                        (null != e.rateDenominator ? '/%s' : '')
                                );
                            },
                        },
                        { name: 'keywords', reg: /^keywds:(.+)$/, format: 'keywds:%s' },
                        { name: 'content', reg: /^content:(.+)/, format: 'content:%s' },
                        { name: 'bfcpFloorCtrl', reg: /^floorctrl:(c-only|s-only|c-s)/, format: 'floorctrl:%s' },
                        { name: 'bfcpConfId', reg: /^confid:(\d+)/, format: 'confid:%s' },
                        { name: 'bfcpUserId', reg: /^userid:(\d+)/, format: 'userid:%s' },
                        {
                            name: 'bfcpFloorId',
                            reg: /^floorid:(.+) (?:m-stream|mstrm):(.+)/,
                            names: ['id', 'mStream'],
                            format: 'floorid:%s mstrm:%s',
                        },
                        { push: 'invalid', names: ['value'] },
                    ],
                });
                Object.keys(t).forEach(function (e) {
                    t[e].forEach(function (e) {
                        e.reg || (e.reg = /(.*)/), e.format || (e.format = '%s');
                    });
                });
            },
            5765: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Safari12 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(5938),
                    d = r(4256),
                    p = r(4893),
                    l = r(521),
                    h = r(1305),
                    m = r(3303),
                    u = new i.Logger('Safari12'),
                    f = { OS: 1024, MIS: 1024 };
                class g extends l.HandlerInterface {
                    _closed = !1;
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _mapMidTransceiver = new Map();
                    _sendStream = new MediaStream();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new g();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Safari12';
                    }
                    close() {
                        if ((u.debug('close()'), !this._closed)) {
                            if (((this._closed = !0), this._pc))
                                try {
                                    this._pc.close();
                                } catch (e) {}
                            this.emit('@close');
                        }
                    }
                    async getNativeRtpCapabilities() {
                        u.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                        });
                        try {
                            e.addTransceiver('audio'), e.addTransceiver('video');
                            const t = await e.createOffer();
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp),
                                i = o.extractRtpCapabilities({ sdpObject: r });
                            return d.addNackSupportForOpus(i), i;
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return u.debug('getNativeSctpCapabilities()'), { numStreams: f };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        this.assertNotClosed(),
                            u.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new h.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', p),
                                video: n.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', p),
                                video: n.getSendingRemoteRtpParameters('video', p),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (u.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        this.assertNotClosed(), u.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if (
                            (this.assertNotClosed(),
                            u.debug('restartIce()'),
                            this._remoteSdp.updateIceParameters(e),
                            this._transportReady)
                        )
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                u.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                u.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                u.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this.assertNotClosed(), this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i, onRtpSender: d }) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('send() [kind:%s, track.id:%s]', e.kind, e.id);
                        const p = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        p.codecs = n.reduceCodecs(p.codecs, i);
                        const l = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        l.codecs = n.reduceCodecs(l.codecs, i);
                        const h = this._remoteSdp.getNextMediaSectionIdx(),
                            f = this._pc.addTransceiver(e, { direction: 'sendonly', streams: [this._sendStream] });
                        d && d(f.sender);
                        let g,
                            _ = await this._pc.createOffer(),
                            w = s.parse(_.sdp);
                        w.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed(),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: w,
                                }));
                        const b = (0, m.parse)((t ?? [{}])[0].scalabilityMode);
                        t &&
                            t.length > 1 &&
                            (u.debug('send() | enabling legacy simulcast'),
                            (w = s.parse(_.sdp)),
                            (g = w.media[h.idx]),
                            c.addLegacySimulcast({ offerMediaObject: g, numStreams: t.length }),
                            (_ = { type: 'offer', sdp: s.write(w) })),
                            u.debug('send() | calling pc.setLocalDescription() [offer:%o]', _),
                            await this._pc.setLocalDescription(_);
                        const v = f.mid;
                        if (
                            ((p.mid = v),
                            (w = s.parse(this._pc.localDescription.sdp)),
                            (g = w.media[h.idx]),
                            (p.rtcp.cname = o.getCname({ offerMediaObject: g })),
                            (p.encodings = c.getRtpEncodings({ offerMediaObject: g })),
                            t)
                        )
                            for (let e = 0; e < p.encodings.length; ++e) t[e] && Object.assign(p.encodings[e], t[e]);
                        if (
                            p.encodings.length > 1 &&
                            ('video/vp8' === p.codecs[0].mimeType.toLowerCase() ||
                                'video/h264' === p.codecs[0].mimeType.toLowerCase())
                        )
                            for (const e of p.encodings)
                                e.scalabilityMode
                                    ? (e.scalabilityMode = `L1T${b.temporalLayers}`)
                                    : (e.scalabilityMode = 'L1T3');
                        this._remoteSdp.send({
                            offerMediaObject: g,
                            reuseMid: h.reuseMid,
                            offerRtpParameters: p,
                            answerRtpParameters: l,
                            codecOptions: r,
                        });
                        const y = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        return (
                            u.debug('send() | calling pc.setRemoteDescription() [answer:%o]', y),
                            await this._pc.setRemoteDescription(y),
                            this._mapMidTransceiver.set(v, f),
                            { localId: v, rtpParameters: p, rtpSender: f.sender }
                        );
                    }
                    async stopSending(e) {
                        if ((this.assertSendDirection(), this._closed)) return;
                        u.debug('stopSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        if (
                            (t.sender.replaceTrack(null),
                            this._pc.removeTrack(t.sender),
                            this._remoteSdp.closeMediaSection(t.mid))
                        )
                            try {
                                t.stop();
                            } catch (e) {}
                        const r = await this._pc.createOffer();
                        u.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s),
                            this._mapMidTransceiver.delete(e);
                    }
                    async pauseSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('pauseSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'inactive'), this._remoteSdp.pauseMediaSection(e);
                        const r = await this._pc.createOffer();
                        u.debug('pauseSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async resumeSending(e) {
                        this.assertNotClosed(), this.assertSendDirection(), u.debug('resumeSending() [localId:%s]', e);
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        (t.direction = 'sendonly'), this._remoteSdp.resumeSendingMediaSection(e);
                        const r = await this._pc.createOffer();
                        u.debug('resumeSending() | calling pc.setLocalDescription() [offer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async replaceTrack(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            t
                                ? u.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : u.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        await r.sender.replaceTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setMaxSpatialLayer() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setMaxSpatialLayer() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertNotClosed(),
                            this.assertSendDirection(),
                            u.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapMidTransceiver.get(e);
                        if (!r) throw new Error('associated RTCRtpTransceiver not found');
                        const s = r.sender.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.sender.setParameters(s),
                            this._remoteSdp.muxMediaSectionSimulcast(e, s.encodings);
                        const i = await this._pc.createOffer();
                        u.debug('setRtpEncodingParameters() | calling pc.setLocalDescription() [offer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        const a = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        u.debug('setRtpEncodingParameters() | calling pc.setRemoteDescription() [answer:%o]', a),
                            await this._pc.setRemoteDescription(a);
                    }
                    async getSenderStats(e) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.sender.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertNotClosed(), this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        u.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % f.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                u.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            u.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i, streamId: a } = t;
                            u.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const n = i.mid ?? String(this._mapMidTransceiver.size);
                            r.set(e, n),
                                this._remoteSdp.receive({
                                    mid: n,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: a ?? i.rtcp.cname,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        for (const t of e) {
                            const { trackId: e, onRtpReceiver: s } = t;
                            if (s) {
                                const t = r.get(e),
                                    i = this._pc.getTransceivers().find((e) => e.mid === t);
                                if (!i) throw new Error('transceiver not found');
                                s(i.receiver);
                            }
                        }
                        let a = await this._pc.createAnswer();
                        const n = s.parse(a.sdp);
                        for (const t of e) {
                            const { trackId: e, rtpParameters: s } = t,
                                i = r.get(e),
                                a = n.media.find((e) => String(e.mid) === i);
                            o.applyCodecParameters({ offerRtpParameters: s, answerMediaObject: a });
                        }
                        (a = { type: 'answer', sdp: s.write(n) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: n,
                                })),
                            u.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { trackId: e } = s,
                                i = r.get(e),
                                a = this._pc.getTransceivers().find((e) => e.mid === i);
                            if (!a) throw new Error('new RTCRtpTransceiver not found');
                            this._mapMidTransceiver.set(i, a),
                                t.push({ localId: i, track: a.receiver.track, rtpReceiver: a.receiver });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        if ((this.assertRecvDirection(), this._closed)) return;
                        for (const t of e) {
                            u.debug('stopReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            this._remoteSdp.closeMediaSection(e.mid);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                        for (const t of e) this._mapMidTransceiver.delete(t);
                    }
                    async pauseReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('pauseReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'inactive'), this._remoteSdp.pauseMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('pauseReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('pauseReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async resumeReceiving(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        for (const t of e) {
                            u.debug('resumeReceiving() [localId:%s]', t);
                            const e = this._mapMidTransceiver.get(t);
                            if (!e) throw new Error('associated RTCRtpTransceiver not found');
                            (e.direction = 'recvonly'), this._remoteSdp.resumeReceivingMediaSection(t);
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        u.debug('resumeReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        u.debug('resumeReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const t = this._mapMidTransceiver.get(e);
                        if (!t) throw new Error('associated RTCRtpTransceiver not found');
                        return t.receiver.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertNotClosed(), this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        u.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation();
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            u.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertNotClosed() {
                        if (this._closed) throw new p.InvalidStateError('method called in a closed handler');
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Safari12 = g;
            },
            5938: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.getRtpEncodings = function ({ offerMediaObject: e }) {
                        const t = new Set();
                        for (const r of e.ssrcs ?? []) {
                            const e = r.id;
                            t.add(e);
                        }
                        if (0 === t.size) throw new Error('no a=ssrc lines found');
                        const r = new Map();
                        for (const s of e.ssrcGroups ?? []) {
                            if ('FID' !== s.semantics) continue;
                            let [e, i] = s.ssrcs.split(/\s+/);
                            (e = Number(e)), (i = Number(i)), t.has(e) && (t.delete(e), t.delete(i), r.set(e, i));
                        }
                        for (const e of t) r.set(e, null);
                        const s = [];
                        for (const [e, t] of r) {
                            const r = { ssrc: e };
                            t && (r.rtx = { ssrc: t }), s.push(r);
                        }
                        return s;
                    }),
                    (t.addLegacySimulcast = function ({ offerMediaObject: e, numStreams: t }) {
                        if (t <= 1) throw new TypeError('numStreams must be greater than 1');
                        const r = (e.ssrcs ?? []).find((e) => 'msid' === e.attribute);
                        if (!r) throw new Error('a=ssrc line with msid information not found');
                        const [s, i] = r.value.split(' '),
                            a = Number(r.id);
                        let n;
                        (e.ssrcGroups ?? []).some((e) => {
                            if ('FID' !== e.semantics) return !1;
                            const t = e.ssrcs.split(/\s+/);
                            return Number(t[0]) === a && ((n = Number(t[1])), !0);
                        });
                        const o = e.ssrcs.find((e) => 'cname' === e.attribute);
                        if (!o) throw new Error('a=ssrc line with cname information not found');
                        const c = o.value,
                            d = [],
                            p = [];
                        for (let e = 0; e < t; ++e) d.push(a + e), n && p.push(n + e);
                        (e.ssrcGroups = []),
                            (e.ssrcs = []),
                            e.ssrcGroups.push({ semantics: 'SIM', ssrcs: d.join(' ') });
                        for (const t of d)
                            e.ssrcs.push({ id: t, attribute: 'cname', value: c }),
                                e.ssrcs.push({ id: t, attribute: 'msid', value: `${s} ${i}` });
                        for (let t = 0; t < p.length; ++t) {
                            const r = d[t],
                                a = p[t];
                            e.ssrcs.push({ id: a, attribute: 'cname', value: c }),
                                e.ssrcs.push({ id: a, attribute: 'msid', value: `${s} ${i}` }),
                                e.ssrcGroups.push({ semantics: 'FID', ssrcs: `${r} ${a}` });
                        }
                    });
            },
            6004: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Device = void 0), (t.detectDevice = R);
                const s = r(2109),
                    i = r(2994),
                    a = r(3953),
                    n = r(4893),
                    o = r(1765),
                    c = r(8046),
                    d = r(5601),
                    p = r(2183),
                    l = r(11),
                    h = r(5535),
                    m = r(8155),
                    u = r(7402),
                    f = r(2292),
                    g = r(1767),
                    _ = r(5765),
                    w = r(9676),
                    b = r(8633),
                    v = r(4039),
                    y = r(9352),
                    S = new i.Logger('Device');
                function R(e) {
                    if (!e && 'object' == typeof navigator && 'ReactNative' === navigator.product)
                        return (
                            S.debug('detectDevice() | React-Native detected'),
                            'undefined' == typeof RTCPeerConnection
                                ? void S.warn(
                                      'detectDevice() | unsupported react-native-webrtc without RTCPeerConnection, forgot to call registerGlobals()?',
                                  )
                                : 'undefined' != typeof RTCRtpTransceiver
                                  ? (S.debug('detectDevice() | ReactNative UnifiedPlan handler chosen'),
                                    'ReactNativeUnifiedPlan')
                                  : (S.debug('detectDevice() | ReactNative PlanB handler chosen'), 'ReactNative')
                        );
                    if (e || ('object' == typeof navigator && 'string' == typeof navigator.userAgent)) {
                        e ??= navigator.userAgent;
                        const t = new s.UAParser(e);
                        S.debug('detectDevice() | browser detected [userAgent:%s, parsed:%o]', e, t.getResult());
                        const r = t.getBrowser(),
                            i = r.name?.toLowerCase(),
                            a = parseInt(r.major ?? '0'),
                            n = t.getEngine(),
                            o = n.name?.toLowerCase(),
                            c = t.getOS(),
                            d = c.name?.toLowerCase(),
                            p = parseFloat(c.version ?? '0'),
                            l = t.getDevice(),
                            h = l.model?.toLowerCase(),
                            m = 'ios' === d || 'ipad' === h,
                            u =
                                i &&
                                ['chrome', 'chromium', 'mobile chrome', 'chrome webview', 'chrome headless'].includes(
                                    i,
                                ),
                            f = i && ['firefox', 'mobile firefox', 'mobile focus'].includes(i),
                            g = i && ['safari', 'mobile safari'].includes(i),
                            _ = i && ['edge'].includes(i);
                        if ((u || _) && !m && a >= 111) return 'Chrome111';
                        if ((u && !m && a >= 74) || (_ && !m && a >= 88)) return 'Chrome74';
                        if (u && !m && a >= 70) return 'Chrome70';
                        if (u && !m && a >= 67) return 'Chrome67';
                        if (u && !m && a >= 55) return 'Chrome55';
                        if (f && !m && a >= 120) return 'Firefox120';
                        if (f && !m && a >= 60) return 'Firefox60';
                        if (f && m && p >= 14.3) return 'Safari12';
                        if (
                            g &&
                            a >= 12 &&
                            'undefined' != typeof RTCRtpTransceiver &&
                            RTCRtpTransceiver.prototype.hasOwnProperty('currentDirection')
                        )
                            return 'Safari12';
                        if (g && a >= 11) return 'Safari11';
                        if (_ && !m && a >= 11 && a <= 18) return 'Edge11';
                        if (
                            'webkit' === o &&
                            m &&
                            'undefined' != typeof RTCRtpTransceiver &&
                            RTCRtpTransceiver.prototype.hasOwnProperty('currentDirection')
                        )
                            return 'Safari12';
                        if ('blink' === o) {
                            const t = e.match(/(?:(?:Chrome|Chromium))[ /](\w+)/i);
                            if (t) {
                                const e = Number(t[1]);
                                return e >= 111
                                    ? 'Chrome111'
                                    : e >= 74
                                      ? 'Chrome74'
                                      : e >= 70
                                        ? 'Chrome70'
                                        : e >= 67
                                          ? 'Chrome67'
                                          : 'Chrome55';
                            }
                            return 'Chrome111';
                        }
                        S.warn('detectDevice() | browser not supported [name:%s, version:%s]', i, a);
                    } else S.warn('detectDevice() | unknown device');
                }
                t.Device = class {
                    _handlerFactory;
                    _handlerName;
                    _loaded = !1;
                    _extendedRtpCapabilities;
                    _recvRtpCapabilities;
                    _canProduceByKind;
                    _sctpCapabilities;
                    _observer = new a.EnhancedEventEmitter();
                    constructor({ handlerName: e, handlerFactory: t } = {}) {
                        if ((S.debug('constructor()'), e && t))
                            throw new TypeError('just one of handlerName or handlerInterface can be given');
                        if (t) this._handlerFactory = t;
                        else {
                            if (e) S.debug('constructor() | handler given: %s', e);
                            else {
                                if (!(e = R())) throw new n.UnsupportedError('device not supported');
                                S.debug('constructor() | detected handler: %s', e);
                            }
                            switch (e) {
                                case 'Chrome111':
                                    this._handlerFactory = p.Chrome111.createFactory();
                                    break;
                                case 'Chrome74':
                                    this._handlerFactory = l.Chrome74.createFactory();
                                    break;
                                case 'Chrome70':
                                    this._handlerFactory = h.Chrome70.createFactory();
                                    break;
                                case 'Chrome67':
                                    this._handlerFactory = m.Chrome67.createFactory();
                                    break;
                                case 'Chrome55':
                                    this._handlerFactory = u.Chrome55.createFactory();
                                    break;
                                case 'Firefox120':
                                    this._handlerFactory = f.Firefox120.createFactory();
                                    break;
                                case 'Firefox60':
                                    this._handlerFactory = g.Firefox60.createFactory();
                                    break;
                                case 'Safari12':
                                    this._handlerFactory = _.Safari12.createFactory();
                                    break;
                                case 'Safari11':
                                    this._handlerFactory = w.Safari11.createFactory();
                                    break;
                                case 'Edge11':
                                    this._handlerFactory = b.Edge11.createFactory();
                                    break;
                                case 'ReactNativeUnifiedPlan':
                                    this._handlerFactory = v.ReactNativeUnifiedPlan.createFactory();
                                    break;
                                case 'ReactNative':
                                    this._handlerFactory = y.ReactNative.createFactory();
                                    break;
                                default:
                                    throw new TypeError(`unknown handlerName "${e}"`);
                            }
                        }
                        const r = this._handlerFactory();
                        (this._handlerName = r.name),
                            r.close(),
                            (this._extendedRtpCapabilities = void 0),
                            (this._recvRtpCapabilities = void 0),
                            (this._canProduceByKind = { audio: !1, video: !1 }),
                            (this._sctpCapabilities = void 0);
                    }
                    get handlerName() {
                        return this._handlerName;
                    }
                    get loaded() {
                        return this._loaded;
                    }
                    get rtpCapabilities() {
                        if (!this._loaded) throw new n.InvalidStateError('not loaded');
                        return this._recvRtpCapabilities;
                    }
                    get sctpCapabilities() {
                        if (!this._loaded) throw new n.InvalidStateError('not loaded');
                        return this._sctpCapabilities;
                    }
                    get observer() {
                        return this._observer;
                    }
                    async load({ routerRtpCapabilities: e }) {
                        let t;
                        S.debug('load() [routerRtpCapabilities:%o]', e);
                        try {
                            if (this._loaded) throw new n.InvalidStateError('already loaded');
                            const r = o.clone(e);
                            c.validateRtpCapabilities(r), (t = this._handlerFactory());
                            const s = await t.getNativeRtpCapabilities();
                            S.debug('load() | got native RTP capabilities:%o', s);
                            const i = o.clone(s);
                            c.validateRtpCapabilities(i),
                                (this._extendedRtpCapabilities = c.getExtendedRtpCapabilities(i, r)),
                                S.debug('load() | got extended RTP capabilities:%o', this._extendedRtpCapabilities),
                                (this._canProduceByKind.audio = c.canSend('audio', this._extendedRtpCapabilities)),
                                (this._canProduceByKind.video = c.canSend('video', this._extendedRtpCapabilities)),
                                (this._recvRtpCapabilities = c.getRecvRtpCapabilities(this._extendedRtpCapabilities)),
                                c.validateRtpCapabilities(this._recvRtpCapabilities),
                                S.debug('load() | got receiving RTP capabilities:%o', this._recvRtpCapabilities),
                                (this._sctpCapabilities = await t.getNativeSctpCapabilities()),
                                S.debug('load() | got native SCTP capabilities:%o', this._sctpCapabilities),
                                c.validateSctpCapabilities(this._sctpCapabilities),
                                S.debug('load() succeeded'),
                                (this._loaded = !0),
                                t.close();
                        } catch (e) {
                            throw (t && t.close(), e);
                        }
                    }
                    canProduce(e) {
                        if (!this._loaded) throw new n.InvalidStateError('not loaded');
                        if ('audio' !== e && 'video' !== e) throw new TypeError(`invalid kind "${e}"`);
                        return this._canProduceByKind[e];
                    }
                    createSendTransport({
                        id: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        additionalSettings: o,
                        proprietaryConstraints: c,
                        appData: d,
                    }) {
                        return (
                            S.debug('createSendTransport()'),
                            this.createTransport({
                                direction: 'send',
                                id: e,
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                                iceServers: a,
                                iceTransportPolicy: n,
                                additionalSettings: o,
                                proprietaryConstraints: c,
                                appData: d,
                            })
                        );
                    }
                    createRecvTransport({
                        id: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        additionalSettings: o,
                        proprietaryConstraints: c,
                        appData: d,
                    }) {
                        return (
                            S.debug('createRecvTransport()'),
                            this.createTransport({
                                direction: 'recv',
                                id: e,
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                                iceServers: a,
                                iceTransportPolicy: n,
                                additionalSettings: o,
                                proprietaryConstraints: c,
                                appData: d,
                            })
                        );
                    }
                    createTransport({
                        direction: e,
                        id: t,
                        iceParameters: r,
                        iceCandidates: s,
                        dtlsParameters: i,
                        sctpParameters: a,
                        iceServers: o,
                        iceTransportPolicy: c,
                        additionalSettings: p,
                        proprietaryConstraints: l,
                        appData: h,
                    }) {
                        if (!this._loaded) throw new n.InvalidStateError('not loaded');
                        if ('string' != typeof t) throw new TypeError('missing id');
                        if ('object' != typeof r) throw new TypeError('missing iceParameters');
                        if (!Array.isArray(s)) throw new TypeError('missing iceCandidates');
                        if ('object' != typeof i) throw new TypeError('missing dtlsParameters');
                        if (a && 'object' != typeof a) throw new TypeError('wrong sctpParameters');
                        if (h && 'object' != typeof h) throw new TypeError('if given, appData must be an object');
                        const m = new d.Transport({
                            direction: e,
                            id: t,
                            iceParameters: r,
                            iceCandidates: s,
                            dtlsParameters: i,
                            sctpParameters: a,
                            iceServers: o,
                            iceTransportPolicy: c,
                            additionalSettings: p,
                            proprietaryConstraints: l,
                            appData: h,
                            handlerFactory: this._handlerFactory,
                            extendedRtpCapabilities: this._extendedRtpCapabilities,
                            canProduceByKind: this._canProduceByKind,
                        });
                        return this._observer.safeEmit('newtransport', m), m;
                    }
                };
            },
            6749: (e, t, r) => {
                e.exports = function (e) {
                    function t(e) {
                        let r,
                            i,
                            a,
                            n = null;
                        function o(...e) {
                            if (!o.enabled) return;
                            const s = o,
                                i = Number(new Date()),
                                a = i - (r || i);
                            (s.diff = a),
                                (s.prev = r),
                                (s.curr = i),
                                (r = i),
                                (e[0] = t.coerce(e[0])),
                                'string' != typeof e[0] && e.unshift('%O');
                            let n = 0;
                            (e[0] = e[0].replace(/%([a-zA-Z%])/g, (r, i) => {
                                if ('%%' === r) return '%';
                                n++;
                                const a = t.formatters[i];
                                if ('function' == typeof a) {
                                    const t = e[n];
                                    (r = a.call(s, t)), e.splice(n, 1), n--;
                                }
                                return r;
                            })),
                                t.formatArgs.call(s, e),
                                (s.log || t.log).apply(s, e);
                        }
                        return (
                            (o.namespace = e),
                            (o.useColors = t.useColors()),
                            (o.color = t.selectColor(e)),
                            (o.extend = s),
                            (o.destroy = t.destroy),
                            Object.defineProperty(o, 'enabled', {
                                enumerable: !0,
                                configurable: !1,
                                get: () =>
                                    null !== n
                                        ? n
                                        : (i !== t.namespaces && ((i = t.namespaces), (a = t.enabled(e))), a),
                                set: (e) => {
                                    n = e;
                                },
                            }),
                            'function' == typeof t.init && t.init(o),
                            o
                        );
                    }
                    function s(e, r) {
                        const s = t(this.namespace + (void 0 === r ? ':' : r) + e);
                        return (s.log = this.log), s;
                    }
                    function i(e, t) {
                        let r = 0,
                            s = 0,
                            i = -1,
                            a = 0;
                        for (; r < e.length; )
                            if (s < t.length && (t[s] === e[r] || '*' === t[s]))
                                '*' === t[s] ? ((i = s), (a = r), s++) : (r++, s++);
                            else {
                                if (-1 === i) return !1;
                                (s = i + 1), a++, (r = a);
                            }
                        for (; s < t.length && '*' === t[s]; ) s++;
                        return s === t.length;
                    }
                    return (
                        (t.debug = t),
                        (t.default = t),
                        (t.coerce = function (e) {
                            return e instanceof Error ? e.stack || e.message : e;
                        }),
                        (t.disable = function () {
                            const e = [...t.names, ...t.skips.map((e) => '-' + e)].join(',');
                            return t.enable(''), e;
                        }),
                        (t.enable = function (e) {
                            t.save(e), (t.namespaces = e), (t.names = []), (t.skips = []);
                            const r = ('string' == typeof e ? e : '')
                                .trim()
                                .replace(' ', ',')
                                .split(',')
                                .filter(Boolean);
                            for (const e of r) '-' === e[0] ? t.skips.push(e.slice(1)) : t.names.push(e);
                        }),
                        (t.enabled = function (e) {
                            for (const r of t.skips) if (i(e, r)) return !1;
                            for (const r of t.names) if (i(e, r)) return !0;
                            return !1;
                        }),
                        (t.humanize = r(4756)),
                        (t.destroy = function () {
                            console.warn(
                                'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.',
                            );
                        }),
                        Object.keys(e).forEach((r) => {
                            t[r] = e[r];
                        }),
                        (t.names = []),
                        (t.skips = []),
                        (t.formatters = {}),
                        (t.selectColor = function (e) {
                            let r = 0;
                            for (let t = 0; t < e.length; t++) (r = (r << 5) - r + e.charCodeAt(t)), (r |= 0);
                            return t.colors[Math.abs(r) % t.colors.length];
                        }),
                        t.enable(t.load()),
                        t
                    );
                };
            },
            6773: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s,
                    i = (s = r(9874)) && s.__esModule ? s : { default: s };
                t.default = function (e) {
                    if (!(0, i.default)(e)) throw TypeError('Invalid UUID');
                    let t;
                    const r = new Uint8Array(16);
                    return (
                        (r[0] = (t = parseInt(e.slice(0, 8), 16)) >>> 24),
                        (r[1] = (t >>> 16) & 255),
                        (r[2] = (t >>> 8) & 255),
                        (r[3] = 255 & t),
                        (r[4] = (t = parseInt(e.slice(9, 13), 16)) >>> 8),
                        (r[5] = 255 & t),
                        (r[6] = (t = parseInt(e.slice(14, 18), 16)) >>> 8),
                        (r[7] = 255 & t),
                        (r[8] = (t = parseInt(e.slice(19, 23), 16)) >>> 8),
                        (r[9] = 255 & t),
                        (r[10] = ((t = parseInt(e.slice(24, 36), 16)) / 1099511627776) & 255),
                        (r[11] = (t / 4294967296) & 255),
                        (r[12] = (t >>> 24) & 255),
                        (r[13] = (t >>> 16) & 255),
                        (r[14] = (t >>> 8) & 255),
                        (r[15] = 255 & t),
                        r
                    );
                };
            },
            7104: (e) => {
                var t = 1e3,
                    r = 60 * t,
                    s = 60 * r,
                    i = 24 * s,
                    a = 7 * i;
                function n(e, t, r, s) {
                    var i = t >= 1.5 * r;
                    return Math.round(e / r) + ' ' + s + (i ? 's' : '');
                }
                e.exports = function (e, o) {
                    o = o || {};
                    var c,
                        d,
                        p = typeof e;
                    if ('string' === p && e.length > 0)
                        return (function (e) {
                            if (!((e = String(e)).length > 100)) {
                                var n =
                                    /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
                                        e,
                                    );
                                if (n) {
                                    var o = parseFloat(n[1]);
                                    switch ((n[2] || 'ms').toLowerCase()) {
                                        case 'years':
                                        case 'year':
                                        case 'yrs':
                                        case 'yr':
                                        case 'y':
                                            return 315576e5 * o;
                                        case 'weeks':
                                        case 'week':
                                        case 'w':
                                            return o * a;
                                        case 'days':
                                        case 'day':
                                        case 'd':
                                            return o * i;
                                        case 'hours':
                                        case 'hour':
                                        case 'hrs':
                                        case 'hr':
                                        case 'h':
                                            return o * s;
                                        case 'minutes':
                                        case 'minute':
                                        case 'mins':
                                        case 'min':
                                        case 'm':
                                            return o * r;
                                        case 'seconds':
                                        case 'second':
                                        case 'secs':
                                        case 'sec':
                                        case 's':
                                            return o * t;
                                        case 'milliseconds':
                                        case 'millisecond':
                                        case 'msecs':
                                        case 'msec':
                                        case 'ms':
                                            return o;
                                        default:
                                            return;
                                    }
                                }
                            }
                        })(e);
                    if ('number' === p && isFinite(e))
                        return o.long
                            ? ((c = e),
                              (d = Math.abs(c)) >= i
                                  ? n(c, d, i, 'day')
                                  : d >= s
                                    ? n(c, d, s, 'hour')
                                    : d >= r
                                      ? n(c, d, r, 'minute')
                                      : d >= t
                                        ? n(c, d, t, 'second')
                                        : c + ' ms')
                            : (function (e) {
                                  var a = Math.abs(e);
                                  return a >= i
                                      ? Math.round(e / i) + 'd'
                                      : a >= s
                                        ? Math.round(e / s) + 'h'
                                        : a >= r
                                          ? Math.round(e / r) + 'm'
                                          : a >= t
                                            ? Math.round(e / t) + 's'
                                            : e + 'ms';
                              })(e);
                    throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(e));
                };
            },
            7363: (e, t, r) => {
                var s = r(5020),
                    i = r(3804),
                    a = r(5602);
                (t.grammar = a),
                    (t.write = i),
                    (t.parse = s.parse),
                    (t.parseParams = s.parseParams),
                    (t.parseFmtpConfig = s.parseFmtpConfig),
                    (t.parsePayloads = s.parsePayloads),
                    (t.parseRemoteCandidates = s.parseRemoteCandidates),
                    (t.parseImageAttributes = s.parseImageAttributes),
                    (t.parseSimulcastStreamList = s.parseSimulcastStreamList);
            },
            7402: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Chrome55 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(4893),
                    n = r(1765),
                    o = r(8046),
                    c = r(5544),
                    d = r(4496),
                    p = r(521),
                    l = r(1305),
                    h = new i.Logger('Chrome55'),
                    m = { OS: 1024, MIS: 1024 };
                class u extends p.HandlerInterface {
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _sendStream = new MediaStream();
                    _mapSendLocalIdTrack = new Map();
                    _nextSendLocalId = 0;
                    _mapRecvLocalIdInfo = new Map();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new u();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Chrome55';
                    }
                    close() {
                        if ((h.debug('close()'), this._pc))
                            try {
                                this._pc.close();
                            } catch (e) {}
                        this.emit('@close');
                    }
                    async getNativeRtpCapabilities() {
                        h.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'plan-b',
                        });
                        try {
                            const t = await e.createOffer({ offerToReceiveAudio: !0, offerToReceiveVideo: !0 });
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp);
                            return c.extractRtpCapabilities({ sdpObject: r });
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return h.debug('getNativeSctpCapabilities()'), { numStreams: m };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        h.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new l.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                                planB: !0,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: o.getSendingRtpParameters('audio', p),
                                video: o.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: o.getSendingRemoteRtpParameters('audio', p),
                                video: o.getSendingRemoteRtpParameters('video', p),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: n ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'plan-b',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (h.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        h.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if ((h.debug('restartIce()'), this._remoteSdp.updateIceParameters(e), this._transportReady))
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                h.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                h.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                h.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                h.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertSendDirection(),
                            h.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            i && h.warn('send() | codec selection is not available in %s handler', this.name),
                            this._sendStream.addTrack(e),
                            this._pc.addStream(this._sendStream);
                        let a,
                            p = await this._pc.createOffer(),
                            l = s.parse(p.sdp);
                        l.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed();
                        const m = n.clone(this._sendingRtpParametersByKind[e.kind]);
                        m.codecs = o.reduceCodecs(m.codecs);
                        const u = n.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        if (
                            ((u.codecs = o.reduceCodecs(u.codecs)),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: l,
                                })),
                            'video' === e.kind &&
                                t &&
                                t.length > 1 &&
                                (h.debug('send() | enabling simulcast'),
                                (l = s.parse(p.sdp)),
                                (a = l.media.find((e) => 'video' === e.type)),
                                d.addLegacySimulcast({ offerMediaObject: a, track: e, numStreams: t.length }),
                                (p = { type: 'offer', sdp: s.write(l) })),
                            h.debug('send() | calling pc.setLocalDescription() [offer:%o]', p),
                            await this._pc.setLocalDescription(p),
                            (l = s.parse(this._pc.localDescription.sdp)),
                            (a = l.media.find((t) => t.type === e.kind)),
                            (m.rtcp.cname = c.getCname({ offerMediaObject: a })),
                            (m.encodings = d.getRtpEncodings({ offerMediaObject: a, track: e })),
                            t)
                        )
                            for (let e = 0; e < m.encodings.length; ++e) t[e] && Object.assign(m.encodings[e], t[e]);
                        if (m.encodings.length > 1 && 'video/vp8' === m.codecs[0].mimeType.toLowerCase())
                            for (const e of m.encodings) e.scalabilityMode = 'L1T3';
                        this._remoteSdp.send({
                            offerMediaObject: a,
                            offerRtpParameters: m,
                            answerRtpParameters: u,
                            codecOptions: r,
                        });
                        const f = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('send() | calling pc.setRemoteDescription() [answer:%o]', f),
                            await this._pc.setRemoteDescription(f);
                        const g = String(this._nextSendLocalId);
                        return (
                            this._nextSendLocalId++,
                            this._mapSendLocalIdTrack.set(g, e),
                            { localId: g, rtpParameters: m }
                        );
                    }
                    async stopSending(e) {
                        this.assertSendDirection(), h.debug('stopSending() [localId:%s]', e);
                        const t = this._mapSendLocalIdTrack.get(e);
                        if (!t) throw new Error('track not found');
                        this._mapSendLocalIdTrack.delete(e),
                            this._sendStream.removeTrack(t),
                            this._pc.addStream(this._sendStream);
                        const r = await this._pc.createOffer();
                        h.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r);
                        try {
                            await this._pc.setLocalDescription(r);
                        } catch (e) {
                            if (0 === this._sendStream.getTracks().length)
                                return void h.warn(
                                    'stopSending() | ignoring expected error due no sending tracks: %s',
                                    e.toString(),
                                );
                            throw e;
                        }
                        if ('stable' === this._pc.signalingState) return;
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async pauseSending(e) {}
                    async resumeSending(e) {}
                    async replaceTrack(e, t) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async setMaxSpatialLayer(e, t) {
                        throw new a.UnsupportedError(' not implemented');
                    }
                    async setRtpEncodingParameters(e, t) {
                        throw new a.UnsupportedError('not supported');
                    }
                    async getSenderStats(e) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmitTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        h.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % m.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                h.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            h.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertRecvDirection();
                        const t = [];
                        for (const t of e) {
                            const { trackId: e, kind: r, rtpParameters: s, streamId: i } = t;
                            h.debug('receive() [trackId:%s, kind:%s]', e, r);
                            const a = r;
                            this._remoteSdp.receive({
                                mid: a,
                                kind: r,
                                offerRtpParameters: s,
                                streamId: i ?? s.rtcp.cname,
                                trackId: e,
                            });
                        }
                        const r = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        h.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', r),
                            await this._pc.setRemoteDescription(r);
                        let i = await this._pc.createAnswer();
                        const a = s.parse(i.sdp);
                        for (const t of e) {
                            const { kind: e, rtpParameters: r } = t,
                                s = e,
                                i = a.media.find((e) => String(e.mid) === s);
                            c.applyCodecParameters({ offerRtpParameters: r, answerMediaObject: i });
                        }
                        (i = { type: 'answer', sdp: s.write(a) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: a,
                                })),
                            h.debug('receive() | calling pc.setLocalDescription() [answer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        for (const r of e) {
                            const { kind: e, trackId: s, rtpParameters: i } = r,
                                a = e,
                                n = s,
                                o = r.streamId ?? i.rtcp.cname,
                                c = this._pc
                                    .getRemoteStreams()
                                    .find((e) => e.id === o)
                                    .getTrackById(n);
                            if (!c) throw new Error('remote track not found');
                            this._mapRecvLocalIdInfo.set(n, { mid: a, rtpParameters: i }),
                                t.push({ localId: n, track: c });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        this.assertRecvDirection();
                        for (const t of e) {
                            h.debug('stopReceiving() [localId:%s]', t);
                            const { mid: e, rtpParameters: r } = this._mapRecvLocalIdInfo.get(t) ?? {};
                            this._mapRecvLocalIdInfo.delete(t),
                                this._remoteSdp.planBStopReceiving({ mid: e, offerRtpParameters: r });
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        h.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        h.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async pauseReceiving(e) {}
                    async resumeReceiving(e) {}
                    async getReceiverStats(e) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmitTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        h.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation({ oldDataChannelSpec: !0 });
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            h.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            h.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = c.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Chrome55 = u;
            },
            7504: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.DataProducer = void 0);
                const s = r(2994),
                    i = r(3953),
                    a = r(4893),
                    n = new s.Logger('DataProducer');
                class o extends i.EnhancedEventEmitter {
                    _id;
                    _dataChannel;
                    _closed = !1;
                    _sctpStreamParameters;
                    _appData;
                    _observer = new i.EnhancedEventEmitter();
                    constructor({ id: e, dataChannel: t, sctpStreamParameters: r, appData: s }) {
                        super(),
                            n.debug('constructor()'),
                            (this._id = e),
                            (this._dataChannel = t),
                            (this._sctpStreamParameters = r),
                            (this._appData = s ?? {}),
                            this.handleDataChannel();
                    }
                    get id() {
                        return this._id;
                    }
                    get closed() {
                        return this._closed;
                    }
                    get sctpStreamParameters() {
                        return this._sctpStreamParameters;
                    }
                    get readyState() {
                        return this._dataChannel.readyState;
                    }
                    get label() {
                        return this._dataChannel.label;
                    }
                    get protocol() {
                        return this._dataChannel.protocol;
                    }
                    get bufferedAmount() {
                        return this._dataChannel.bufferedAmount;
                    }
                    get bufferedAmountLowThreshold() {
                        return this._dataChannel.bufferedAmountLowThreshold;
                    }
                    set bufferedAmountLowThreshold(e) {
                        this._dataChannel.bufferedAmountLowThreshold = e;
                    }
                    get appData() {
                        return this._appData;
                    }
                    set appData(e) {
                        this._appData = e;
                    }
                    get observer() {
                        return this._observer;
                    }
                    close() {
                        this._closed ||
                            (n.debug('close()'),
                            (this._closed = !0),
                            this._dataChannel.close(),
                            this.emit('@close'),
                            this._observer.safeEmit('close'));
                    }
                    transportClosed() {
                        this._closed ||
                            (n.debug('transportClosed()'),
                            (this._closed = !0),
                            this._dataChannel.close(),
                            this.safeEmit('transportclose'),
                            this._observer.safeEmit('close'));
                    }
                    send(e) {
                        if ((n.debug('send()'), this._closed)) throw new a.InvalidStateError('closed');
                        this._dataChannel.send(e);
                    }
                    handleDataChannel() {
                        this._dataChannel.addEventListener('open', () => {
                            this._closed || (n.debug('DataChannel "open" event'), this.safeEmit('open'));
                        }),
                            this._dataChannel.addEventListener('error', (e) => {
                                if (this._closed) return;
                                let { error: t } = e;
                                t || (t = new Error('unknown DataChannel error')),
                                    'sctp-failure' === t.errorDetail
                                        ? n.error(
                                              'DataChannel SCTP error [sctpCauseCode:%s]: %s',
                                              t.sctpCauseCode,
                                              t.message,
                                          )
                                        : n.error('DataChannel "error" event: %o', t),
                                    this.safeEmit('error', t);
                            }),
                            this._dataChannel.addEventListener('close', () => {
                                this._closed ||
                                    (n.warn('DataChannel "close" event'),
                                    (this._closed = !0),
                                    this.emit('@close'),
                                    this.safeEmit('close'),
                                    this._observer.safeEmit('close'));
                            }),
                            this._dataChannel.addEventListener('message', () => {
                                this._closed ||
                                    n.warn('DataChannel "message" event in a DataProducer, message discarded');
                            }),
                            this._dataChannel.addEventListener('bufferedamountlow', () => {
                                this._closed || this.safeEmit('bufferedamountlow');
                            });
                    }
                }
                t.DataProducer = o;
            },
            7965: (e, t) => {
                'use strict';
                function r(e, t, r, s) {
                    switch (e) {
                        case 0:
                            return (t & r) ^ (~t & s);
                        case 1:
                        case 3:
                            return t ^ r ^ s;
                        case 2:
                            return (t & r) ^ (t & s) ^ (r & s);
                    }
                }
                function s(e, t) {
                    return (e << t) | (e >>> (32 - t));
                }
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                t.default = function (e) {
                    const t = [1518500249, 1859775393, 2400959708, 3395469782],
                        i = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
                    if ('string' == typeof e) {
                        const t = unescape(encodeURIComponent(e));
                        e = [];
                        for (let r = 0; r < t.length; ++r) e.push(t.charCodeAt(r));
                    } else Array.isArray(e) || (e = Array.prototype.slice.call(e));
                    e.push(128);
                    const a = e.length / 4 + 2,
                        n = Math.ceil(a / 16),
                        o = new Array(n);
                    for (let t = 0; t < n; ++t) {
                        const r = new Uint32Array(16);
                        for (let s = 0; s < 16; ++s)
                            r[s] =
                                (e[64 * t + 4 * s] << 24) |
                                (e[64 * t + 4 * s + 1] << 16) |
                                (e[64 * t + 4 * s + 2] << 8) |
                                e[64 * t + 4 * s + 3];
                        o[t] = r;
                    }
                    (o[n - 1][14] = (8 * (e.length - 1)) / Math.pow(2, 32)),
                        (o[n - 1][14] = Math.floor(o[n - 1][14])),
                        (o[n - 1][15] = (8 * (e.length - 1)) & 4294967295);
                    for (let e = 0; e < n; ++e) {
                        const a = new Uint32Array(80);
                        for (let t = 0; t < 16; ++t) a[t] = o[e][t];
                        for (let e = 16; e < 80; ++e) a[e] = s(a[e - 3] ^ a[e - 8] ^ a[e - 14] ^ a[e - 16], 1);
                        let n = i[0],
                            c = i[1],
                            d = i[2],
                            p = i[3],
                            l = i[4];
                        for (let e = 0; e < 80; ++e) {
                            const i = Math.floor(e / 20),
                                o = (s(n, 5) + r(i, c, d, p) + l + t[i] + a[e]) >>> 0;
                            (l = p), (p = d), (d = s(c, 30) >>> 0), (c = n), (n = o);
                        }
                        (i[0] = (i[0] + n) >>> 0),
                            (i[1] = (i[1] + c) >>> 0),
                            (i[2] = (i[2] + d) >>> 0),
                            (i[3] = (i[3] + p) >>> 0),
                            (i[4] = (i[4] + l) >>> 0);
                    }
                    return [
                        (i[0] >> 24) & 255,
                        (i[0] >> 16) & 255,
                        (i[0] >> 8) & 255,
                        255 & i[0],
                        (i[1] >> 24) & 255,
                        (i[1] >> 16) & 255,
                        (i[1] >> 8) & 255,
                        255 & i[1],
                        (i[2] >> 24) & 255,
                        (i[2] >> 16) & 255,
                        (i[2] >> 8) & 255,
                        255 & i[2],
                        (i[3] >> 24) & 255,
                        (i[3] >> 16) & 255,
                        (i[3] >> 8) & 255,
                        255 & i[3],
                        (i[4] >> 24) & 255,
                        (i[4] >> 16) & 255,
                        (i[4] >> 8) & 255,
                        255 & i[4],
                    ];
                };
            },
            8046: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.validateRtpCapabilities = function (e) {
                        if ('object' != typeof e) throw new TypeError('caps is not an object');
                        if (e.codecs && !Array.isArray(e.codecs)) throw new TypeError('caps.codecs is not an array');
                        e.codecs || (e.codecs = []);
                        for (const t of e.codecs) d(t);
                        if (e.headerExtensions && !Array.isArray(e.headerExtensions))
                            throw new TypeError('caps.headerExtensions is not an array');
                        e.headerExtensions || (e.headerExtensions = []);
                        for (const t of e.headerExtensions) l(t);
                    }),
                    (t.validateRtpParameters = c),
                    (t.validateSctpStreamParameters = function (e) {
                        if ('object' != typeof e) throw new TypeError('params is not an object');
                        if ('number' != typeof e.streamId) throw new TypeError('missing params.streamId');
                        let t = !1;
                        if (
                            ('boolean' == typeof e.ordered ? (t = !0) : (e.ordered = !0),
                            e.maxPacketLifeTime && 'number' != typeof e.maxPacketLifeTime)
                        )
                            throw new TypeError('invalid params.maxPacketLifeTime');
                        if (e.maxRetransmits && 'number' != typeof e.maxRetransmits)
                            throw new TypeError('invalid params.maxRetransmits');
                        if (e.maxPacketLifeTime && e.maxRetransmits)
                            throw new TypeError('cannot provide both maxPacketLifeTime and maxRetransmits');
                        if (t && e.ordered && (e.maxPacketLifeTime || e.maxRetransmits))
                            throw new TypeError('cannot be ordered with maxPacketLifeTime or maxRetransmits');
                        if (
                            (t || (!e.maxPacketLifeTime && !e.maxRetransmits) || (e.ordered = !1),
                            e.label && 'string' != typeof e.label)
                        )
                            throw new TypeError('invalid params.label');
                        if (e.protocol && 'string' != typeof e.protocol) throw new TypeError('invalid params.protocol');
                    }),
                    (t.validateSctpCapabilities = function (e) {
                        if ('object' != typeof e) throw new TypeError('caps is not an object');
                        if (!e.numStreams || 'object' != typeof e.numStreams)
                            throw new TypeError('missing caps.numStreams');
                        !(function (e) {
                            if ('object' != typeof e) throw new TypeError('numStreams is not an object');
                            if ('number' != typeof e.OS) throw new TypeError('missing numStreams.OS');
                            if ('number' != typeof e.MIS) throw new TypeError('missing numStreams.MIS');
                        })(e.numStreams);
                    }),
                    (t.getExtendedRtpCapabilities = function (e, t) {
                        const r = { codecs: [], headerExtensions: [] };
                        for (const s of t.codecs ?? []) {
                            if (f(s)) continue;
                            const t = (e.codecs ?? []).find((e) => g(e, s, { strict: !0, modify: !0 }));
                            if (!t) continue;
                            const i = {
                                mimeType: t.mimeType,
                                kind: t.kind,
                                clockRate: t.clockRate,
                                channels: t.channels,
                                localPayloadType: t.preferredPayloadType,
                                localRtxPayloadType: void 0,
                                remotePayloadType: s.preferredPayloadType,
                                remoteRtxPayloadType: void 0,
                                localParameters: t.parameters,
                                remoteParameters: s.parameters,
                                rtcpFeedback: _(t, s),
                            };
                            r.codecs.push(i);
                        }
                        for (const s of r.codecs) {
                            const r = e.codecs.find((e) => f(e) && e.parameters.apt === s.localPayloadType),
                                i = t.codecs.find((e) => f(e) && e.parameters.apt === s.remotePayloadType);
                            r &&
                                i &&
                                ((s.localRtxPayloadType = r.preferredPayloadType),
                                (s.remoteRtxPayloadType = i.preferredPayloadType));
                        }
                        for (const s of t.headerExtensions) {
                            const t = e.headerExtensions.find((e) => {
                                return (r = s), !(((t = e).kind && r.kind && t.kind !== r.kind) || t.uri !== r.uri);
                                var t, r;
                            });
                            if (!t) continue;
                            const i = {
                                kind: s.kind,
                                uri: s.uri,
                                sendId: t.preferredId,
                                recvId: s.preferredId,
                                encrypt: t.preferredEncrypt,
                                direction: 'sendrecv',
                            };
                            switch (s.direction) {
                                case 'sendrecv':
                                    i.direction = 'sendrecv';
                                    break;
                                case 'recvonly':
                                    i.direction = 'sendonly';
                                    break;
                                case 'sendonly':
                                    i.direction = 'recvonly';
                                    break;
                                case 'inactive':
                                    i.direction = 'inactive';
                            }
                            r.headerExtensions.push(i);
                        }
                        return r;
                    }),
                    (t.getRecvRtpCapabilities = function (e) {
                        const t = { codecs: [], headerExtensions: [] };
                        for (const r of e.codecs) {
                            const e = {
                                mimeType: r.mimeType,
                                kind: r.kind,
                                preferredPayloadType: r.remotePayloadType,
                                clockRate: r.clockRate,
                                channels: r.channels,
                                parameters: r.localParameters,
                                rtcpFeedback: r.rtcpFeedback,
                            };
                            if ((t.codecs.push(e), !r.remoteRtxPayloadType)) continue;
                            const s = {
                                mimeType: `${r.kind}/rtx`,
                                kind: r.kind,
                                preferredPayloadType: r.remoteRtxPayloadType,
                                clockRate: r.clockRate,
                                parameters: { apt: r.remotePayloadType },
                                rtcpFeedback: [],
                            };
                            t.codecs.push(s);
                        }
                        for (const r of e.headerExtensions) {
                            if ('sendrecv' !== r.direction && 'recvonly' !== r.direction) continue;
                            const e = {
                                kind: r.kind,
                                uri: r.uri,
                                preferredId: r.recvId,
                                preferredEncrypt: r.encrypt,
                                direction: r.direction,
                            };
                            t.headerExtensions.push(e);
                        }
                        return t;
                    }),
                    (t.getSendingRtpParameters = function (e, t) {
                        const r = { mid: void 0, codecs: [], headerExtensions: [], encodings: [], rtcp: {} };
                        for (const s of t.codecs) {
                            if (s.kind !== e) continue;
                            const t = {
                                mimeType: s.mimeType,
                                payloadType: s.localPayloadType,
                                clockRate: s.clockRate,
                                channels: s.channels,
                                parameters: s.localParameters,
                                rtcpFeedback: s.rtcpFeedback,
                            };
                            if ((r.codecs.push(t), s.localRtxPayloadType)) {
                                const e = {
                                    mimeType: `${s.kind}/rtx`,
                                    payloadType: s.localRtxPayloadType,
                                    clockRate: s.clockRate,
                                    parameters: { apt: s.localPayloadType },
                                    rtcpFeedback: [],
                                };
                                r.codecs.push(e);
                            }
                        }
                        for (const s of t.headerExtensions) {
                            if ((s.kind && s.kind !== e) || ('sendrecv' !== s.direction && 'sendonly' !== s.direction))
                                continue;
                            const t = { uri: s.uri, id: s.sendId, encrypt: s.encrypt, parameters: {} };
                            r.headerExtensions.push(t);
                        }
                        return r;
                    }),
                    (t.getSendingRemoteRtpParameters = function (e, t) {
                        const r = { mid: void 0, codecs: [], headerExtensions: [], encodings: [], rtcp: {} };
                        for (const s of t.codecs) {
                            if (s.kind !== e) continue;
                            const t = {
                                mimeType: s.mimeType,
                                payloadType: s.localPayloadType,
                                clockRate: s.clockRate,
                                channels: s.channels,
                                parameters: s.remoteParameters,
                                rtcpFeedback: s.rtcpFeedback,
                            };
                            if ((r.codecs.push(t), s.localRtxPayloadType)) {
                                const e = {
                                    mimeType: `${s.kind}/rtx`,
                                    payloadType: s.localRtxPayloadType,
                                    clockRate: s.clockRate,
                                    parameters: { apt: s.localPayloadType },
                                    rtcpFeedback: [],
                                };
                                r.codecs.push(e);
                            }
                        }
                        for (const s of t.headerExtensions) {
                            if ((s.kind && s.kind !== e) || ('sendrecv' !== s.direction && 'sendonly' !== s.direction))
                                continue;
                            const t = { uri: s.uri, id: s.sendId, encrypt: s.encrypt, parameters: {} };
                            r.headerExtensions.push(t);
                        }
                        if (
                            r.headerExtensions.some(
                                (e) =>
                                    'http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01' ===
                                    e.uri,
                            )
                        )
                            for (const e of r.codecs)
                                e.rtcpFeedback = (e.rtcpFeedback ?? []).filter((e) => 'goog-remb' !== e.type);
                        else if (
                            r.headerExtensions.some(
                                (e) => 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time' === e.uri,
                            )
                        )
                            for (const e of r.codecs)
                                e.rtcpFeedback = (e.rtcpFeedback ?? []).filter((e) => 'transport-cc' !== e.type);
                        else
                            for (const e of r.codecs)
                                e.rtcpFeedback = (e.rtcpFeedback ?? []).filter(
                                    (e) => 'transport-cc' !== e.type && 'goog-remb' !== e.type,
                                );
                        return r;
                    }),
                    (t.reduceCodecs = function (e, t) {
                        const r = [];
                        if (t) {
                            for (let s = 0; s < e.length; ++s)
                                if (g(e[s], t, { strict: !0 })) {
                                    r.push(e[s]), f(e[s + 1]) && r.push(e[s + 1]);
                                    break;
                                }
                            if (0 === r.length) throw new TypeError('no matching codec found');
                        } else r.push(e[0]), f(e[1]) && r.push(e[1]);
                        return r;
                    }),
                    (t.generateProbatorRtpParameters = function (e) {
                        c((e = i.clone(e)));
                        const t = {
                            mid: a,
                            codecs: [],
                            headerExtensions: [],
                            encodings: [{ ssrc: n }],
                            rtcp: { cname: 'probator' },
                        };
                        return (
                            t.codecs.push(e.codecs[0]),
                            (t.codecs[0].payloadType = o),
                            (t.headerExtensions = e.headerExtensions),
                            t
                        );
                    }),
                    (t.canSend = function (e, t) {
                        return t.codecs.some((t) => t.kind === e);
                    }),
                    (t.canReceive = function (e, t) {
                        if ((c(e), 0 === e.codecs.length)) return !1;
                        const r = e.codecs[0];
                        return t.codecs.some((e) => e.remotePayloadType === r.payloadType);
                    });
                const s = r(3200),
                    i = r(1765),
                    a = 'probator',
                    n = 1234,
                    o = 127;
                function c(e) {
                    if ('object' != typeof e) throw new TypeError('params is not an object');
                    if (e.mid && 'string' != typeof e.mid) throw new TypeError('params.mid is not a string');
                    if (!Array.isArray(e.codecs)) throw new TypeError('missing params.codecs');
                    for (const t of e.codecs) h(t);
                    if (e.headerExtensions && !Array.isArray(e.headerExtensions))
                        throw new TypeError('params.headerExtensions is not an array');
                    e.headerExtensions || (e.headerExtensions = []);
                    for (const t of e.headerExtensions) m(t);
                    if (e.encodings && !Array.isArray(e.encodings))
                        throw new TypeError('params.encodings is not an array');
                    e.encodings || (e.encodings = []);
                    for (const t of e.encodings) u(t);
                    if (e.rtcp && 'object' != typeof e.rtcp) throw new TypeError('params.rtcp is not an object');
                    e.rtcp || (e.rtcp = {}),
                        (function (e) {
                            if ('object' != typeof e) throw new TypeError('rtcp is not an object');
                            if (e.cname && 'string' != typeof e.cname) throw new TypeError('invalid rtcp.cname');
                            (e.reducedSize && 'boolean' == typeof e.reducedSize) || (e.reducedSize = !0);
                        })(e.rtcp);
                }
                function d(e) {
                    const t = new RegExp('^(audio|video)/(.+)', 'i');
                    if ('object' != typeof e) throw new TypeError('codec is not an object');
                    if (!e.mimeType || 'string' != typeof e.mimeType) throw new TypeError('missing codec.mimeType');
                    const r = t.exec(e.mimeType);
                    if (!r) throw new TypeError('invalid codec.mimeType');
                    if (
                        ((e.kind = r[1].toLowerCase()),
                        e.preferredPayloadType && 'number' != typeof e.preferredPayloadType)
                    )
                        throw new TypeError('invalid codec.preferredPayloadType');
                    if ('number' != typeof e.clockRate) throw new TypeError('missing codec.clockRate');
                    'audio' === e.kind ? 'number' != typeof e.channels && (e.channels = 1) : delete e.channels,
                        (e.parameters && 'object' == typeof e.parameters) || (e.parameters = {});
                    for (const t of Object.keys(e.parameters)) {
                        let r = e.parameters[t];
                        if (
                            (void 0 === r && ((e.parameters[t] = ''), (r = '')),
                            'string' != typeof r && 'number' != typeof r)
                        )
                            throw new TypeError(`invalid codec parameter [key:${t}s, value:${r}]`);
                        if ('apt' === t && 'number' != typeof r) throw new TypeError('invalid codec apt parameter');
                    }
                    (e.rtcpFeedback && Array.isArray(e.rtcpFeedback)) || (e.rtcpFeedback = []);
                    for (const t of e.rtcpFeedback) p(t);
                }
                function p(e) {
                    if ('object' != typeof e) throw new TypeError('fb is not an object');
                    if (!e.type || 'string' != typeof e.type) throw new TypeError('missing fb.type');
                    (e.parameter && 'string' == typeof e.parameter) || (e.parameter = '');
                }
                function l(e) {
                    if ('object' != typeof e) throw new TypeError('ext is not an object');
                    if ('audio' !== e.kind && 'video' !== e.kind) throw new TypeError('invalid ext.kind');
                    if (!e.uri || 'string' != typeof e.uri) throw new TypeError('missing ext.uri');
                    if ('number' != typeof e.preferredId) throw new TypeError('missing ext.preferredId');
                    if (e.preferredEncrypt && 'boolean' != typeof e.preferredEncrypt)
                        throw new TypeError('invalid ext.preferredEncrypt');
                    if (
                        (e.preferredEncrypt || (e.preferredEncrypt = !1), e.direction && 'string' != typeof e.direction)
                    )
                        throw new TypeError('invalid ext.direction');
                    e.direction || (e.direction = 'sendrecv');
                }
                function h(e) {
                    const t = new RegExp('^(audio|video)/(.+)', 'i');
                    if ('object' != typeof e) throw new TypeError('codec is not an object');
                    if (!e.mimeType || 'string' != typeof e.mimeType) throw new TypeError('missing codec.mimeType');
                    const r = t.exec(e.mimeType);
                    if (!r) throw new TypeError('invalid codec.mimeType');
                    if ('number' != typeof e.payloadType) throw new TypeError('missing codec.payloadType');
                    if ('number' != typeof e.clockRate) throw new TypeError('missing codec.clockRate');
                    'audio' === r[1].toLowerCase()
                        ? 'number' != typeof e.channels && (e.channels = 1)
                        : delete e.channels,
                        (e.parameters && 'object' == typeof e.parameters) || (e.parameters = {});
                    for (const t of Object.keys(e.parameters)) {
                        let r = e.parameters[t];
                        if (
                            (void 0 === r && ((e.parameters[t] = ''), (r = '')),
                            'string' != typeof r && 'number' != typeof r)
                        )
                            throw new TypeError(`invalid codec parameter [key:${t}s, value:${r}]`);
                        if ('apt' === t && 'number' != typeof r) throw new TypeError('invalid codec apt parameter');
                    }
                    (e.rtcpFeedback && Array.isArray(e.rtcpFeedback)) || (e.rtcpFeedback = []);
                    for (const t of e.rtcpFeedback) p(t);
                }
                function m(e) {
                    if ('object' != typeof e) throw new TypeError('ext is not an object');
                    if (!e.uri || 'string' != typeof e.uri) throw new TypeError('missing ext.uri');
                    if ('number' != typeof e.id) throw new TypeError('missing ext.id');
                    if (e.encrypt && 'boolean' != typeof e.encrypt) throw new TypeError('invalid ext.encrypt');
                    e.encrypt || (e.encrypt = !1),
                        (e.parameters && 'object' == typeof e.parameters) || (e.parameters = {});
                    for (const t of Object.keys(e.parameters)) {
                        let r = e.parameters[t];
                        if (
                            (void 0 === r && ((e.parameters[t] = ''), (r = '')),
                            'string' != typeof r && 'number' != typeof r)
                        )
                            throw new TypeError('invalid header extension parameter');
                    }
                }
                function u(e) {
                    if ('object' != typeof e) throw new TypeError('encoding is not an object');
                    if (e.ssrc && 'number' != typeof e.ssrc) throw new TypeError('invalid encoding.ssrc');
                    if (e.rid && 'string' != typeof e.rid) throw new TypeError('invalid encoding.rid');
                    if (e.rtx && 'object' != typeof e.rtx) throw new TypeError('invalid encoding.rtx');
                    if (e.rtx && 'number' != typeof e.rtx.ssrc) throw new TypeError('missing encoding.rtx.ssrc');
                    if (
                        ((e.dtx && 'boolean' == typeof e.dtx) || (e.dtx = !1),
                        e.scalabilityMode && 'string' != typeof e.scalabilityMode)
                    )
                        throw new TypeError('invalid encoding.scalabilityMode');
                }
                function f(e) {
                    return !!e && /.+\/rtx$/i.test(e.mimeType);
                }
                function g(e, t, { strict: r = !1, modify: i = !1 } = {}) {
                    const a = e.mimeType.toLowerCase();
                    if (a !== t.mimeType.toLowerCase()) return !1;
                    if (e.clockRate !== t.clockRate) return !1;
                    if (e.channels !== t.channels) return !1;
                    switch (a) {
                        case 'video/h264':
                            if (r) {
                                if (
                                    (e.parameters['packetization-mode'] ?? 0) !==
                                    (t.parameters['packetization-mode'] ?? 0)
                                )
                                    return !1;
                                if (!s.isSameProfile(e.parameters, t.parameters)) return !1;
                                let r;
                                try {
                                    r = s.generateProfileLevelIdStringForAnswer(e.parameters, t.parameters);
                                } catch (e) {
                                    return !1;
                                }
                                i &&
                                    (r
                                        ? ((e.parameters['profile-level-id'] = r),
                                          (t.parameters['profile-level-id'] = r))
                                        : (delete e.parameters['profile-level-id'],
                                          delete t.parameters['profile-level-id']));
                            }
                            break;
                        case 'video/vp9':
                            if (r && (e.parameters['profile-id'] ?? 0) !== (t.parameters['profile-id'] ?? 0)) return !1;
                    }
                    return !0;
                }
                function _(e, t) {
                    const r = [];
                    for (const s of e.rtcpFeedback ?? []) {
                        const e = (t.rtcpFeedback ?? []).find(
                            (e) => e.type === s.type && (e.parameter === s.parameter || (!e.parameter && !s.parameter)),
                        );
                        e && r.push(e);
                    }
                    return r;
                }
            },
            8057: function (e, t, r) {
                'use strict';
                var s =
                        (this && this.__createBinding) ||
                        (Object.create
                            ? function (e, t, r, s) {
                                  void 0 === s && (s = r);
                                  var i = Object.getOwnPropertyDescriptor(t, r);
                                  (i && !('get' in i ? !t.__esModule : i.writable || i.configurable)) ||
                                      (i = {
                                          enumerable: !0,
                                          get: function () {
                                              return t[r];
                                          },
                                      }),
                                      Object.defineProperty(e, s, i);
                              }
                            : function (e, t, r, s) {
                                  void 0 === s && (s = r), (e[s] = t[r]);
                              }),
                    i =
                        (this && this.__exportStar) ||
                        function (e, t) {
                            for (var r in e)
                                'default' === r || Object.prototype.hasOwnProperty.call(t, r) || s(t, e, r);
                        };
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    i(r(6004), t),
                    i(r(5601), t),
                    i(r(9792), t),
                    i(r(3518), t),
                    i(r(7504), t),
                    i(r(9166), t),
                    i(r(5370), t),
                    i(r(4160), t),
                    i(r(521), t),
                    i(r(4893), t);
            },
            8155: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Chrome67 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(4496),
                    d = r(521),
                    p = r(1305),
                    l = new i.Logger('Chrome67'),
                    h = { OS: 1024, MIS: 1024 };
                class m extends d.HandlerInterface {
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _sendStream = new MediaStream();
                    _mapSendLocalIdRtpSender = new Map();
                    _nextSendLocalId = 0;
                    _mapRecvLocalIdInfo = new Map();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new m();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Chrome67';
                    }
                    close() {
                        if ((l.debug('close()'), this._pc))
                            try {
                                this._pc.close();
                            } catch (e) {}
                        this.emit('@close');
                    }
                    async getNativeRtpCapabilities() {
                        l.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'plan-b',
                        });
                        try {
                            const t = await e.createOffer({ offerToReceiveAudio: !0, offerToReceiveVideo: !0 });
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp);
                            return o.extractRtpCapabilities({ sdpObject: r });
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return l.debug('getNativeSctpCapabilities()'), { numStreams: h };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: h,
                    }) {
                        l.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new p.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                                planB: !0,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', h),
                                video: n.getSendingRtpParameters('video', h),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', h),
                                video: n.getSendingRemoteRtpParameters('video', h),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'plan-b',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (l.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        l.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if ((l.debug('restartIce()'), this._remoteSdp.updateIceParameters(e), this._transportReady))
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                l.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                l.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                l.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                l.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertSendDirection(),
                            l.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            i && l.warn('send() | codec selection is not available in %s handler', this.name),
                            this._sendStream.addTrack(e),
                            this._pc.addTrack(e, this._sendStream);
                        let d,
                            p = await this._pc.createOffer(),
                            h = s.parse(p.sdp);
                        h.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed();
                        const m = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        m.codecs = n.reduceCodecs(m.codecs);
                        const u = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        if (
                            ((u.codecs = n.reduceCodecs(u.codecs)),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: h,
                                })),
                            'video' === e.kind &&
                                t &&
                                t.length > 1 &&
                                (l.debug('send() | enabling simulcast'),
                                (h = s.parse(p.sdp)),
                                (d = h.media.find((e) => 'video' === e.type)),
                                c.addLegacySimulcast({ offerMediaObject: d, track: e, numStreams: t.length }),
                                (p = { type: 'offer', sdp: s.write(h) })),
                            l.debug('send() | calling pc.setLocalDescription() [offer:%o]', p),
                            await this._pc.setLocalDescription(p),
                            (h = s.parse(this._pc.localDescription.sdp)),
                            (d = h.media.find((t) => t.type === e.kind)),
                            (m.rtcp.cname = o.getCname({ offerMediaObject: d })),
                            (m.encodings = c.getRtpEncodings({ offerMediaObject: d, track: e })),
                            t)
                        )
                            for (let e = 0; e < m.encodings.length; ++e) t[e] && Object.assign(m.encodings[e], t[e]);
                        if (m.encodings.length > 1 && 'video/vp8' === m.codecs[0].mimeType.toLowerCase())
                            for (const e of m.encodings) e.scalabilityMode = 'L1T3';
                        this._remoteSdp.send({
                            offerMediaObject: d,
                            offerRtpParameters: m,
                            answerRtpParameters: u,
                            codecOptions: r,
                        });
                        const f = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        l.debug('send() | calling pc.setRemoteDescription() [answer:%o]', f),
                            await this._pc.setRemoteDescription(f);
                        const g = String(this._nextSendLocalId);
                        this._nextSendLocalId++;
                        const _ = this._pc.getSenders().find((t) => t.track === e);
                        return this._mapSendLocalIdRtpSender.set(g, _), { localId: g, rtpParameters: m, rtpSender: _ };
                    }
                    async stopSending(e) {
                        this.assertSendDirection(), l.debug('stopSending() [localId:%s]', e);
                        const t = this._mapSendLocalIdRtpSender.get(e);
                        if (!t) throw new Error('associated RTCRtpSender not found');
                        this._pc.removeTrack(t),
                            t.track && this._sendStream.removeTrack(t.track),
                            this._mapSendLocalIdRtpSender.delete(e);
                        const r = await this._pc.createOffer();
                        l.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r);
                        try {
                            await this._pc.setLocalDescription(r);
                        } catch (e) {
                            if (0 === this._sendStream.getTracks().length)
                                return void l.warn(
                                    'stopSending() | ignoring expected error due no sending tracks: %s',
                                    e.toString(),
                                );
                            throw e;
                        }
                        if ('stable' === this._pc.signalingState) return;
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        l.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async pauseSending(e) {}
                    async resumeSending(e) {}
                    async replaceTrack(e, t) {
                        this.assertSendDirection(),
                            t
                                ? l.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : l.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapSendLocalIdRtpSender.get(e);
                        if (!r) throw new Error('associated RTCRtpSender not found');
                        const s = r.track;
                        await r.replaceTrack(t),
                            s && this._sendStream.removeTrack(s),
                            t && this._sendStream.addTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertSendDirection(), l.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapSendLocalIdRtpSender.get(e);
                        if (!r) throw new Error('associated RTCRtpSender not found');
                        const s = r.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.setParameters(s);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertSendDirection(), l.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapSendLocalIdRtpSender.get(e);
                        if (!r) throw new Error('associated RTCRtpSender not found');
                        const s = r.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.setParameters(s);
                    }
                    async getSenderStats(e) {
                        this.assertSendDirection();
                        const t = this._mapSendLocalIdRtpSender.get(e);
                        if (!t) throw new Error('associated RTCRtpSender not found');
                        return t.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmitTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        l.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % h.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                l.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            l.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertRecvDirection();
                        const t = [];
                        for (const t of e) {
                            const { trackId: e, kind: r, rtpParameters: s, streamId: i } = t;
                            l.debug('receive() [trackId:%s, kind:%s]', e, r);
                            const a = r;
                            this._remoteSdp.receive({
                                mid: a,
                                kind: r,
                                offerRtpParameters: s,
                                streamId: i ?? s.rtcp.cname,
                                trackId: e,
                            });
                        }
                        const r = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        l.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', r),
                            await this._pc.setRemoteDescription(r);
                        let i = await this._pc.createAnswer();
                        const a = s.parse(i.sdp);
                        for (const t of e) {
                            const { kind: e, rtpParameters: r } = t,
                                s = e,
                                i = a.media.find((e) => String(e.mid) === s);
                            o.applyCodecParameters({ offerRtpParameters: r, answerMediaObject: i });
                        }
                        (i = { type: 'answer', sdp: s.write(a) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: a,
                                })),
                            l.debug('receive() | calling pc.setLocalDescription() [answer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        for (const r of e) {
                            const { kind: e, trackId: s, rtpParameters: i } = r,
                                a = s,
                                n = e,
                                o = this._pc.getReceivers().find((e) => e.track && e.track.id === a);
                            if (!o) throw new Error('new RTCRtpReceiver not');
                            this._mapRecvLocalIdInfo.set(a, { mid: n, rtpParameters: i, rtpReceiver: o }),
                                t.push({ localId: a, track: o.track, rtpReceiver: o });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        this.assertRecvDirection();
                        for (const t of e) {
                            l.debug('stopReceiving() [localId:%s]', t);
                            const { mid: e, rtpParameters: r } = this._mapRecvLocalIdInfo.get(t) ?? {};
                            this._mapRecvLocalIdInfo.delete(t),
                                this._remoteSdp.planBStopReceiving({ mid: e, offerRtpParameters: r });
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        l.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        l.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async pauseReceiving(e) {}
                    async resumeReceiving(e) {}
                    async getReceiverStats(e) {
                        this.assertRecvDirection();
                        const { rtpReceiver: t } = this._mapRecvLocalIdInfo.get(e) ?? {};
                        if (!t) throw new Error('associated RTCRtpReceiver not found');
                        return t.getStats();
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmitTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        l.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation({ oldDataChannelSpec: !0 });
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            l.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            l.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Chrome67 = m;
            },
            8274: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Logger = void 0);
                const s = r(1814),
                    i = 'awaitqueue';
                t.Logger = class {
                    constructor(e) {
                        e
                            ? ((this._debug = s(`${i}:${e}`)),
                              (this._warn = s(`${i}:WARN:${e}`)),
                              (this._error = s(`${i}:ERROR:${e}`)))
                            : ((this._debug = s(i)), (this._warn = s(`${i}:WARN`)), (this._error = s(`${i}:ERROR`))),
                            (this._debug.log = console.info.bind(console)),
                            (this._warn.log = console.warn.bind(console)),
                            (this._error.log = console.error.bind(console));
                    }
                    get debug() {
                        return this._debug;
                    }
                    get warn() {
                        return this._warn;
                    }
                    get error() {
                        return this._error;
                    }
                };
            },
            8633: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Edge11 = void 0);
                const s = r(2994),
                    i = r(4893),
                    a = r(1765),
                    n = r(8046),
                    o = r(8751),
                    c = r(521),
                    d = new s.Logger('Edge11');
                class p extends c.HandlerInterface {
                    _sendingRtpParametersByKind;
                    _remoteIceParameters;
                    _remoteIceCandidates;
                    _remoteDtlsParameters;
                    _iceGatherer;
                    _iceTransport;
                    _dtlsTransport;
                    _rtpSenders = new Map();
                    _rtpReceivers = new Map();
                    _nextSendLocalId = 0;
                    _cname;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new p();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Edge11';
                    }
                    close() {
                        d.debug('close()');
                        try {
                            this._iceGatherer.close();
                        } catch (e) {}
                        try {
                            this._iceTransport.stop();
                        } catch (e) {}
                        try {
                            this._dtlsTransport.stop();
                        } catch (e) {}
                        for (const e of this._rtpSenders.values())
                            try {
                                e.stop();
                            } catch (e) {}
                        for (const e of this._rtpReceivers.values())
                            try {
                                e.stop();
                            } catch (e) {}
                        this.emit('@close');
                    }
                    async getNativeRtpCapabilities() {
                        return d.debug('getNativeRtpCapabilities()'), o.getCapabilities();
                    }
                    async getNativeSctpCapabilities() {
                        return d.debug('getNativeSctpCapabilities()'), { numStreams: { OS: 0, MIS: 0 } };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: o,
                        iceTransportPolicy: c,
                        additionalSettings: p,
                        proprietaryConstraints: l,
                        extendedRtpCapabilities: h,
                    }) {
                        d.debug('run()'),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', h),
                                video: n.getSendingRtpParameters('video', h),
                            }),
                            (this._remoteIceParameters = t),
                            (this._remoteIceCandidates = r),
                            (this._remoteDtlsParameters = s),
                            (this._cname = `CNAME-${a.generateRandomNumber()}`),
                            this.setIceGatherer({ iceServers: o, iceTransportPolicy: c }),
                            this.setIceTransport(),
                            this.setDtlsTransport();
                    }
                    async updateIceServers(e) {
                        throw new i.UnsupportedError('not supported');
                    }
                    async restartIce(e) {
                        if ((d.debug('restartIce()'), (this._remoteIceParameters = e), this._transportReady)) {
                            d.debug('restartIce() | calling iceTransport.start()'),
                                this._iceTransport.start(this._iceGatherer, e, 'controlling');
                            for (const e of this._remoteIceCandidates) this._iceTransport.addRemoteCandidate(e);
                            this._iceTransport.addRemoteCandidate({});
                        }
                    }
                    async getTransportStats() {
                        return this._iceTransport.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: s }) {
                        d.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            this._transportReady || (await this.setupTransport({ localDtlsRole: 'server' })),
                            d.debug('send() | calling new RTCRtpSender()');
                        const i = new RTCRtpSender(e, this._dtlsTransport),
                            c = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        c.codecs = n.reduceCodecs(c.codecs, s);
                        const p = c.codecs.some((e) => /.+\/rtx$/i.test(e.mimeType));
                        t || (t = [{}]);
                        for (const e of t)
                            (e.ssrc = a.generateRandomNumber()), p && (e.rtx = { ssrc: a.generateRandomNumber() });
                        (c.encodings = t), (c.rtcp = { cname: this._cname, reducedSize: !0, mux: !0 });
                        const l = o.mangleRtpParameters(c);
                        d.debug('send() | calling rtpSender.send() [params:%o]', l), await i.send(l);
                        const h = String(this._nextSendLocalId);
                        return (
                            this._nextSendLocalId++,
                            this._rtpSenders.set(h, i),
                            { localId: h, rtpParameters: c, rtpSender: i }
                        );
                    }
                    async stopSending(e) {
                        d.debug('stopSending() [localId:%s]', e);
                        const t = this._rtpSenders.get(e);
                        if (!t) throw new Error('RTCRtpSender not found');
                        this._rtpSenders.delete(e);
                        try {
                            d.debug('stopSending() | calling rtpSender.stop()'), t.stop();
                        } catch (e) {
                            throw (d.warn('stopSending() | rtpSender.stop() failed:%o', e), e);
                        }
                    }
                    async pauseSending(e) {}
                    async resumeSending(e) {}
                    async replaceTrack(e, t) {
                        t
                            ? d.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                            : d.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._rtpSenders.get(e);
                        if (!r) throw new Error('RTCRtpSender not found');
                        r.setTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        d.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._rtpSenders.get(e);
                        if (!r) throw new Error('RTCRtpSender not found');
                        const s = r.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.setParameters(s);
                    }
                    async setRtpEncodingParameters(e, t) {
                        d.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._rtpSenders.get(e);
                        if (!r) throw new Error('RTCRtpSender not found');
                        const s = r.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.setParameters(s);
                    }
                    async getSenderStats(e) {
                        const t = this._rtpSenders.get(e);
                        if (!t) throw new Error('RTCRtpSender not found');
                        return t.getStats();
                    }
                    async sendDataChannel(e) {
                        throw new i.UnsupportedError('not implemented');
                    }
                    async receive(e) {
                        const t = [];
                        for (const t of e) {
                            const { trackId: e, kind: r } = t;
                            d.debug('receive() [trackId:%s, kind:%s]', e, r);
                        }
                        this._transportReady || (await this.setupTransport({ localDtlsRole: 'server' }));
                        for (const r of e) {
                            const { trackId: e, kind: s, rtpParameters: i } = r;
                            d.debug('receive() | calling new RTCRtpReceiver()');
                            const a = new RTCRtpReceiver(this._dtlsTransport, s);
                            a.addEventListener('error', (e) => {
                                d.error('rtpReceiver "error" event [event:%o]', e);
                            });
                            const n = o.mangleRtpParameters(i);
                            d.debug('receive() | calling rtpReceiver.receive() [params:%o]', n), await a.receive(n);
                            const c = e;
                            this._rtpReceivers.set(c, a), t.push({ localId: c, track: a.track, rtpReceiver: a });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        for (const t of e) {
                            d.debug('stopReceiving() [localId:%s]', t);
                            const e = this._rtpReceivers.get(t);
                            if (!e) throw new Error('RTCRtpReceiver not found');
                            this._rtpReceivers.delete(t);
                            try {
                                d.debug('stopReceiving() | calling rtpReceiver.stop()'), e.stop();
                            } catch (e) {
                                d.warn('stopReceiving() | rtpReceiver.stop() failed:%o', e);
                            }
                        }
                    }
                    async pauseReceiving(e) {}
                    async resumeReceiving(e) {}
                    async getReceiverStats(e) {
                        const t = this._rtpReceivers.get(e);
                        if (!t) throw new Error('RTCRtpReceiver not found');
                        return t.getStats();
                    }
                    async receiveDataChannel(e) {
                        throw new i.UnsupportedError('not implemented');
                    }
                    setIceGatherer({ iceServers: e, iceTransportPolicy: t }) {
                        const r = new RTCIceGatherer({ iceServers: e ?? [], gatherPolicy: t ?? 'all' });
                        r.addEventListener('error', (e) => {
                            d.error('iceGatherer "error" event [event:%o]', e);
                        });
                        try {
                            r.gather();
                        } catch (e) {
                            d.debug('setIceGatherer() | iceGatherer.gather() failed: %s', e.toString());
                        }
                        this._iceGatherer = r;
                    }
                    setIceTransport() {
                        const e = new RTCIceTransport(this._iceGatherer);
                        e.addEventListener('statechange', () => {
                            switch (e.state) {
                                case 'checking':
                                    this.emit('@connectionstatechange', 'connecting');
                                    break;
                                case 'connected':
                                case 'completed':
                                    this.emit('@connectionstatechange', 'connected');
                                    break;
                                case 'failed':
                                    this.emit('@connectionstatechange', 'failed');
                                    break;
                                case 'disconnected':
                                    this.emit('@connectionstatechange', 'disconnected');
                                    break;
                                case 'closed':
                                    this.emit('@connectionstatechange', 'closed');
                            }
                        }),
                            e.addEventListener('icestatechange', () => {
                                switch (e.state) {
                                    case 'checking':
                                        this.emit('@connectionstatechange', 'connecting');
                                        break;
                                    case 'connected':
                                    case 'completed':
                                        this.emit('@connectionstatechange', 'connected');
                                        break;
                                    case 'failed':
                                        this.emit('@connectionstatechange', 'failed');
                                        break;
                                    case 'disconnected':
                                        this.emit('@connectionstatechange', 'disconnected');
                                        break;
                                    case 'closed':
                                        this.emit('@connectionstatechange', 'closed');
                                }
                            }),
                            e.addEventListener('candidatepairchange', (e) => {
                                d.debug('iceTransport "candidatepairchange" event [pair:%o]', e.pair);
                            }),
                            (this._iceTransport = e);
                    }
                    setDtlsTransport() {
                        const e = new RTCDtlsTransport(this._iceTransport);
                        e.addEventListener('statechange', () => {
                            d.debug('dtlsTransport "statechange" event [state:%s]', e.state);
                        }),
                            e.addEventListener('dtlsstatechange', () => {
                                d.debug('dtlsTransport "dtlsstatechange" event [state:%s]', e.state),
                                    'closed' === e.state && this.emit('@connectionstatechange', 'closed');
                            }),
                            e.addEventListener('error', (e) => {
                                d.error('dtlsTransport "error" event [event:%o]', e);
                            }),
                            (this._dtlsTransport = e);
                    }
                    async setupTransport({ localDtlsRole: e }) {
                        d.debug('setupTransport()');
                        const t = this._dtlsTransport.getLocalParameters();
                        (t.role = e),
                            await new Promise((e, r) => {
                                this.safeEmit('@connect', { dtlsParameters: t }, e, r);
                            }),
                            this._iceTransport.start(this._iceGatherer, this._remoteIceParameters, 'controlling');
                        for (const e of this._remoteIceCandidates) this._iceTransport.addRemoteCandidate(e);
                        this._iceTransport.addRemoteCandidate({}),
                            (this._remoteDtlsParameters.fingerprints = this._remoteDtlsParameters.fingerprints.filter(
                                (e) =>
                                    'sha-256' === e.algorithm || 'sha-384' === e.algorithm || 'sha-512' === e.algorithm,
                            )),
                            this._dtlsTransport.start(this._remoteDtlsParameters),
                            (this._transportReady = !0);
                    }
                }
                t.Edge11 = p;
            },
            8729: (e, t) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.default = void 0),
                    (t.default = '00000000-0000-0000-0000-000000000000');
            },
            8751: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.getCapabilities = function () {
                        const e = RTCRtpReceiver.getCapabilities(),
                            t = s.clone(e);
                        for (const e of t.codecs ?? []) {
                            if (
                                ((e.channels = e.numChannels),
                                delete e.numChannels,
                                (e.mimeType = e.mimeType ?? `${e.kind}/${e.name}`),
                                e.parameters)
                            ) {
                                const t = e.parameters;
                                t.apt && (t.apt = Number(t.apt)),
                                    t['packetization-mode'] &&
                                        (t['packetization-mode'] = Number(t['packetization-mode']));
                            }
                            for (const t of e.rtcpFeedback ?? []) t.parameter || (t.parameter = '');
                        }
                        return t;
                    }),
                    (t.mangleRtpParameters = function (e) {
                        const t = s.clone(e);
                        t.mid && ((t.muxId = t.mid), delete t.mid);
                        for (const e of t.codecs)
                            e.channels && ((e.numChannels = e.channels), delete e.channels),
                                e.mimeType && !e.name && (e.name = e.mimeType.split('/')[1]),
                                delete e.mimeType;
                        return t;
                    });
                const s = r(1765);
            },
            8876: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }),
                    (t.AwaitQueueRemovedTaskError = t.AwaitQueueStoppedError = t.AwaitQueue = void 0);
                var s = r(9275);
                Object.defineProperty(t, 'AwaitQueue', {
                    enumerable: !0,
                    get: function () {
                        return s.AwaitQueue;
                    },
                });
                var i = r(4253);
                Object.defineProperty(t, 'AwaitQueueStoppedError', {
                    enumerable: !0,
                    get: function () {
                        return i.AwaitQueueStoppedError;
                    },
                }),
                    Object.defineProperty(t, 'AwaitQueueRemovedTaskError', {
                        enumerable: !0,
                        get: function () {
                            return i.AwaitQueueRemovedTaskError;
                        },
                    });
            },
            9166: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.DataConsumer = void 0);
                const s = r(2994),
                    i = r(3953),
                    a = new s.Logger('DataConsumer');
                class n extends i.EnhancedEventEmitter {
                    _id;
                    _dataProducerId;
                    _dataChannel;
                    _closed = !1;
                    _sctpStreamParameters;
                    _appData;
                    _observer = new i.EnhancedEventEmitter();
                    constructor({ id: e, dataProducerId: t, dataChannel: r, sctpStreamParameters: s, appData: i }) {
                        super(),
                            a.debug('constructor()'),
                            (this._id = e),
                            (this._dataProducerId = t),
                            (this._dataChannel = r),
                            (this._sctpStreamParameters = s),
                            (this._appData = i ?? {}),
                            this.handleDataChannel();
                    }
                    get id() {
                        return this._id;
                    }
                    get dataProducerId() {
                        return this._dataProducerId;
                    }
                    get closed() {
                        return this._closed;
                    }
                    get sctpStreamParameters() {
                        return this._sctpStreamParameters;
                    }
                    get readyState() {
                        return this._dataChannel.readyState;
                    }
                    get label() {
                        return this._dataChannel.label;
                    }
                    get protocol() {
                        return this._dataChannel.protocol;
                    }
                    get binaryType() {
                        return this._dataChannel.binaryType;
                    }
                    set binaryType(e) {
                        this._dataChannel.binaryType = e;
                    }
                    get appData() {
                        return this._appData;
                    }
                    set appData(e) {
                        this._appData = e;
                    }
                    get observer() {
                        return this._observer;
                    }
                    close() {
                        this._closed ||
                            (a.debug('close()'),
                            (this._closed = !0),
                            this._dataChannel.close(),
                            this.emit('@close'),
                            this._observer.safeEmit('close'));
                    }
                    transportClosed() {
                        this._closed ||
                            (a.debug('transportClosed()'),
                            (this._closed = !0),
                            this._dataChannel.close(),
                            this.safeEmit('transportclose'),
                            this._observer.safeEmit('close'));
                    }
                    handleDataChannel() {
                        this._dataChannel.addEventListener('open', () => {
                            this._closed || (a.debug('DataChannel "open" event'), this.safeEmit('open'));
                        }),
                            this._dataChannel.addEventListener('error', (e) => {
                                if (this._closed) return;
                                let { error: t } = e;
                                t || (t = new Error('unknown DataChannel error')),
                                    'sctp-failure' === t.errorDetail
                                        ? a.error(
                                              'DataChannel SCTP error [sctpCauseCode:%s]: %s',
                                              t.sctpCauseCode,
                                              t.message,
                                          )
                                        : a.error('DataChannel "error" event: %o', t),
                                    this.safeEmit('error', t);
                            }),
                            this._dataChannel.addEventListener('close', () => {
                                this._closed ||
                                    (a.warn('DataChannel "close" event'),
                                    (this._closed = !0),
                                    this.emit('@close'),
                                    this.safeEmit('close'),
                                    this._observer.safeEmit('close'));
                            }),
                            this._dataChannel.addEventListener('message', (e) => {
                                this._closed || this.safeEmit('message', e.data);
                            });
                    }
                }
                t.DataConsumer = n;
            },
            9275: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.AwaitQueue = void 0);
                const s = r(8274),
                    i = r(4253),
                    a = new s.Logger('AwaitQueue');
                t.AwaitQueue = class {
                    constructor() {
                        (this.pendingTasks = new Map()),
                            (this.nextTaskId = 0),
                            (this.stopping = !1),
                            a.debug('constructor()');
                    }
                    get size() {
                        return this.pendingTasks.size;
                    }
                    async push(e, t) {
                        if (((t = t ?? e.name), a.debug(`push() [name:${t}]`), 'function' != typeof e))
                            throw new TypeError('given task is not a function');
                        if (t)
                            try {
                                Object.defineProperty(e, 'name', { value: t });
                            } catch (e) {}
                        return new Promise((r, s) => {
                            const i = {
                                id: this.nextTaskId++,
                                task: e,
                                name: t,
                                enqueuedAt: Date.now(),
                                executedAt: void 0,
                                completed: !1,
                                resolve: (e) => {
                                    if (i.completed) return;
                                    (i.completed = !0),
                                        this.pendingTasks.delete(i.id),
                                        a.debug(`resolving task [name:${i.name}]`),
                                        r(e);
                                    const [t] = this.pendingTasks.values();
                                    t && !t.executedAt && this.execute(t);
                                },
                                reject: (e) => {
                                    if (
                                        !i.completed &&
                                        ((i.completed = !0),
                                        this.pendingTasks.delete(i.id),
                                        a.debug(`rejecting task [name:${i.name}]: %s`, String(e)),
                                        s(e),
                                        !this.stopping)
                                    ) {
                                        const [e] = this.pendingTasks.values();
                                        e && !e.executedAt && this.execute(e);
                                    }
                                },
                            };
                            this.pendingTasks.set(i.id, i), 1 === this.pendingTasks.size && this.execute(i);
                        });
                    }
                    stop() {
                        a.debug('stop()'), (this.stopping = !0);
                        for (const e of this.pendingTasks.values())
                            a.debug(`stop() | stopping task [name:${e.name}]`),
                                e.reject(new i.AwaitQueueStoppedError());
                        this.stopping = !1;
                    }
                    remove(e) {
                        a.debug(`remove() [taskIdx:${e}]`);
                        const t = Array.from(this.pendingTasks.values())[e];
                        t
                            ? t.reject(new i.AwaitQueueRemovedTaskError())
                            : a.debug(`stop() | no task with given idx [taskIdx:${e}]`);
                    }
                    dump() {
                        const e = Date.now();
                        let t = 0;
                        return Array.from(this.pendingTasks.values()).map((r) => ({
                            idx: t++,
                            task: r.task,
                            name: r.name,
                            enqueuedTime: r.executedAt ? r.executedAt - r.enqueuedAt : e - r.enqueuedAt,
                            executionTime: r.executedAt ? e - r.executedAt : 0,
                        }));
                    }
                    async execute(e) {
                        if ((a.debug(`execute() [name:${e.name}]`), e.executedAt))
                            throw new Error('task already being executed');
                        e.executedAt = Date.now();
                        try {
                            const t = await e.task();
                            e.resolve(t);
                        } catch (t) {
                            e.reject(t);
                        }
                    }
                };
            },
            9352: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.ReactNative = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(4893),
                    n = r(1765),
                    o = r(8046),
                    c = r(5544),
                    d = r(4496),
                    p = r(521),
                    l = r(1305),
                    h = new i.Logger('ReactNative'),
                    m = { OS: 1024, MIS: 1024 };
                class u extends p.HandlerInterface {
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _sendStream = new MediaStream();
                    _mapSendLocalIdTrack = new Map();
                    _nextSendLocalId = 0;
                    _mapRecvLocalIdInfo = new Map();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new u();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'ReactNative';
                    }
                    close() {
                        if ((h.debug('close()'), this._sendStream.release(!1), this._pc))
                            try {
                                this._pc.close();
                            } catch (e) {}
                        this.emit('@close');
                    }
                    async getNativeRtpCapabilities() {
                        h.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'plan-b',
                        });
                        try {
                            const t = await e.createOffer({ offerToReceiveAudio: !0, offerToReceiveVideo: !0 });
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp);
                            return c.extractRtpCapabilities({ sdpObject: r });
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return h.debug('getNativeSctpCapabilities()'), { numStreams: m };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: n,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: p,
                    }) {
                        h.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new l.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                                planB: !0,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: o.getSendingRtpParameters('audio', p),
                                video: o.getSendingRtpParameters('video', p),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: o.getSendingRemoteRtpParameters('audio', p),
                                video: o.getSendingRemoteRtpParameters('video', p),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: n ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    sdpSemantics: 'plan-b',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (h.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        h.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if ((h.debug('restartIce()'), this._remoteSdp.updateIceParameters(e), this._transportReady))
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                h.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                h.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                h.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                h.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertSendDirection(),
                            h.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            i && h.warn('send() | codec selection is not available in %s handler', this.name),
                            this._sendStream.addTrack(e),
                            this._pc.addStream(this._sendStream);
                        let a,
                            p = await this._pc.createOffer(),
                            l = s.parse(p.sdp);
                        l.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed();
                        const m = n.clone(this._sendingRtpParametersByKind[e.kind]);
                        m.codecs = o.reduceCodecs(m.codecs);
                        const u = n.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        if (
                            ((u.codecs = o.reduceCodecs(u.codecs)),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: l,
                                })),
                            'video' === e.kind &&
                                t &&
                                t.length > 1 &&
                                (h.debug('send() | enabling simulcast'),
                                (l = s.parse(p.sdp)),
                                (a = l.media.find((e) => 'video' === e.type)),
                                d.addLegacySimulcast({ offerMediaObject: a, track: e, numStreams: t.length }),
                                (p = { type: 'offer', sdp: s.write(l) })),
                            h.debug('send() | calling pc.setLocalDescription() [offer:%o]', p),
                            await this._pc.setLocalDescription(p),
                            (l = s.parse(this._pc.localDescription.sdp)),
                            (a = l.media.find((t) => t.type === e.kind)),
                            (m.rtcp.cname = c.getCname({ offerMediaObject: a })),
                            (m.encodings = d.getRtpEncodings({ offerMediaObject: a, track: e })),
                            t)
                        )
                            for (let e = 0; e < m.encodings.length; ++e) t[e] && Object.assign(m.encodings[e], t[e]);
                        if (
                            m.encodings.length > 1 &&
                            ('video/vp8' === m.codecs[0].mimeType.toLowerCase() ||
                                'video/h264' === m.codecs[0].mimeType.toLowerCase())
                        )
                            for (const e of m.encodings) e.scalabilityMode = 'L1T3';
                        this._remoteSdp.send({
                            offerMediaObject: a,
                            offerRtpParameters: m,
                            answerRtpParameters: u,
                            codecOptions: r,
                        });
                        const f = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('send() | calling pc.setRemoteDescription() [answer:%o]', f),
                            await this._pc.setRemoteDescription(f);
                        const g = String(this._nextSendLocalId);
                        return (
                            this._nextSendLocalId++,
                            this._mapSendLocalIdTrack.set(g, e),
                            { localId: g, rtpParameters: m }
                        );
                    }
                    async stopSending(e) {
                        this.assertSendDirection(), h.debug('stopSending() [localId:%s]', e);
                        const t = this._mapSendLocalIdTrack.get(e);
                        if (!t) throw new Error('track not found');
                        this._mapSendLocalIdTrack.delete(e),
                            this._sendStream.removeTrack(t),
                            this._pc.addStream(this._sendStream);
                        const r = await this._pc.createOffer();
                        h.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r);
                        try {
                            await this._pc.setLocalDescription(r);
                        } catch (e) {
                            if (0 === this._sendStream.getTracks().length)
                                return void h.warn(
                                    'stopSending() | ignoring expected error due no sending tracks: %s',
                                    e.toString(),
                                );
                            throw e;
                        }
                        if ('stable' === this._pc.signalingState) return;
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        h.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async pauseSending(e) {}
                    async resumeSending(e) {}
                    async replaceTrack(e, t) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async setMaxSpatialLayer(e, t) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async setRtpEncodingParameters(e, t) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async getSenderStats(e) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmitTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        h.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % m.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                h.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            h.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertRecvDirection();
                        const t = [],
                            r = new Map();
                        for (const t of e) {
                            const { trackId: e, kind: s, rtpParameters: i } = t;
                            h.debug('receive() [trackId:%s, kind:%s]', e, s);
                            const a = s;
                            let o = t.streamId ?? i.rtcp.cname;
                            h.debug(
                                'receive() | forcing a random remote streamId to avoid well known bug in react-native-webrtc',
                            ),
                                (o += `-hack-${n.generateRandomNumber()}`),
                                r.set(e, o),
                                this._remoteSdp.receive({
                                    mid: a,
                                    kind: s,
                                    offerRtpParameters: i,
                                    streamId: o,
                                    trackId: e,
                                });
                        }
                        const i = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        h.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', i),
                            await this._pc.setRemoteDescription(i);
                        let a = await this._pc.createAnswer();
                        const o = s.parse(a.sdp);
                        for (const t of e) {
                            const { kind: e, rtpParameters: r } = t,
                                s = e,
                                i = o.media.find((e) => String(e.mid) === s);
                            c.applyCodecParameters({ offerRtpParameters: r, answerMediaObject: i });
                        }
                        (a = { type: 'answer', sdp: s.write(o) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: o,
                                })),
                            h.debug('receive() | calling pc.setLocalDescription() [answer:%o]', a),
                            await this._pc.setLocalDescription(a);
                        for (const s of e) {
                            const { kind: e, trackId: i, rtpParameters: a } = s,
                                n = i,
                                o = e,
                                c = r.get(i),
                                d = this._pc
                                    .getRemoteStreams()
                                    .find((e) => e.id === c)
                                    .getTrackById(n);
                            if (!d) throw new Error('remote track not found');
                            this._mapRecvLocalIdInfo.set(n, { mid: o, rtpParameters: a }),
                                t.push({ localId: n, track: d });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        this.assertRecvDirection();
                        for (const t of e) {
                            h.debug('stopReceiving() [localId:%s]', t);
                            const { mid: e, rtpParameters: r } = this._mapRecvLocalIdInfo.get(t) ?? {};
                            this._mapRecvLocalIdInfo.delete(t),
                                this._remoteSdp.planBStopReceiving({ mid: e, offerRtpParameters: r });
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        h.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        h.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async pauseReceiving(e) {}
                    async resumeReceiving(e) {}
                    async getReceiverStats(e) {
                        throw new a.UnsupportedError('not implemented');
                    }
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmitTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        h.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation({ oldDataChannelSpec: !0 });
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            h.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            h.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = c.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.ReactNative = u;
            },
            9596: (e) => {
                'use strict';
                var t,
                    r = 'object' == typeof Reflect ? Reflect : null,
                    s =
                        r && 'function' == typeof r.apply
                            ? r.apply
                            : function (e, t, r) {
                                  return Function.prototype.apply.call(e, t, r);
                              };
                t =
                    r && 'function' == typeof r.ownKeys
                        ? r.ownKeys
                        : Object.getOwnPropertySymbols
                          ? function (e) {
                                return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
                            }
                          : function (e) {
                                return Object.getOwnPropertyNames(e);
                            };
                var i =
                    Number.isNaN ||
                    function (e) {
                        return e != e;
                    };
                function a() {
                    a.init.call(this);
                }
                (e.exports = a),
                    (e.exports.once = function (e, t) {
                        return new Promise(function (r, s) {
                            function i(r) {
                                e.removeListener(t, a), s(r);
                            }
                            function a() {
                                'function' == typeof e.removeListener && e.removeListener('error', i),
                                    r([].slice.call(arguments));
                            }
                            f(e, t, a, { once: !0 }),
                                'error' !== t &&
                                    (function (e, t) {
                                        'function' == typeof e.on && f(e, 'error', t, { once: !0 });
                                    })(e, i);
                        });
                    }),
                    (a.EventEmitter = a),
                    (a.prototype._events = void 0),
                    (a.prototype._eventsCount = 0),
                    (a.prototype._maxListeners = void 0);
                var n = 10;
                function o(e) {
                    if ('function' != typeof e)
                        throw new TypeError(
                            'The "listener" argument must be of type Function. Received type ' + typeof e,
                        );
                }
                function c(e) {
                    return void 0 === e._maxListeners ? a.defaultMaxListeners : e._maxListeners;
                }
                function d(e, t, r, s) {
                    var i, a, n, d;
                    if (
                        (o(r),
                        void 0 === (a = e._events)
                            ? ((a = e._events = Object.create(null)), (e._eventsCount = 0))
                            : (void 0 !== a.newListener &&
                                  (e.emit('newListener', t, r.listener ? r.listener : r), (a = e._events)),
                              (n = a[t])),
                        void 0 === n)
                    )
                        (n = a[t] = r), ++e._eventsCount;
                    else if (
                        ('function' == typeof n ? (n = a[t] = s ? [r, n] : [n, r]) : s ? n.unshift(r) : n.push(r),
                        (i = c(e)) > 0 && n.length > i && !n.warned)
                    ) {
                        n.warned = !0;
                        var p = new Error(
                            'Possible EventEmitter memory leak detected. ' +
                                n.length +
                                ' ' +
                                String(t) +
                                ' listeners added. Use emitter.setMaxListeners() to increase limit',
                        );
                        (p.name = 'MaxListenersExceededWarning'),
                            (p.emitter = e),
                            (p.type = t),
                            (p.count = n.length),
                            (d = p),
                            console && console.warn && console.warn(d);
                    }
                    return e;
                }
                function p() {
                    if (!this.fired)
                        return (
                            this.target.removeListener(this.type, this.wrapFn),
                            (this.fired = !0),
                            0 === arguments.length
                                ? this.listener.call(this.target)
                                : this.listener.apply(this.target, arguments)
                        );
                }
                function l(e, t, r) {
                    var s = { fired: !1, wrapFn: void 0, target: e, type: t, listener: r },
                        i = p.bind(s);
                    return (i.listener = r), (s.wrapFn = i), i;
                }
                function h(e, t, r) {
                    var s = e._events;
                    if (void 0 === s) return [];
                    var i = s[t];
                    return void 0 === i
                        ? []
                        : 'function' == typeof i
                          ? r
                              ? [i.listener || i]
                              : [i]
                          : r
                            ? (function (e) {
                                  for (var t = new Array(e.length), r = 0; r < t.length; ++r)
                                      t[r] = e[r].listener || e[r];
                                  return t;
                              })(i)
                            : u(i, i.length);
                }
                function m(e) {
                    var t = this._events;
                    if (void 0 !== t) {
                        var r = t[e];
                        if ('function' == typeof r) return 1;
                        if (void 0 !== r) return r.length;
                    }
                    return 0;
                }
                function u(e, t) {
                    for (var r = new Array(t), s = 0; s < t; ++s) r[s] = e[s];
                    return r;
                }
                function f(e, t, r, s) {
                    if ('function' == typeof e.on) s.once ? e.once(t, r) : e.on(t, r);
                    else {
                        if ('function' != typeof e.addEventListener)
                            throw new TypeError(
                                'The "emitter" argument must be of type EventEmitter. Received type ' + typeof e,
                            );
                        e.addEventListener(t, function i(a) {
                            s.once && e.removeEventListener(t, i), r(a);
                        });
                    }
                }
                Object.defineProperty(a, 'defaultMaxListeners', {
                    enumerable: !0,
                    get: function () {
                        return n;
                    },
                    set: function (e) {
                        if ('number' != typeof e || e < 0 || i(e))
                            throw new RangeError(
                                'The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' +
                                    e +
                                    '.',
                            );
                        n = e;
                    },
                }),
                    (a.init = function () {
                        (void 0 !== this._events && this._events !== Object.getPrototypeOf(this)._events) ||
                            ((this._events = Object.create(null)), (this._eventsCount = 0)),
                            (this._maxListeners = this._maxListeners || void 0);
                    }),
                    (a.prototype.setMaxListeners = function (e) {
                        if ('number' != typeof e || e < 0 || i(e))
                            throw new RangeError(
                                'The value of "n" is out of range. It must be a non-negative number. Received ' +
                                    e +
                                    '.',
                            );
                        return (this._maxListeners = e), this;
                    }),
                    (a.prototype.getMaxListeners = function () {
                        return c(this);
                    }),
                    (a.prototype.emit = function (e) {
                        for (var t = [], r = 1; r < arguments.length; r++) t.push(arguments[r]);
                        var i = 'error' === e,
                            a = this._events;
                        if (void 0 !== a) i = i && void 0 === a.error;
                        else if (!i) return !1;
                        if (i) {
                            var n;
                            if ((t.length > 0 && (n = t[0]), n instanceof Error)) throw n;
                            var o = new Error('Unhandled error.' + (n ? ' (' + n.message + ')' : ''));
                            throw ((o.context = n), o);
                        }
                        var c = a[e];
                        if (void 0 === c) return !1;
                        if ('function' == typeof c) s(c, this, t);
                        else {
                            var d = c.length,
                                p = u(c, d);
                            for (r = 0; r < d; ++r) s(p[r], this, t);
                        }
                        return !0;
                    }),
                    (a.prototype.addListener = function (e, t) {
                        return d(this, e, t, !1);
                    }),
                    (a.prototype.on = a.prototype.addListener),
                    (a.prototype.prependListener = function (e, t) {
                        return d(this, e, t, !0);
                    }),
                    (a.prototype.once = function (e, t) {
                        return o(t), this.on(e, l(this, e, t)), this;
                    }),
                    (a.prototype.prependOnceListener = function (e, t) {
                        return o(t), this.prependListener(e, l(this, e, t)), this;
                    }),
                    (a.prototype.removeListener = function (e, t) {
                        var r, s, i, a, n;
                        if ((o(t), void 0 === (s = this._events))) return this;
                        if (void 0 === (r = s[e])) return this;
                        if (r === t || r.listener === t)
                            0 == --this._eventsCount
                                ? (this._events = Object.create(null))
                                : (delete s[e], s.removeListener && this.emit('removeListener', e, r.listener || t));
                        else if ('function' != typeof r) {
                            for (i = -1, a = r.length - 1; a >= 0; a--)
                                if (r[a] === t || r[a].listener === t) {
                                    (n = r[a].listener), (i = a);
                                    break;
                                }
                            if (i < 0) return this;
                            0 === i
                                ? r.shift()
                                : (function (e, t) {
                                      for (; t + 1 < e.length; t++) e[t] = e[t + 1];
                                      e.pop();
                                  })(r, i),
                                1 === r.length && (s[e] = r[0]),
                                void 0 !== s.removeListener && this.emit('removeListener', e, n || t);
                        }
                        return this;
                    }),
                    (a.prototype.off = a.prototype.removeListener),
                    (a.prototype.removeAllListeners = function (e) {
                        var t, r, s;
                        if (void 0 === (r = this._events)) return this;
                        if (void 0 === r.removeListener)
                            return (
                                0 === arguments.length
                                    ? ((this._events = Object.create(null)), (this._eventsCount = 0))
                                    : void 0 !== r[e] &&
                                      (0 == --this._eventsCount ? (this._events = Object.create(null)) : delete r[e]),
                                this
                            );
                        if (0 === arguments.length) {
                            var i,
                                a = Object.keys(r);
                            for (s = 0; s < a.length; ++s)
                                'removeListener' !== (i = a[s]) && this.removeAllListeners(i);
                            return (
                                this.removeAllListeners('removeListener'),
                                (this._events = Object.create(null)),
                                (this._eventsCount = 0),
                                this
                            );
                        }
                        if ('function' == typeof (t = r[e])) this.removeListener(e, t);
                        else if (void 0 !== t) for (s = t.length - 1; s >= 0; s--) this.removeListener(e, t[s]);
                        return this;
                    }),
                    (a.prototype.listeners = function (e) {
                        return h(this, e, !0);
                    }),
                    (a.prototype.rawListeners = function (e) {
                        return h(this, e, !1);
                    }),
                    (a.listenerCount = function (e, t) {
                        return 'function' == typeof e.listenerCount ? e.listenerCount(t) : m.call(e, t);
                    }),
                    (a.prototype.listenerCount = m),
                    (a.prototype.eventNames = function () {
                        return this._eventsCount > 0 ? t(this._events) : [];
                    });
            },
            9676: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Safari11 = void 0);
                const s = r(7363),
                    i = r(2994),
                    a = r(1765),
                    n = r(8046),
                    o = r(5544),
                    c = r(4496),
                    d = r(521),
                    p = r(1305),
                    l = new i.Logger('Safari11'),
                    h = { OS: 1024, MIS: 1024 };
                class m extends d.HandlerInterface {
                    _direction;
                    _remoteSdp;
                    _sendingRtpParametersByKind;
                    _sendingRemoteRtpParametersByKind;
                    _forcedLocalDtlsRole;
                    _pc;
                    _sendStream = new MediaStream();
                    _mapSendLocalIdRtpSender = new Map();
                    _nextSendLocalId = 0;
                    _mapRecvLocalIdInfo = new Map();
                    _hasDataChannelMediaSection = !1;
                    _nextSendSctpStreamId = 0;
                    _transportReady = !1;
                    static createFactory() {
                        return () => new m();
                    }
                    constructor() {
                        super();
                    }
                    get name() {
                        return 'Safari11';
                    }
                    close() {
                        if ((l.debug('close()'), this._pc))
                            try {
                                this._pc.close();
                            } catch (e) {}
                        this.emit('@close');
                    }
                    async getNativeRtpCapabilities() {
                        l.debug('getNativeRtpCapabilities()');
                        const e = new RTCPeerConnection({
                            iceServers: [],
                            iceTransportPolicy: 'all',
                            bundlePolicy: 'max-bundle',
                            rtcpMuxPolicy: 'require',
                            sdpSemantics: 'plan-b',
                        });
                        try {
                            const t = await e.createOffer({ offerToReceiveAudio: !0, offerToReceiveVideo: !0 });
                            try {
                                e.close();
                            } catch (e) {}
                            const r = s.parse(t.sdp);
                            return o.extractRtpCapabilities({ sdpObject: r });
                        } catch (t) {
                            try {
                                e.close();
                            } catch (e) {}
                            throw t;
                        }
                    }
                    async getNativeSctpCapabilities() {
                        return l.debug('getNativeSctpCapabilities()'), { numStreams: h };
                    }
                    run({
                        direction: e,
                        iceParameters: t,
                        iceCandidates: r,
                        dtlsParameters: s,
                        sctpParameters: i,
                        iceServers: a,
                        iceTransportPolicy: o,
                        additionalSettings: c,
                        proprietaryConstraints: d,
                        extendedRtpCapabilities: h,
                    }) {
                        l.debug('run()'),
                            (this._direction = e),
                            (this._remoteSdp = new p.RemoteSdp({
                                iceParameters: t,
                                iceCandidates: r,
                                dtlsParameters: s,
                                sctpParameters: i,
                                planB: !0,
                            })),
                            (this._sendingRtpParametersByKind = {
                                audio: n.getSendingRtpParameters('audio', h),
                                video: n.getSendingRtpParameters('video', h),
                            }),
                            (this._sendingRemoteRtpParametersByKind = {
                                audio: n.getSendingRemoteRtpParameters('audio', h),
                                video: n.getSendingRemoteRtpParameters('video', h),
                            }),
                            s.role &&
                                'auto' !== s.role &&
                                (this._forcedLocalDtlsRole = 'server' === s.role ? 'client' : 'server'),
                            (this._pc = new RTCPeerConnection(
                                {
                                    iceServers: a ?? [],
                                    iceTransportPolicy: o ?? 'all',
                                    bundlePolicy: 'max-bundle',
                                    rtcpMuxPolicy: 'require',
                                    ...c,
                                },
                                d,
                            )),
                            this._pc.addEventListener('icegatheringstatechange', () => {
                                this.emit('@icegatheringstatechange', this._pc.iceGatheringState);
                            }),
                            this._pc.addEventListener('icecandidateerror', (e) => {
                                this.emit('@icecandidateerror', e);
                            }),
                            this._pc.connectionState
                                ? this._pc.addEventListener('connectionstatechange', () => {
                                      this.emit('@connectionstatechange', this._pc.connectionState);
                                  })
                                : this._pc.addEventListener('iceconnectionstatechange', () => {
                                      switch (
                                          (l.warn(
                                              'run() | pc.connectionState not supported, using pc.iceConnectionState',
                                          ),
                                          this._pc.iceConnectionState)
                                      ) {
                                          case 'checking':
                                              this.emit('@connectionstatechange', 'connecting');
                                              break;
                                          case 'connected':
                                          case 'completed':
                                              this.emit('@connectionstatechange', 'connected');
                                              break;
                                          case 'failed':
                                              this.emit('@connectionstatechange', 'failed');
                                              break;
                                          case 'disconnected':
                                              this.emit('@connectionstatechange', 'disconnected');
                                              break;
                                          case 'closed':
                                              this.emit('@connectionstatechange', 'closed');
                                      }
                                  });
                    }
                    async updateIceServers(e) {
                        l.debug('updateIceServers()');
                        const t = this._pc.getConfiguration();
                        (t.iceServers = e), this._pc.setConfiguration(t);
                    }
                    async restartIce(e) {
                        if ((l.debug('restartIce()'), this._remoteSdp.updateIceParameters(e), this._transportReady))
                            if ('send' === this._direction) {
                                const e = await this._pc.createOffer({ iceRestart: !0 });
                                l.debug('restartIce() | calling pc.setLocalDescription() [offer:%o]', e),
                                    await this._pc.setLocalDescription(e);
                                const t = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                                l.debug('restartIce() | calling pc.setRemoteDescription() [answer:%o]', t),
                                    await this._pc.setRemoteDescription(t);
                            } else {
                                const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                                l.debug('restartIce() | calling pc.setRemoteDescription() [offer:%o]', e),
                                    await this._pc.setRemoteDescription(e);
                                const t = await this._pc.createAnswer();
                                l.debug('restartIce() | calling pc.setLocalDescription() [answer:%o]', t),
                                    await this._pc.setLocalDescription(t);
                            }
                    }
                    async getTransportStats() {
                        return this._pc.getStats();
                    }
                    async send({ track: e, encodings: t, codecOptions: r, codec: i }) {
                        this.assertSendDirection(),
                            l.debug('send() [kind:%s, track.id:%s]', e.kind, e.id),
                            i && l.warn('send() | codec selection is not available in %s handler', this.name),
                            this._sendStream.addTrack(e),
                            this._pc.addTrack(e, this._sendStream);
                        let d,
                            p = await this._pc.createOffer(),
                            h = s.parse(p.sdp);
                        h.extmapAllowMixed && this._remoteSdp.setSessionExtmapAllowMixed();
                        const m = a.clone(this._sendingRtpParametersByKind[e.kind]);
                        m.codecs = n.reduceCodecs(m.codecs);
                        const u = a.clone(this._sendingRemoteRtpParametersByKind[e.kind]);
                        if (
                            ((u.codecs = n.reduceCodecs(u.codecs)),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: h,
                                })),
                            'video' === e.kind &&
                                t &&
                                t.length > 1 &&
                                (l.debug('send() | enabling simulcast'),
                                (h = s.parse(p.sdp)),
                                (d = h.media.find((e) => 'video' === e.type)),
                                c.addLegacySimulcast({ offerMediaObject: d, track: e, numStreams: t.length }),
                                (p = { type: 'offer', sdp: s.write(h) })),
                            l.debug('send() | calling pc.setLocalDescription() [offer:%o]', p),
                            await this._pc.setLocalDescription(p),
                            (h = s.parse(this._pc.localDescription.sdp)),
                            (d = h.media.find((t) => t.type === e.kind)),
                            (m.rtcp.cname = o.getCname({ offerMediaObject: d })),
                            (m.encodings = c.getRtpEncodings({ offerMediaObject: d, track: e })),
                            t)
                        )
                            for (let e = 0; e < m.encodings.length; ++e) t[e] && Object.assign(m.encodings[e], t[e]);
                        if (m.encodings.length > 1 && 'video/vp8' === m.codecs[0].mimeType.toLowerCase())
                            for (const e of m.encodings) e.scalabilityMode = 'L1T3';
                        this._remoteSdp.send({
                            offerMediaObject: d,
                            offerRtpParameters: m,
                            answerRtpParameters: u,
                            codecOptions: r,
                        });
                        const f = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        l.debug('send() | calling pc.setRemoteDescription() [answer:%o]', f),
                            await this._pc.setRemoteDescription(f);
                        const g = String(this._nextSendLocalId);
                        this._nextSendLocalId++;
                        const _ = this._pc.getSenders().find((t) => t.track === e);
                        return this._mapSendLocalIdRtpSender.set(g, _), { localId: g, rtpParameters: m, rtpSender: _ };
                    }
                    async stopSending(e) {
                        this.assertSendDirection();
                        const t = this._mapSendLocalIdRtpSender.get(e);
                        if (!t) throw new Error('associated RTCRtpSender not found');
                        t.track && this._sendStream.removeTrack(t.track), this._mapSendLocalIdRtpSender.delete(e);
                        const r = await this._pc.createOffer();
                        l.debug('stopSending() | calling pc.setLocalDescription() [offer:%o]', r);
                        try {
                            await this._pc.setLocalDescription(r);
                        } catch (e) {
                            if (0 === this._sendStream.getTracks().length)
                                return void l.warn(
                                    'stopSending() | ignoring expected error due no sending tracks: %s',
                                    e.toString(),
                                );
                            throw e;
                        }
                        if ('stable' === this._pc.signalingState) return;
                        const s = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                        l.debug('stopSending() | calling pc.setRemoteDescription() [answer:%o]', s),
                            await this._pc.setRemoteDescription(s);
                    }
                    async pauseSending(e) {}
                    async resumeSending(e) {}
                    async replaceTrack(e, t) {
                        this.assertSendDirection(),
                            t
                                ? l.debug('replaceTrack() [localId:%s, track.id:%s]', e, t.id)
                                : l.debug('replaceTrack() [localId:%s, no track]', e);
                        const r = this._mapSendLocalIdRtpSender.get(e);
                        if (!r) throw new Error('associated RTCRtpSender not found');
                        const s = r.track;
                        await r.replaceTrack(t),
                            s && this._sendStream.removeTrack(s),
                            t && this._sendStream.addTrack(t);
                    }
                    async setMaxSpatialLayer(e, t) {
                        this.assertSendDirection(), l.debug('setMaxSpatialLayer() [localId:%s, spatialLayer:%s]', e, t);
                        const r = this._mapSendLocalIdRtpSender.get(e);
                        if (!r) throw new Error('associated RTCRtpSender not found');
                        const s = r.getParameters();
                        s.encodings.forEach((e, r) => {
                            e.active = r <= t;
                        }),
                            await r.setParameters(s);
                    }
                    async setRtpEncodingParameters(e, t) {
                        this.assertSendDirection(), l.debug('setRtpEncodingParameters() [localId:%s, params:%o]', e, t);
                        const r = this._mapSendLocalIdRtpSender.get(e);
                        if (!r) throw new Error('associated RTCRtpSender not found');
                        const s = r.getParameters();
                        s.encodings.forEach((e, r) => {
                            s.encodings[r] = { ...e, ...t };
                        }),
                            await r.setParameters(s);
                    }
                    async getSenderStats(e) {
                        this.assertSendDirection();
                        const t = this._mapSendLocalIdRtpSender.get(e);
                        if (!t) throw new Error('associated RTCRtpSender not found');
                        return t.getStats();
                    }
                    async sendDataChannel({
                        ordered: e,
                        maxPacketLifeTime: t,
                        maxRetransmits: r,
                        label: i,
                        protocol: a,
                    }) {
                        this.assertSendDirection();
                        const n = {
                            negotiated: !0,
                            id: this._nextSendSctpStreamId,
                            ordered: e,
                            maxPacketLifeTime: t,
                            maxRetransmits: r,
                            protocol: a,
                        };
                        l.debug('sendDataChannel() [options:%o]', n);
                        const o = this._pc.createDataChannel(i, n);
                        if (
                            ((this._nextSendSctpStreamId = ++this._nextSendSctpStreamId % h.MIS),
                            !this._hasDataChannelMediaSection)
                        ) {
                            const e = await this._pc.createOffer(),
                                t = s.parse(e.sdp),
                                r = t.media.find((e) => 'application' === e.type);
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: t,
                                })),
                                l.debug('sendDataChannel() | calling pc.setLocalDescription() [offer:%o]', e),
                                await this._pc.setLocalDescription(e),
                                this._remoteSdp.sendSctpAssociation({ offerMediaObject: r });
                            const i = { type: 'answer', sdp: this._remoteSdp.getSdp() };
                            l.debug('sendDataChannel() | calling pc.setRemoteDescription() [answer:%o]', i),
                                await this._pc.setRemoteDescription(i),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return {
                            dataChannel: o,
                            sctpStreamParameters: {
                                streamId: n.id,
                                ordered: n.ordered,
                                maxPacketLifeTime: n.maxPacketLifeTime,
                                maxRetransmits: n.maxRetransmits,
                            },
                        };
                    }
                    async receive(e) {
                        this.assertRecvDirection();
                        const t = [];
                        for (const t of e) {
                            const { trackId: e, kind: r, rtpParameters: s, streamId: i } = t;
                            l.debug('receive() [trackId:%s, kind:%s]', e, r);
                            const a = r;
                            this._remoteSdp.receive({
                                mid: a,
                                kind: r,
                                offerRtpParameters: s,
                                streamId: i ?? s.rtcp.cname,
                                trackId: e,
                            });
                        }
                        const r = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        l.debug('receive() | calling pc.setRemoteDescription() [offer:%o]', r),
                            await this._pc.setRemoteDescription(r);
                        let i = await this._pc.createAnswer();
                        const a = s.parse(i.sdp);
                        for (const t of e) {
                            const { kind: e, rtpParameters: r } = t,
                                s = e,
                                i = a.media.find((e) => String(e.mid) === s);
                            o.applyCodecParameters({ offerRtpParameters: r, answerMediaObject: i });
                        }
                        (i = { type: 'answer', sdp: s.write(a) }),
                            this._transportReady ||
                                (await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: a,
                                })),
                            l.debug('receive() | calling pc.setLocalDescription() [answer:%o]', i),
                            await this._pc.setLocalDescription(i);
                        for (const r of e) {
                            const { kind: e, trackId: s, rtpParameters: i } = r,
                                a = e,
                                n = s,
                                o = this._pc.getReceivers().find((e) => e.track && e.track.id === n);
                            if (!o) throw new Error('new RTCRtpReceiver not');
                            this._mapRecvLocalIdInfo.set(n, { mid: a, rtpParameters: i, rtpReceiver: o }),
                                t.push({ localId: n, track: o.track, rtpReceiver: o });
                        }
                        return t;
                    }
                    async stopReceiving(e) {
                        this.assertRecvDirection();
                        for (const t of e) {
                            l.debug('stopReceiving() [localId:%s]', t);
                            const { mid: e, rtpParameters: r } = this._mapRecvLocalIdInfo.get(t) ?? {};
                            this._mapRecvLocalIdInfo.delete(t),
                                this._remoteSdp.planBStopReceiving({ mid: e, offerRtpParameters: r });
                        }
                        const t = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                        l.debug('stopReceiving() | calling pc.setRemoteDescription() [offer:%o]', t),
                            await this._pc.setRemoteDescription(t);
                        const r = await this._pc.createAnswer();
                        l.debug('stopReceiving() | calling pc.setLocalDescription() [answer:%o]', r),
                            await this._pc.setLocalDescription(r);
                    }
                    async getReceiverStats(e) {
                        this.assertRecvDirection();
                        const { rtpReceiver: t } = this._mapRecvLocalIdInfo.get(e) ?? {};
                        if (!t) throw new Error('associated RTCRtpReceiver not found');
                        return t.getStats();
                    }
                    async pauseReceiving(e) {}
                    async resumeReceiving(e) {}
                    async receiveDataChannel({ sctpStreamParameters: e, label: t, protocol: r }) {
                        this.assertRecvDirection();
                        const { streamId: i, ordered: a, maxPacketLifeTime: n, maxRetransmits: o } = e,
                            c = {
                                negotiated: !0,
                                id: i,
                                ordered: a,
                                maxPacketLifeTime: n,
                                maxRetransmits: o,
                                protocol: r,
                            };
                        l.debug('receiveDataChannel() [options:%o]', c);
                        const d = this._pc.createDataChannel(t, c);
                        if (!this._hasDataChannelMediaSection) {
                            this._remoteSdp.receiveSctpAssociation({ oldDataChannelSpec: !0 });
                            const e = { type: 'offer', sdp: this._remoteSdp.getSdp() };
                            l.debug('receiveDataChannel() | calling pc.setRemoteDescription() [offer:%o]', e),
                                await this._pc.setRemoteDescription(e);
                            const t = await this._pc.createAnswer();
                            if (!this._transportReady) {
                                const e = s.parse(t.sdp);
                                await this.setupTransport({
                                    localDtlsRole: this._forcedLocalDtlsRole ?? 'client',
                                    localSdpObject: e,
                                });
                            }
                            l.debug('receiveDataChannel() | calling pc.setRemoteDescription() [answer:%o]', t),
                                await this._pc.setLocalDescription(t),
                                (this._hasDataChannelMediaSection = !0);
                        }
                        return { dataChannel: d };
                    }
                    async setupTransport({ localDtlsRole: e, localSdpObject: t }) {
                        t || (t = s.parse(this._pc.localDescription.sdp));
                        const r = o.extractDtlsParameters({ sdpObject: t });
                        (r.role = e),
                            this._remoteSdp.updateDtlsRole('client' === e ? 'server' : 'client'),
                            await new Promise((e, t) => {
                                this.safeEmit('@connect', { dtlsParameters: r }, e, t);
                            }),
                            (this._transportReady = !0);
                    }
                    assertSendDirection() {
                        if ('send' !== this._direction)
                            throw new Error('method can just be called for handlers with "send" direction');
                    }
                    assertRecvDirection() {
                        if ('recv' !== this._direction)
                            throw new Error('method can just be called for handlers with "recv" direction');
                    }
                }
                t.Safari11 = m;
            },
            9792: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.Producer = void 0);
                const s = r(2994),
                    i = r(3953),
                    a = r(4893),
                    n = new s.Logger('Producer');
                class o extends i.EnhancedEventEmitter {
                    _id;
                    _localId;
                    _closed = !1;
                    _rtpSender;
                    _track;
                    _kind;
                    _rtpParameters;
                    _paused;
                    _maxSpatialLayer;
                    _stopTracks;
                    _disableTrackOnPause;
                    _zeroRtpOnPause;
                    _appData;
                    _observer = new i.EnhancedEventEmitter();
                    constructor({
                        id: e,
                        localId: t,
                        rtpSender: r,
                        track: s,
                        rtpParameters: i,
                        stopTracks: a,
                        disableTrackOnPause: o,
                        zeroRtpOnPause: c,
                        appData: d,
                    }) {
                        super(),
                            n.debug('constructor()'),
                            (this._id = e),
                            (this._localId = t),
                            (this._rtpSender = r),
                            (this._track = s),
                            (this._kind = s.kind),
                            (this._rtpParameters = i),
                            (this._paused = !!o && !s.enabled),
                            (this._maxSpatialLayer = void 0),
                            (this._stopTracks = a),
                            (this._disableTrackOnPause = o),
                            (this._zeroRtpOnPause = c),
                            (this._appData = d ?? {}),
                            (this.onTrackEnded = this.onTrackEnded.bind(this)),
                            this.handleTrack();
                    }
                    get id() {
                        return this._id;
                    }
                    get localId() {
                        return this._localId;
                    }
                    get closed() {
                        return this._closed;
                    }
                    get kind() {
                        return this._kind;
                    }
                    get rtpSender() {
                        return this._rtpSender;
                    }
                    get track() {
                        return this._track;
                    }
                    get rtpParameters() {
                        return this._rtpParameters;
                    }
                    get paused() {
                        return this._paused;
                    }
                    get maxSpatialLayer() {
                        return this._maxSpatialLayer;
                    }
                    get appData() {
                        return this._appData;
                    }
                    set appData(e) {
                        this._appData = e;
                    }
                    get observer() {
                        return this._observer;
                    }
                    close() {
                        this._closed ||
                            (n.debug('close()'),
                            (this._closed = !0),
                            this.destroyTrack(),
                            this.emit('@close'),
                            this._observer.safeEmit('close'));
                    }
                    transportClosed() {
                        this._closed ||
                            (n.debug('transportClosed()'),
                            (this._closed = !0),
                            this.destroyTrack(),
                            this.safeEmit('transportclose'),
                            this._observer.safeEmit('close'));
                    }
                    async getStats() {
                        if (this._closed) throw new a.InvalidStateError('closed');
                        return new Promise((e, t) => {
                            this.safeEmit('@getstats', e, t);
                        });
                    }
                    pause() {
                        n.debug('pause()'),
                            this._closed
                                ? n.error('pause() | Producer closed')
                                : ((this._paused = !0),
                                  this._track && this._disableTrackOnPause && (this._track.enabled = !1),
                                  this._zeroRtpOnPause &&
                                      new Promise((e, t) => {
                                          this.safeEmit('@pause', e, t);
                                      }).catch(() => {}),
                                  this._observer.safeEmit('pause'));
                    }
                    resume() {
                        n.debug('resume()'),
                            this._closed
                                ? n.error('resume() | Producer closed')
                                : ((this._paused = !1),
                                  this._track && this._disableTrackOnPause && (this._track.enabled = !0),
                                  this._zeroRtpOnPause &&
                                      new Promise((e, t) => {
                                          this.safeEmit('@resume', e, t);
                                      }).catch(() => {}),
                                  this._observer.safeEmit('resume'));
                    }
                    async replaceTrack({ track: e }) {
                        if ((n.debug('replaceTrack() [track:%o]', e), this._closed)) {
                            if (e && this._stopTracks)
                                try {
                                    e.stop();
                                } catch (e) {}
                            throw new a.InvalidStateError('closed');
                        }
                        if (e && 'ended' === e.readyState) throw new a.InvalidStateError('track ended');
                        e !== this._track
                            ? (await new Promise((t, r) => {
                                  this.safeEmit('@replacetrack', e, t, r);
                              }),
                              this.destroyTrack(),
                              (this._track = e),
                              this._track &&
                                  this._disableTrackOnPause &&
                                  (this._paused
                                      ? this._paused && (this._track.enabled = !1)
                                      : (this._track.enabled = !0)),
                              this.handleTrack())
                            : n.debug('replaceTrack() | same track, ignored');
                    }
                    async setMaxSpatialLayer(e) {
                        if (this._closed) throw new a.InvalidStateError('closed');
                        if ('video' !== this._kind) throw new a.UnsupportedError('not a video Producer');
                        if ('number' != typeof e) throw new TypeError('invalid spatialLayer');
                        e !== this._maxSpatialLayer &&
                            (await new Promise((t, r) => {
                                this.safeEmit('@setmaxspatiallayer', e, t, r);
                            }).catch(() => {}),
                            (this._maxSpatialLayer = e));
                    }
                    async setRtpEncodingParameters(e) {
                        if (this._closed) throw new a.InvalidStateError('closed');
                        if ('object' != typeof e) throw new TypeError('invalid params');
                        await new Promise((t, r) => {
                            this.safeEmit('@setrtpencodingparameters', e, t, r);
                        });
                    }
                    onTrackEnded() {
                        n.debug('track "ended" event'),
                            this.safeEmit('trackended'),
                            this._observer.safeEmit('trackended');
                    }
                    handleTrack() {
                        this._track && this._track.addEventListener('ended', this.onTrackEnded);
                    }
                    destroyTrack() {
                        if (this._track)
                            try {
                                this._track.removeEventListener('ended', this.onTrackEnded),
                                    this._stopTracks && this._track.stop();
                            } catch (e) {}
                    }
                }
                t.Producer = o;
            },
            9874: (e, t, r) => {
                'use strict';
                Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0);
                var s,
                    i = (s = r(5321)) && s.__esModule ? s : { default: s };
                t.default = function (e) {
                    return 'string' == typeof e && i.default.test(e);
                };
            },
        },
        t = {};
    function r(s) {
        var i = t[s];
        if (void 0 !== i) return i.exports;
        var a = (t[s] = { exports: {} });
        return e[s].call(a.exports, a, a.exports, r), a.exports;
    }
    (r.amdO = {}),
        (r.g = (function () {
            if ('object' == typeof globalThis) return globalThis;
            try {
                return this || new Function('return this')();
            } catch (e) {
                if ('object' == typeof window) return window;
            }
        })());
    var s = r(76);
    window.mediasoupClient = s;
})();
